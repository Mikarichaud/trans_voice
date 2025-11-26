from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
from typing import Optional
import logging
import os
import tempfile
import time
from pathlib import Path

from services.speech_to_text import SpeechToTextService
from services.text_to_speech import TextToSpeechService

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="transVoicer API",
    description="API pour Speech-to-Text et Text-to-Speech",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

stt_service: Optional[SpeechToTextService] = None
tts_service: Optional[TextToSpeechService] = None


@app.on_event("startup")
async def startup_event():
    global stt_service, tts_service
    
    try:
        model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
        language = os.getenv("STT_LANGUAGE", "pt")
        preprocess = os.getenv("STT_PREPROCESS", "true").lower() == "true"
        
        stt_service = SpeechToTextService(
            model_size=model_size,
            language=language,
            preprocess=preprocess
        )
        logger.info("Service STT initialisé")
        
        tts_engine = os.getenv("TTS_ENGINE", "pyttsx3")
        tts_language = os.getenv("TTS_LANGUAGE", "fr")
        
        tts_service = TextToSpeechService(
            engine=tts_engine,
            language=tts_language
        )
        logger.info("Service TTS initialisé")
        
    except Exception as e:
        logger.error(f"Erreur lors de l'initialisation: {e}")
        raise


class TranscriptionRequest(BaseModel):
    language: Optional[str] = "pt"
    task: Optional[str] = "transcribe"
    temperature: Optional[float] = 0.0


class SynthesisRequest(BaseModel):
    text: str
    language: Optional[str] = "fr"
    engine: Optional[str] = None
    rate: Optional[int] = None
    volume: Optional[float] = None


@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "transVoicer API",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "stt_ready": stt_service is not None,
        "tts_ready": tts_service is not None
    }


@app.post("/api/stt/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form("pt"),
    task: str = Form("transcribe"),
    temperature: float = Form(0.0)
):
    if not stt_service:
        raise HTTPException(status_code=503, detail="Service STT non disponible")
    
    temp_file_path = None
    converted_file_path = None
    
    try:
        temp_file = tempfile.NamedTemporaryFile(
            delete=False,
            suffix=Path(file.filename).suffix if file.filename else ".webm"
        )
        temp_file_path = temp_file.name
        
        content = await file.read()
        
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Fichier audio vide")
        
        logger.info(f"Fichier reçu: {len(content)} bytes, type: {file.content_type}")
        
        temp_file.write(content)
        temp_file.flush()
        temp_file.close()
        
        if not os.path.exists(temp_file_path) or os.path.getsize(temp_file_path) == 0:
            raise HTTPException(status_code=400, detail="Fichier audio invalide ou vide")
        
        result = stt_service.transcribe(
            temp_file_path,
            task=task,
            temperature=temperature,
            condition_on_previous_text=False,
            initial_prompt=None
        )
        
        if temp_file_path.endswith('.webm'):
            wav_path = temp_file_path.rsplit('.', 1)[0] + '.wav'
            if os.path.exists(wav_path):
                converted_file_path = wav_path
        
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.error(f"Erreur lors de la transcription: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        cleanup_paths = []
        
        if temp_file_path and os.path.exists(temp_file_path):
            cleanup_paths.append(temp_file_path)
        
        if converted_file_path and os.path.exists(converted_file_path):
            cleanup_paths.append(converted_file_path)
        
        temp_dir = Path(tempfile.gettempdir()) / "trans_voice"
        if temp_dir.exists():
            current_time = time.time()
            for file in temp_dir.glob("audio_*.wav"):
                try:
                    file_time = file.stat().st_mtime
                    if current_time - file_time < 300:
                        cleanup_paths.append(str(file))
                except:
                    pass
        
        for path in cleanup_paths:
            try:
                if os.path.exists(path):
                    os.remove(path)
                    logger.debug(f"Fichier temporaire supprimé: {path}")
            except Exception as e:
                logger.warning(f"Impossible de supprimer {path}: {e}")


@app.post("/api/stt/transcribe-stream")
async def transcribe_stream(
    audio_data: bytes = File(...),
    language: str = Form("pt")
):
    if not stt_service:
        raise HTTPException(status_code=503, detail="Service STT non disponible")
    
    try:
        result = stt_service.transcribe_stream(audio_data)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Erreur lors de la transcription stream: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tts/synthesize")
async def synthesize_text(request: SynthesisRequest):
    if not tts_service:
        raise HTTPException(status_code=503, detail="Service TTS non disponible")
    
    try:
        if request.rate:
            tts_service.set_rate(request.rate)
        if request.volume:
            tts_service.set_volume(request.volume)
        if request.engine and request.engine != tts_service.engine_name:
            tts_service = TextToSpeechService(
                engine=request.engine,
                language=request.language or tts_service.language
            )
        
        audio_bytes, metadata = tts_service.synthesize(
            request.text,
            slow=False
        )
        
        mime_type = "audio/mpeg" if tts_service.engine_name == "gtts" else "audio/wav"
        
        return Response(
            content=audio_bytes,
            media_type=mime_type,
            headers={
                "X-Duration": str(metadata.get("duration", 0)),
                "X-Latency": str(metadata.get("latency", 0))
            }
        )
        
    except Exception as e:
        logger.error(f"Erreur lors de la synthèse: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tts/voices")
async def get_voices():
    if not tts_service:
        raise HTTPException(status_code=503, detail="Service TTS non disponible")
    
    try:
        voices = tts_service.get_available_voices()
        return {"voices": voices}
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des voix: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stt/info")
async def get_stt_info():
    if not stt_service:
        raise HTTPException(status_code=503, detail="Service STT non disponible")
    
    return stt_service.get_model_info()


@app.get("/api/tts/info")
async def get_tts_info():
    if not tts_service:
        raise HTTPException(status_code=503, detail="Service TTS non disponible")
    
    return tts_service.get_info()


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PYTHON_API_PORT", 8000))
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )
