/**
 * POST /api/check-recitation
 * multipart: audio (file), mode (lesson|pronunciation|quran), expected (string)
 */
'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { protect } = require('../middleware/authMiddleware');
const { transcribeAudio } = require('../utils/transcribeAudio');

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = express.Router();

function normalizeArabic(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\u0600-\u06FF\s]/g, '');
}

function arabicSimilarity(str1, str2) {
  // Remove all harakat/diacritics for comparison
  const removeDiacritics = (s) => s.replace(/[\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ').trim();

  const a = removeDiacritics(str1).toLowerCase();
  const b = removeDiacritics(str2).toLowerCase();

  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  // Levenshtein distance
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return (maxLen - matrix[b.length][a.length]) / maxLen;
}

function compareLesson(spoken, expected) {
  const similarity = arabicSimilarity(spoken, expected);
  const PASS_THRESHOLD = 0.60; // 60% similarity is enough to pass
  const passed = similarity >= PASS_THRESHOLD;
  return {
    passed,
    score: passed ? '1/1' : '0/1',
    similarity: Math.round(similarity * 100),
    spokenWord: spoken,
    expectedWord: expected,
  };
}

function compareQuran(spoken, expected) {
  const removeDiacritics = (s) => s.replace(/[\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ').trim();

  const spokenWords = removeDiacritics(spoken).split(' ').filter(Boolean);
  const expectedWords = removeDiacritics(expected).split(' ').filter(Boolean);
  const expectedOriginal = expected.split(' ').filter(Boolean);

  const wordResults = expectedOriginal.map((expectedWord, i) => {
    const spokenWord = spokenWords[i] ?? '';
    const similarity = arabicSimilarity(spokenWord, expectedWord);
    const correct = similarity >= 0.60;
    return {
      word: expectedWord,
      spoken: spokenWord,
      correct,
      similarity: Math.round(similarity * 100),
      color: correct ? 'green' : 'red',
    };
  });

  const correctCount = wordResults.filter((w) => w.correct).length;

  return {
    wordResults,
    totalWords: expectedOriginal.length,
    correctWords: correctCount,
    accuracy: Math.round((correctCount / expectedOriginal.length) * 100),
  };
}

function cleanTranscript(text) {
  return String(text || '')
    .replace(/<\|[^|]+\|>/g, '') // remove all <|token|> special tokens
    .replace(/\s+/g, ' ')
    .trim();
}

function convertToWav16kMono(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec('pcm_s16le')
      .format('wav')
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

router.post('/check-recitation', protect, upload.single('audio'), async (req, res) => {
  console.log('[check-recitation] incoming', {
    hasFile: Boolean(req.file),
    bytes: req.file?.buffer?.length ?? 0,
    mimetype: req.file?.mimetype,
    mode: req.body?.mode,
    expectedChars: typeof req.body?.expected === 'string' ? req.body.expected.length : 0,
    userId: req.user?._id ? String(req.user._id) : undefined,
  });
  const mode = String(req.body?.mode || '').trim();
  const expected = String(req.body?.expected || '').trim();

  if (!req.file?.buffer?.length) {
    console.log('[check-recitation] reject: missing audio buffer');
    return res.status(400).json({ message: 'Missing audio file. Use multipart field name "audio".' });
  }
  if (!mode || !['lesson', 'pronunciation', 'quran'].includes(mode)) {
    console.log('[check-recitation] reject: invalid mode', { mode });
    return res.status(400).json({ message: 'Missing or invalid "mode". Use lesson|pronunciation|quran.' });
  }
  if (!expected) {
    console.log('[check-recitation] reject: missing expected text');
    return res.status(400).json({ message: 'Missing "expected" text.' });
  }

  const mime = req.file.mimetype || '';
  const ext = mime.includes('wav')
    ? 'wav'
    : mime.includes('mpeg') || mime.includes('mp3')
      ? 'mp3'
      : mime.includes('mp4') || mime.includes('m4a')
        ? 'm4a'
        : 'webm';

  const id = crypto.randomBytes(12).toString('hex');
  const inPath = path.join(os.tmpdir(), `husn-check-in-${id}.${ext}`);
  const outPath = path.join(os.tmpdir(), `husn-check-out-${id}.wav`);

  try {
    console.log('[check-recitation] write temp input', { inPath, outPath, ext, mime });
    await fs.writeFile(inPath, req.file.buffer);
    console.log('[check-recitation] ffmpeg convert start');
    await convertToWav16kMono(inPath, outPath);
    console.log('[check-recitation] ffmpeg convert done');
    const wavBuffer = await fs.readFile(outPath);
    console.log('[check-recitation] wav ready', { bytes: wavBuffer.length });

    console.log('[check-recitation] calling python transcribe', { pythonUrl: process.env.PYTHON_AI_URL });
    const tr = await transcribeAudio(wavBuffer, 'audio/wav');
    console.log('[check-recitation] python response', {
      keys: tr && typeof tr === 'object' ? Object.keys(tr) : typeof tr,
      transcriptChars: tr?.transcript ? String(tr.transcript).length : 0,
      rawChars: tr?.raw ? String(tr.raw).length : 0,
      chunksCount: Array.isArray(tr?.chunks) ? tr.chunks.length : 0,
    });
    const transcript = cleanTranscript(tr?.transcript);
    const raw = cleanTranscript(tr?.raw);
    const chunks = Array.isArray(tr?.chunks) ? tr.chunks : [];

    const spoken = transcript || raw;
    if (!spoken) {
      console.log('[check-recitation] reject: empty transcript/raw', { transcript, raw });
      return res.status(502).json({ message: 'Transcription returned empty text.' });
    }

    if (mode === 'quran') {
      const cmp = compareQuran(spoken, expected);
      console.log('[check-recitation] compare quran', {
        accuracy: cmp.accuracy,
        totalWords: cmp.totalWords,
        correctWords: cmp.correctWords,
      });
      return res.json({ transcript, raw, chunks, ...cmp });
    }

    const cmp = compareLesson(spoken, expected);
    console.log('[check-recitation] compare lesson/pronunciation', { passed: cmp.passed, score: cmp.score });
    return res.json({ transcript, raw, ...cmp });
  } catch (e) {
    const msg = e && e.message ? String(e.message) : String(e);
    const status = e && typeof e.status === 'number' ? e.status : 502;
    console.log('[check-recitation] ERROR', {
      status,
      message: msg,
      stack: e?.stack,
    });
    return res.status(status).json({ message: msg });
  } finally {
    await fs.unlink(inPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
});

module.exports = router;

