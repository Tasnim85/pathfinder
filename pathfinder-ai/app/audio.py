"""Audio input: Whisper small transcription + the guard that removes 'years of experience' the speaker never said.
From notebook cells 149 (years_stated) and 186 (transcribe_audio). The ASR model is loaded once and kept resident."""
import re
from pathlib import Path

from num2words import num2words

AUDIO_EXT = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm"}
AUDIO_LANG = "en"
MIN_WORDS = 15
ASR_NAME = "openai/whisper-small"

_NUMW = [num2words(i) for i in range(1, 61)]
_YEARS_RE = re.compile(r"\b(\d+|" + "|".join(map(re.escape, _NUMW)) + r")\s+years?\b", re.I)
_pipe = None


def years_stated(text):
    return bool(_YEARS_RE.search(text))


def load_asr():
    global _pipe
    if _pipe is None:
        import torch
        from transformers import pipeline
        dev = 0 if torch.cuda.is_available() else -1
        _pipe = pipeline("automatic-speech-recognition", model=ASR_NAME, device=dev,
                         torch_dtype=torch.float16 if dev == 0 else torch.float32, chunk_length_s=30)
    return _pipe


def transcribe_audio(path, language=AUDIO_LANG):
    gen = {"task": "transcribe"}
    if language:
        gen["language"] = language
    text = load_asr()(str(Path(path)), generate_kwargs=gen)["text"].strip()
    if len(text.split()) < MIN_WORDS:
        raise ValueError(f"Audio too short or unreadable ({len(text.split())} words transcribed)")
    return text
