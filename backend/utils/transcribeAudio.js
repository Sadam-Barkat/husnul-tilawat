const FormData = require('form-data');
const axios = require('axios');

const PYTHON_AI_URL = (process.env.PYTHON_AI_URL || 'http://localhost:8001').replace(/\/+$/, '');

/**
 * @param {Buffer} audioBuffer
 * @param {string} mimeType
 * @returns {Promise<{ transcript: string, raw: string, chunks: Array<{ text: string, timestamp: [number, number] }> }>}
 */
async function transcribeAudio(audioBuffer, mimeType = 'audio/wav') {
  const form = new FormData();
  form.append('audio', audioBuffer, {
    filename: 'recording.wav',
    contentType: mimeType,
  });

  const url = `${PYTHON_AI_URL}/transcribe`;
  console.log('[transcribeAudio] POST', url, {
    bytes: audioBuffer?.length ?? 0,
    mimeType,
  });

  try {
    const response = await axios.post(url, form, {
      headers: form.getHeaders(),
      // Whisper on CPU can easily exceed 30s for first call.
      timeout: 60000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return response.data;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      console.log('[transcribeAudio] ERROR', {
        status: e.response?.status,
        data: e.response?.data,
        message: e.message,
      });
      const status = e.response?.status;
      const detail =
        e.response?.data != null
          ? typeof e.response.data === 'string'
            ? e.response.data.slice(0, 800)
            : JSON.stringify(e.response.data).slice(0, 800)
          : e.message;
      const msg =
        status != null
          ? `Python ASR request failed (${status}).`
          : /timeout/i.test(String(e.message || ''))
            ? 'Python ASR request timed out. Try again (first run is slow).'
            : 'Python ASR request failed.';
      const err = new Error(`${msg} ${detail || ''}`.trim());
      err.status = status || 502;
      throw err;
    }
    throw e;
  }
}

module.exports = { transcribeAudio };

