/**
 * POST /api/quran-whisper/transcribe — OpenAI Whisper (Arabic) for Mushaf recitation check.
 * multipart field name: audio (webm/wav/mp3, etc.)
 */
'use strict';

const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = express.Router();

router.post('/transcribe', protect, upload.single('audio'), async (req, res) => {
  const key = process.env.OPENAI_API_KEY && String(process.env.OPENAI_API_KEY).trim();
  if (!key) {
    return res.status(503).json({
      message: 'OpenAI is not configured. Set OPENAI_API_KEY in backend/.env and restart the server.',
    });
  }
  if (!req.file?.buffer?.length) {
    return res.status(400).json({ message: 'Missing audio file. Use multipart field name "audio".' });
  }

  const mime = req.file.mimetype || 'audio/webm';
  const ext = mime.includes('wav') ? 'wav' : mime.includes('mp4') ? 'm4a' : mime.includes('mpeg') ? 'mp3' : 'webm';
  const filename = `recitation.${ext}`;

  try {
    const form = new FormData();
    form.append('file', new Blob([req.file.buffer], { type: mime }), filename);
    form.append('model', 'whisper-1');
    form.append('language', 'ar');

    const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = data.error?.message || data.message || `OpenAI error (${upstream.status})`;
      return res.status(502).json({ message: msg });
    }
    if (typeof data.text !== 'string') {
      return res.status(502).json({ message: 'Unexpected response from transcription service.' });
    }
    return res.json({ text: data.text.trim() });
  } catch (e) {
    console.error('Whisper transcribe:', e.message);
    return res.status(502).json({ message: e.message || 'Transcription request failed' });
  }
});

module.exports = router;
