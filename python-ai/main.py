import imageio_ffmpeg
import os

os.environ["PATH"] += os.pathsep + os.path.dirname(imageio_ffmpeg.get_ffmpeg_exe())

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from transformers import pipeline
import tempfile
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading Arabic ASR model... this may take a moment on first run")

model_dir = os.path.join(os.path.dirname(__file__), "model")

asr = pipeline(
    "automatic-speech-recognition",
    model="tarteel-ai/whisper-base-ar-quran",
    model_kwargs={"cache_dir": model_dir},
    return_timestamps=False
)

print("Model loaded successfully")

try:
    from mishkal.tashkeel import TashkeelClass
    tashkeel = TashkeelClass()
    MISHKAL_AVAILABLE = True
except Exception:
    MISHKAL_AVAILABLE = False

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    import numpy as np
    import io
    import torch
    import wave
    import torchaudio

    content = await audio.read()
    buffer = io.BytesIO(content)

    try:
        with wave.open(buffer, "rb") as wf:
            sample_rate = int(wf.getframerate())
            channels = int(wf.getnchannels())
            sample_width = int(wf.getsampwidth())
            n_frames = int(wf.getnframes())
            pcm = wf.readframes(n_frames)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read audio file: {str(e)}")

    if sample_width != 2:
        raise HTTPException(status_code=400, detail="Unsupported WAV format. Please send 16-bit PCM WAV.")

    audio_i16 = np.frombuffer(pcm, dtype=np.int16)
    if channels > 1:
        audio_i16 = audio_i16.reshape(-1, channels).mean(axis=1).astype(np.int16)

    waveform = torch.from_numpy(audio_i16.astype(np.float32) / 32768.0).unsqueeze(0)  # [1, T]

    if sample_rate != 16000:
        waveform = torchaudio.functional.resample(waveform, sample_rate, 16000)

    if waveform.shape[0] > 1:
        waveform = torch.mean(waveform, dim=0, keepdim=True)

    audio_array = waveform.squeeze().numpy().astype(np.float32)

    result = asr(
        {"array": audio_array, "sampling_rate": 16000}
    )

    transcript = result["text"].strip()
    chunks = result.get("chunks", [])

    if MISHKAL_AVAILABLE:
        transcript_with_harakat = tashkeel.tashkeel(transcript)
    else:
        transcript_with_harakat = transcript

    return {
        "transcript": transcript_with_harakat,
        "raw": transcript,
        "chunks": chunks
    }

@app.get("/health")
def health():
    return {"status": "ok"}

