/**
 * MongoDB Atlas connection configuration.
 * Database "husnultilawat" is auto-created on first connection/insert.
 *
 * Priority: MONGO_URI_DIRECT → expanded mongodb+srv → MONGO_URI as-is.
 * Expanding mongodb+srv here avoids the driver's internal SRV/TXT lookups on
 * networks where those time out (queryTxt ETIMEOUT) while other laptops work fine.
 */
const dns = require('dns');
const https = require('https');
const mongoose = require('mongoose');
const axios = require('axios');

/** Force IPv4 for DoH — avoids ECONNRESET / broken paths on some Windows dual-stack networks. */
const dohHttpsAgent = new https.Agent({ family: 4, keepAlive: false });

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

/**
 * Parse Google / Cloudflare DNS JSON (TXT) into replicaSet / authSource query string.
 * @param {object} data
 */
function parseAtlasTxtFromDohJson(data) {
  if (!data || typeof data !== 'object') return '';
  const st = data.Status;
  if (st !== 0 && st !== 'NOERROR') return '';
  const answers = data.Answer;
  if (!Array.isArray(answers)) return '';
  const rawTxt = answers
    .filter((a) => Number(a.type) === 16)
    .map((a) => String(a.data || ''))
    .join('');
  if (!rawTxt) return '';
  const rs = rawTxt.match(/replicaSet=([^"&\s]+)/i);
  const au = rawTxt.match(/authSource=([^"&\s]+)/i);
  const tls = rawTxt.match(/tls=([^"&\s]+)/i);
  const parts = [];
  if (rs) parts.push(`replicaSet=${rs[1]}`);
  if (au) parts.push(`authSource=${au[1]}`);
  if (tls) parts.push(`tls=${tls[1]}`);
  return parts.join('&');
}

/**
 * Atlas TXT via DNS-over-HTTPS (several providers + retries). Use when UDP TXT times out
 * or when one HTTPS endpoint resets (ECONNRESET).
 * @param {string} hostname e.g. cluster0.xxxxx.mongodb.net
 */
async function resolveTxtViaAnyDoh(hostname) {
  if (process.env.MONGO_SKIP_TXT_DOH === '1' || process.env.MONGO_SKIP_TXT_DOH === 'true') {
    return '';
  }
  const name = String(hostname || '').trim();
  if (!name) return '';
  const enc = encodeURIComponent(name);
  const urls = [
    `https://dns.google/resolve?name=${enc}&type=TXT`,
    `https://cloudflare-dns.com/dns-query?name=${enc}&type=TXT`,
    `https://1.1.1.1/dns-query?name=${enc}&type=TXT`,
  ];
  const headers = { Accept: 'application/dns-json' };

  for (const url of urls) {
    const hostLabel = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    })();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const { data } = await axios.get(url, {
          timeout: 12000,
          headers,
          httpsAgent: dohHttpsAgent,
          validateStatus: (s) => s === 200,
        });
        const parsed = parseAtlasTxtFromDohJson(data);
        if (parsed) {
          console.log('[db] Atlas TXT via DoH:', hostLabel);
          return parsed;
        }
      } catch (e) {
        const msg = e && e.message ? String(e.message) : String(e);
        if (attempt === 2) {
          console.warn(`[db] DoH ${hostLabel} failed after retries:`, msg.split('\n')[0]);
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  return '';
}

/** Atlas TXT often concatenates key=value pairs without "&" between them. */
function mergeAtlasTxtIntoParams(params, txtRaw) {
  if (!txtRaw) return;
  let s = String(txtRaw).trim().replace(/\s+/g, '');
  if (!s) return;
  if (!s.includes('&')) {
    s = s.replace(/(replicaSet|authSource|tls|ssl)=/gi, (m, _g, offset) => (offset > 0 ? '&' : '') + m);
  }
  try {
    const fromTxt = new URLSearchParams(s);
    for (const [k, v] of fromTxt.entries()) {
      params.set(k, v);
    }
  } catch {
    /* ignore */
  }
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
  mergeAtlasTxtIntoParams(params, txtQuery);

  const envRs =
    (process.env.ATLAS_REPLICA_SET && String(process.env.ATLAS_REPLICA_SET).trim()) ||
    (process.env.MONGODB_REPLICA_SET && String(process.env.MONGODB_REPLICA_SET).trim());
  if (!params.has('replicaSet') && envRs) {
    params.set('replicaSet', envRs);
    console.log('[db] Using replicaSet from ATLAS_REPLICA_SET / MONGODB_REPLICA_SET.');
  }

  if (!params.has('replicaSet')) {
    const dohTxt = await resolveTxtViaAnyDoh(srvHost);
    mergeAtlasTxtIntoParams(params, dohTxt);
  }

  if (!params.has('replicaSet')) {
    throw new Error(
      'Could not get Atlas replicaSet (TXT and DoH failed). In backend/.env add ATLAS_REPLICA_SET=atlas-xxxxx-shard-0 from Atlas → Connect → Drivers (see standard URI), or set MONGO_URI_DIRECT=mongodb://…',
    );
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

/**
 * If the URI has no database segment (or only "test"), the driver uses the empty `test` DB —
 * migrated Atlas data in `husnultilawat` will not appear. Set MONGO_DB_NAME to override.
 * @param {string} uri
 * @returns {string|undefined} Mongoose `dbName` option, or undefined to use the URI path only.
 */
function resolveMongooseDbName(uri) {
  const explicit = process.env.MONGO_DB_NAME && String(process.env.MONGO_DB_NAME).trim();
  if (explicit) return explicit;
  const normalized = String(uri).replace(/^mongodb(\+srv)?:\/\//i, 'http://');
  let pathname = '/';
  try {
    pathname = new URL(normalized).pathname || '/';
  } catch {
    return 'husnultilawat';
  }
  const first = pathname.replace(/^\//, '').split('/')[0].split('?')[0].trim().toLowerCase();
  if (!first || first === 'test') {
    return 'husnultilawat';
  }
  return undefined;
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
  console.error('6) Or set ATLAS_REPLICA_SET=atlas-xxxxx-shard-0 from the standard mongodb:// string in Atlas (works if HTTPS to DoH is blocked).');
  console.error('7) Set MONGO_SKIP_TXT_DOH=1 to skip DoH attempts only (still need ATLAS_REPLICA_SET or working TXT).');
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
      console.error('[db] mongodb+srv expansion failed:', msg);
      console.error('[db] Fix .env (MONGO_URI_DIRECT or ATLAS_REPLICA_SET) — not falling back to srv (avoids long TXT timeout).');
      process.exit(1);
    }
  }

  try {
    const dbName = resolveMongooseDbName(uri);
    const connectOpts = {
      serverSelectionTimeoutMS: 45000,
      connectTimeoutMS: 45000,
      maxPoolSize: 10,
      family: 4,
    };
    if (dbName) {
      connectOpts.dbName = dbName;
      console.log(`[db] Mongoose dbName="${dbName}" (set MONGO_DB_NAME in .env to use a different database).`);
    }
    await mongoose.connect(uri, connectOpts);
    console.log(`MongoDB connected (database: ${mongoose.connection.name})`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.error('Check MONGO_URI, Atlas cluster status, and Network Access (IP allowlist).');
    const msg = String(err.message || '');
    if (
      msg.includes('queryTxt') ||
      msg.includes('ETIMEOUT') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('srv') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('Server selection timed out')
    ) {
      printDnsHelp();
      if (msg.includes('Server selection timed out')) {
        console.error(
          'Also check: Atlas Network Access (your IP), outbound TCP 27017, and correct DB user/password in the URI.',
        );
      }
    }
    process.exit(1);
  }
};

module.exports = connectDB;
