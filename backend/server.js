/**
 * Express server: DB connection and auth routes only.
 * Load .env from this folder (backend/) — not from process.cwd(), so starting Node from the repo root still works.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const http = require('http');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { attachQrcWebSocket } = require('./qrcWebSocket');

const app = express();

// Vite dev may run on 5173 or 8080 depending on vite.config
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:8080',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8080',
    ],
    credentials: true,
  }),
);

// Body parser for JSON
app.use(express.json());

// Auth routes (Register + Login)
app.use('/api/auth', require('./routes/auth'));

// Profile routes
app.use('/api/profile', require('./routes/profile'));

// Lesson routes (Tajweed lessons)
app.use('/api/lessons', require('./routes/lessons'));

// Feedback routes
app.use('/api/feedback', require('./routes/feedback'));

// Recitation routes
app.use('/api/recitations', require('./routes/recitations'));

// Practice phrases routes
app.use('/api/practice-phrases', require('./routes/practicePhrases'));

// Quiz routes (questions, submit, history)
app.use('/api/quiz', require('./routes/quiz'));

// Progress routes (aggregated analytics)
app.use('/api/progress', require('./routes/progress'));

// Admin dashboard API (JWT + role admin)
app.use('/api/admin', require('./routes/admin'));

// AI check (speech → transcript → comparison)
app.use('/api', require('./routes/checkRecitation'));
// Lesson audio (ElevenLabs TTS)
app.use('/api', require('./routes/lessonTts'));

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
attachQrcWebSocket(server);

async function start() {
  await connectDB();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (all interfaces)`);
    console.log(`Admin API: /api/admin (restart server after git pull if admin pages 404)`);
    console.log(`QRC proxy: ws://localhost:${PORT}/api/qrc-stream (set QURANI_QRC_API_KEY in .env)`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
