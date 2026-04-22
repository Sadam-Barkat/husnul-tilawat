/** Quick check: does api.qurani.ai accept StartTilawaSession with your key? */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const WebSocket = require("ws");

const key = process.env.QURANI_QRC_API_KEY && String(process.env.QURANI_QRC_API_KEY).trim();
if (!key) {
  console.error("Missing QURANI_QRC_API_KEY in backend/.env");
  process.exit(1);
}

const url = `wss://api.qurani.ai?api_key=${encodeURIComponent(key)}`;
console.log("Connecting to Qurani QRC…");
const ws = new WebSocket(url);

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
  console.log("sent StartTilawaSession");
});

ws.on("message", (data, isBinary) => {
  console.log("message", isBinary ? `(binary ${data.length}b)` : data.toString().slice(0, 400));
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
  console.log("timeout 8s");
  process.exit(1);
}, 8000).unref();
