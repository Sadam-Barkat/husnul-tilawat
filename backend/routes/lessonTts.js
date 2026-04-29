/**
 * POST /api/lesson-tts
 * Body: { text: string }
 * Returns: audio/mpeg stream (ElevenLabs)
 */
"use strict";

const express = require("express");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

function requireEnv(name) {
  const v = process.env[name] && String(process.env[name]).trim();
  return v || "";
}

router.post("/lesson-tts", protect, async (req, res) => {
  const apiKey = requireEnv("ELEVENLABS_API_KEY");
  const voiceId = requireEnv("ELEVENLABS_VOICE_ID");
  if (!apiKey || !voiceId) {
    return res.status(503).json({
      message:
        "ElevenLabs is not configured. Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in backend/.env and restart backend.",
    });
  }

  const text = (req.body?.text && String(req.body.text)) || "";
  const clean = text.trim();
  if (!clean) return res.status(400).json({ message: "Missing \"text\"." });
  if (clean.length > 150) return res.status(400).json({ message: "Text too long for lesson TTS." });

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: clean,
        model_id: "eleven_multilingual_v2",
      }),
    });

    if (!r.ok) {
      const raw = await r.text().catch(() => "");
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        /* ignore */
      }
      const detail =
        parsed != null ? JSON.stringify(parsed).slice(0, 1200) : String(raw || "").slice(0, 1200);
      return res.status(r.status).json({
        message: `ElevenLabs request failed (${r.status}).`,
        detail,
      });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");

    const ab = await r.arrayBuffer();
    return res.send(Buffer.from(ab));
  } catch (e) {
    const msg = e && e.message ? String(e.message) : String(e);
    return res.status(502).json({ message: msg });
  }
});

module.exports = router;

