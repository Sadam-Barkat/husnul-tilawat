/**
 * MongoDB Atlas connection configuration.
 * Database "husnultilawat" is auto-created on first connection/insert.
 *
 * Priority: MONGO_URI_DIRECT → expanded mongodb+srv → MONGO_URI as-is.
 * Expanding mongodb+srv here avoids the driver's internal SRV/TXT lookups on
 * networks where those time out (queryTxt ETIMEOUT) while other laptops work fine.
 */
const dns = require('dns');
const mongoose = require('mongoose');

/**
 * Node uses the OS DNS. Some campus/corporate resolvers refuse SRV/A lookups used by
 * mongodb+srv (error: querySrv ECONNREFUSED …). Public DNS avoids that.
 * - Set MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1 to override (comma-separated).
 * - Set MONGO_DNS_SERVERS= (empty) on Windows to skip and use system DNS only.
 * - If unset on Windows, default to Google + Cloudflare.
 */
const mongoDnsEnv = process.env.MONGO_DNS_SERVERS;
const mongoDns =
  mongoDnsEnv !== undefined
    ? String(mongoDnsEnv).trim()
    : process.platform === 'win32'
      ? '8.8.8.8,1.1.1.1'
      : '';
if (mongoDns) {
  const servers = mongoDns.split(',').map((s) => s.trim()).filter(Boolean);
  if (servers.length) {
    dns.setServers(servers);
  }
}

// Prefer IPv4 first — avoids some Windows / dual-stack DNS hangs before Mongo connects.
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

function mongoConnectionString() {
  const direct = process.env.MONGO_URI_DIRECT && String(process.env.MONGO_URI_DIRECT).trim();
  if (direct) return direct;
  return process.env.MONGO_URI && String(process.env.MONGO_URI).trim();
}

/** When Atlas TXT is missing, infer replicaSet from shard hostname (Atlas M10+ pattern). */
function guessAtlasReplicaSet(memberHost) {
  const m = String(memberHost).match(/^[a-z0-9]+-([a-z0-9]+)-shard-00-\d+\./i);
  if (!m) return '';
  return `atlas-${m[1]}-shard-0`;
}

/**
 * Resolve mongodb+srv into mongodb://host1:27017,… so the driver skips its own TXT/SRV.
 * @param {string} uri
 * @returns {Promise<string>}
 */
async function expandMongoSrvToStandard(uri) {
  if (!/^mongodb\+srv:\/\//i.test(uri)) {
    return uri;
  }

  const asHttp = uri.replace(/^mongodb\+srv:\/\//i, 'http://');
  let u;
  try {
    u = new URL(asHttp);
  } catch {
    throw new Error('Invalid mongodb+srv URI');
  }

  const srvHost = u.hostname;
  if (!srvHost) {
    throw new Error('Missing hostname in mongodb+srv URI');
  }

  const user = u.username ? decodeURIComponent(u.username) : '';
  const pass = u.password ? decodeURIComponent(u.password) : '';

  let pathname = u.pathname || '/';
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;

  const srvName = `_mongodb._tcp.${srvHost}`;
  const srvRecords = await dns.promises.resolveSrv(srvName);
  if (!srvRecords.length) {
    throw new Error('SRV lookup returned no records');
  }
  srvRecords.sort((a, b) => a.priority - b.priority || a.weight - b.weight);
  const hosts = srvRecords.map((r) => `${r.name}:${r.port || 27017}`).join(',');

  const mergeTxt = async (attempts, timeoutMs) => {
    let lastErr;
    for (let i = 0; i < attempts; i += 1) {
      try {
        const txts = await Promise.race([
          dns.promises.resolveTxt(srvHost),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error('resolveTxt timeout')), timeoutMs),
          ),
        ]);
        /** One TXT record = string[] of fragments; concatenate fragments, then join records with &. */
        const combined = /** @type {string[][]} */ (txts)
          .map((record) => record.join(''))
          .filter(Boolean)
          .join('&');
        if (combined) return combined;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('resolveTxt failed');
  };

  let txtQuery = '';
  try {
    txtQuery = await mergeTxt(2, 8000);
  } catch (e) {
    console.warn('[db] resolveTxt failed after retries:', e && e.message ? e.message : e);
    txtQuery = '';
  }

  const params = new URLSearchParams(u.search || '');
  if (txtQuery) {
    try {
      const fromTxt = new URLSearchParams(txtQuery);
      for (const [k, v] of fromTxt.entries()) {
        params.set(k, v);
      }
    } catch {
      /* ignore malformed TXT */
    }
  }
  if (!params.has('replicaSet')) {
    const first = srvRecords[0] && srvRecords[0].name;
    const guess = first ? guessAtlasReplicaSet(first) : '';
    if (guess) {
      params.set('replicaSet', guess);
      params.set('authSource', 'admin');
      console.warn('[db] No replicaSet in TXT; using heuristic:', guess);
    }
  }
  if (!params.has('authSource')) {
    params.set('authSource', 'admin');
  }
  if (!params.has('ssl') && !params.has('tls')) {
    params.set('ssl', 'true');
  }
  if (!params.has('retryWrites')) {
    params.set('retryWrites', 'true');
  }
  if (!params.has('w')) {
    params.set('w', 'majority');
  }

  const qs = params.toString();
  const pathAndQs = `${pathname}${qs ? `?${qs}` : ''}`;

  let auth = '';
  if (user) {
    auth = `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`;
  }

  return `mongodb://${auth}${hosts}${pathAndQs}`;
}

function printDnsHelp() {
  console.error('');
  console.error('If you see queryTxt ETIMEOUT / DNS errors with mongodb+srv://');
  console.error('1) Atlas → Connect → Drivers → copy the connection string that starts with mongodb://');
  console.error('   (not mongodb+srv). It lists hostnames like cluster0.xxxxx.mongodb.net:27017.');
  console.error('2) Or fix DNS: Windows network settings → DNS server → 8.8.8.8 and 1.1.1.1, then retry.');
  console.error('3) Atlas → Network Access → allow your IP or 0.0.0.0/0 for development.');
  console.error('4) If you see querySrv ECONNREFUSED on Windows: Node is using a broken DNS.');
  console.error('   This app defaults to 8.8.8.8 + 1.1.1.1 on Windows (see db.js). Set MONGO_DNS_SERVERS= to opt out.');
  console.error('5) Set MONGO_URI_DIRECT in .env to the standard mongodb://… URI (bypasses SRV + TXT).');
  console.error('');
}

const connectDB = async () => {
  const raw = mongoConnectionString();
  if (!raw) {
    console.error('Set MONGO_URI or MONGO_URI_DIRECT in backend/.env');
    process.exit(1);
  }

  let uri = raw;
  const skipExpand =
    process.env.MONGO_SKIP_SRV_EXPAND === '1' || process.env.MONGO_SKIP_SRV_EXPAND === 'true';
  if (!skipExpand && raw.startsWith('mongodb+srv://')) {
    try {
      uri = await expandMongoSrvToStandard(raw);
      console.log('[db] Resolved mongodb+srv to seed connection string (app-level DNS; avoids driver TXT hang).');
    } catch (e) {
      const msg = e && e.message ? String(e.message) : String(e);
      console.warn('[db] Could not expand mongodb+srv, falling back to driver URI:', msg);
      uri = raw;
    }
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 45000,
      connectTimeoutMS: 45000,
      maxPoolSize: 10,
      family: 4,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.error('Check MONGO_URI, Atlas cluster status, and Network Access (IP allowlist).');
    const msg = String(err.message || '');
    if (
      msg.includes('queryTxt') ||
      msg.includes('ETIMEOUT') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('srv') ||
      msg.includes('ECONNREFUSED')
    ) {
      printDnsHelp();
    }
    process.exit(1);
  }
};

module.exports = connectDB;
