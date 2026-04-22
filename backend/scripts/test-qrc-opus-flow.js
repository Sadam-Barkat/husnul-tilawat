/** Send StartTilawaSession + Opus silence; print upstream JSON (no key in logs). */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const WebSocket = require("ws");
const OpusScript = require("opusscript");

const key = process.env.QURANI_QRC_API_KEY && String(process.env.QURANI_QRC_API_KEY).trim();
if (!key) {
  console.error("Missing QURANI_QRC_API_KEY");
  process.exit(1);
}

const FRAME_SAMPLES = 960;
const FRAME_BYTES = FRAME_SAMPLES * 2;
const enc = new OpusScript(48000, 1, OpusScript.Application.AUDIO);
const silence = Buffer.alloc(FRAME_BYTES);

const ws = new WebSocket(`wss://api.qurani.ai?api_key=${encodeURIComponent(key)}`);

ws.on("open", () => {
  console.log("upstream open");
  ws.send(
    JSON.stringify({
      method: "StartTilawaSession",
      chapter_index: 1,
      verse_index: 1,
      word_index: 1,
      hafz_level: 1,
      tajweed_level: 3,
    }),
  );
  // Let JSON be processed before first Opus frame (avoid server-side race).
  setTimeout(() => {
    const id = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      try {
        const pkt = enc.encode(silence, FRAME_SAMPLES);
        if (pkt?.length) ws.send(pkt);
      } catch (e) {
        console.error("encode", e.message);
      }
    }, 20);
    setTimeout(() => clearInterval(id), 15000);
  }, 150);
});

let n = 0;
ws.on("message", (data, isBinary) => {
  if (isBinary) {
    const head = data.slice(0, 4).toString("hex");
    console.log("binary", data.length, "head", head);
    try {
      const t = data.toString("utf8");
      if (t.startsWith("{")) console.log("binary as utf8", t.slice(0, 400));
    } catch {
      /* ignore */
    }
    return;
  }
  const s = data.toString();
  console.log("text len", s.length, s.slice(0, 800));
  try {
    const j = JSON.parse(s);
    if (j.event === "check_tilawa") n++;
    if (n >= 2) {
      console.log("got check_tilawa, ok");
      process.exit(0);
    }
  } catch {
    /* ignore */
  }
});

ws.on("close", (code, reason) => {
  console.log("close", code, reason?.toString() || "");
  process.exit(code === 1000 ? 0 : 1);
});

ws.on("error", (err) => {
  console.error("error", err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log("timeout 12s, check_tilawa count:", n);
  process.exit(n > 0 ? 0 : 1);
}, 12000).unref();
