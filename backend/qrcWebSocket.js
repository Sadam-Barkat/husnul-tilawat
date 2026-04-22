/**
 * Qurani QRC WebSocket proxy: encodes browser PCM to Opus for api.qurani.ai.
 * Prefer @discordjs/opus (matches Qurani docs); opusscript as fallback.
 * PCM frames are routed by exact frame size first (some clients mis-report isBinary).
 */
'use strict';

const WebSocket = require('ws');
const OpusScript = require('opusscript');

/** @type {typeof import('@discordjs/opus').OpusEncoder | null} */
let OpusEncoderClass = null;
try {
  OpusEncoderClass = require('@discordjs/opus').OpusEncoder;
} catch (e) {
  console.warn('[QRC] @discordjs/opus not available:', e.message);
}

const PATH = '/api/qrc-stream';
const FRAME_SAMPLES = 960; // 20 ms @ 48 kHz mono
const FRAME_BYTES = FRAME_SAMPLES * 2;

/**
 * @param {import('http').Server} httpServer
 */
function attachQrcWebSocket(httpServer) {
  const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = String(request.url || '').split('?')[0];
    if (pathname !== PATH) {
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleQrcClient(ws);
    });
  });
}

function handleQrcClient(clientWs) {
  const apiKey = process.env.QURANI_QRC_API_KEY && String(process.env.QURANI_QRC_API_KEY).trim();
  if (!apiKey) {
    try {
      clientWs.send(
        JSON.stringify({
          type: 'proxy_error',
          message: 'Set QURANI_QRC_API_KEY in backend/.env and restart the Node server.',
        }),
      );
    } catch (_) {
      /* ignore */
    }
    clientWs.close(4000, 'No API key');
    return;
  }

  let upstream = null;
  /** @type {import('@discordjs/opus').OpusEncoder | null} */
  let opusNative = null;
  /** @type {import('opusscript') | null} */
  let opusScript = null;

  const hasEncoder = () => Boolean(opusNative || opusScript);

  const pcmBacklog = [];
  const PCM_BACKLOG_MAX = 80;

  const destroyEncoder = () => {
    if (opusScript) {
      try {
        opusScript.delete();
      } catch (_) {
        /* ignore */
      }
      opusScript = null;
    }
    opusNative = null;
    pcmBacklog.length = 0;
  };

  const encodePcmAndSend = (buf) => {
    if (!hasEncoder() || !upstream || upstream.readyState !== WebSocket.OPEN) return;
    if (buf.length !== FRAME_BYTES) return;
    try {
      let packet;
      if (opusNative) {
        packet = opusNative.encode(buf);
      } else {
        packet = opusScript.encode(buf, FRAME_SAMPLES);
      }
      if (packet && packet.length) upstream.send(packet);
    } catch (e) {
      console.error('QRC Opus encode:', e.message);
    }
  };

  const flushPcmBacklog = () => {
    while (pcmBacklog.length && hasEncoder()) {
      encodePcmAndSend(pcmBacklog.shift());
    }
  };

  const closeUpstream = () => {
    if (upstream && (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING)) {
      try {
        upstream.close();
      } catch (_) {
        /* ignore */
      }
    }
    upstream = null;
  };

  upstream = new WebSocket(`wss://api.qurani.ai?api_key=${encodeURIComponent(apiKey)}`, {
    perMessageDeflate: false,
  });

  upstream.on('open', () => {
    try {
      clientWs.send(JSON.stringify({ type: 'proxy_ready' }));
    } catch (_) {
      /* ignore */
    }
  });

  upstream.on('message', (data, isBinary) => {
    if (clientWs.readyState !== WebSocket.OPEN) return;
    try {
      if (isBinary) {
        clientWs.send(data, { binary: true });
        return;
      }
      const text = data.toString();
      let j;
      try {
        j = JSON.parse(text);
      } catch {
        clientWs.send(text);
        return;
      }

      if (j.event === 'start_tilawa_session') {
        const ok = j.exit_code === undefined || j.exit_code === 0;
        if (!ok) {
          destroyEncoder();
          try {
            clientWs.send(
              JSON.stringify({
                type: 'proxy_error',
                message: `Qurani rejected session (exit_code ${j.exit_code}). Check API key or plan.`,
              }),
            );
          } catch (_) {
            /* ignore */
          }
        }
      }
      clientWs.send(text);
    } catch (e) {
      console.error('QRC upstream relay:', e.message);
    }
  });

  upstream.on('error', (err) => {
    console.error('QRC upstream error:', err.message);
    try {
      clientWs.send(JSON.stringify({ type: 'proxy_error', message: 'Could not reach Qurani API.' }));
    } catch (_) {
      /* ignore */
    }
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
  });

  upstream.on('close', (code, reason) => {
    console.error('[QRC] upstream closed', code, reason?.toString?.() || '');
    destroyEncoder();
    upstream = null;
    try {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'proxy_error',
            message: `Qurani disconnected (code ${code}). Trial limit, invalid key, or network.`,
          }),
        );
      }
    } catch (_) {
      /* ignore */
    }
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1000, 'upstream closed');
    }
  });

  clientWs.on('message', (data, isBinary) => {
    if (!upstream || upstream.readyState !== WebSocket.OPEN) return;

    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (buf.length === FRAME_BYTES) {
      if (!hasEncoder()) {
        if (pcmBacklog.length < PCM_BACKLOG_MAX) pcmBacklog.push(buf);
        return;
      }
      encodePcmAndSend(buf);
      return;
    }

    try {
      const msg = JSON.parse(buf.toString('utf8'));
      if (msg.type === 'qrc_session' && msg.payload) {
        if (!hasEncoder()) {
          if (OpusEncoderClass) {
            try {
              opusNative = new OpusEncoderClass(48000, 1);
              if (typeof opusNative.setBitrate === 'function') {
                opusNative.setBitrate(128000);
              }
              console.log('[QRC] encoder: @discordjs/opus (native)');
            } catch (e) {
              console.error('QRC native Opus init failed:', e.message);
            }
          }
          if (!opusNative) {
            try {
              opusScript = new OpusScript(48000, 1, OpusScript.Application.AUDIO);
              console.log('[QRC] encoder: opusscript (fallback)');
            } catch (e) {
              console.error('QRC OpusScript init failed:', e.message);
            }
          }
        }
        upstream.send(JSON.stringify(msg.payload));
        flushPcmBacklog();
      }
    } catch (_) {
      /* ignore non-JSON noise */
    }
  });

  clientWs.on('close', () => {
    destroyEncoder();
    closeUpstream();
  });

  clientWs.on('error', () => {
    destroyEncoder();
    closeUpstream();
  });
}

module.exports = { attachQrcWebSocket, PATH };
