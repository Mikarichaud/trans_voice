import pyttsx3
from gtts import gTTS
import io
import os
import logging
import time
from pathlib import Path
from typing import Optional, Dict, Tuple
import tempfile

logger = logging.getLogger(__name__)

class TextToSpeechService:

    def __init__(
        self,
        engine: str = "pyttsx3",
        language: str = "fr",
        voice_id: Optional[str] = None,
        rate: int = 150,
        volume: float = 1.0
    ):
        self.engine_name = engine
        self.language = language
        self.rate = rate
        self.volume = volume
        self.voice_id = voice_id

        if engine == "pyttsx3":
            self._init_pyttsx3()
        elif engine == "gtts":
            self._init_gtts()
        else:
            raise ValueError(f"Moteur TTS non supporté: {engine}")

    def _init_pyttsx3(self):
        try:
            self.engine = pyttsx3.init()

            self.engine.setProperty('rate', self.rate)

            self.engine.setProperty('volume', self.volume)

            voices = self.engine.getProperty('voices')
            if voices:
                target_voice = None
                for voice in voices:
                    if self.language in voice.languages or self.language[:2] in str(voice.languages):
                        target_voice = voice.id
                        break

                if not target_voice and voices:
                    target_voice = voices[0].id

                if self.voice_id:
                    target_voice = self.voice_id

                if target_voice:
                    self.engine.setProperty('voice', target_voice)
                    logger.info(f"Voix sélectionnée: {target_voice}")

            logger.info("Moteur pyttsx3 initialisé")

        except Exception as e:
            logger.error(f"Erreur lors de l'initialisation de pyttsx3: {e}")
            raise

    def _init_gtts(self):
        logger.info("Moteur gTTS prêt (nécessite internet)")

    def synthesize(
        self,
        text: str,
        output_path: Optional[str] = None,
        slow: bool = False
    ) -> Tuple[bytes, Dict]:
        start_time = time.time()

        if not text or not text.strip():
            raise ValueError("Texte vide")

        if self.engine_name == "pyttsx3":
            return self._synthesize_pyttsx3(text, output_path)
        elif self.engine_name == "gtts":
            return self._synthesize_gtts(text, output_path, slow)
        else:
            raise ValueError(f"Moteur {self.engine_name} non implémenté")

    def _synthesize_pyttsx3(
        self,
        text: str,
        output_path: Optional[str] = None
    ) -> Tuple[bytes, Dict]:
        start_time = time.time()
        try:
            if not output_path:
                temp_file = tempfile.NamedTemporaryFile(
                    suffix='.wav',
                    delete=False
                )
                output_path = temp_file.name
                temp_file.close()

            self.engine.save_to_file(text, output_path)
            self.engine.runAndWait()

            with open(output_path, 'rb') as f:
                audio_bytes = f.read()

            duration = len(audio_bytes) / 16000 / 2

            latency = time.time() - start_time

            metadata = {
                "engine": "pyttsx3",
                "language": self.language,
                "duration": duration,
                "latency": latency,
                "text_length": len(text),
                "word_count": len(text.split())
            }

            if not output_path or output_path.startswith(tempfile.gettempdir()):
                try:
                    os.remove(output_path)
                except:
                    pass

            return audio_bytes, metadata

        except Exception as e:
            logger.error(f"Erreur lors de la synthèse pyttsx3: {e}")
            raise

    def _synthesize_gtts(
        self,
        text: str,
        output_path: Optional[str] = None,
        slow: bool = False
    ) -> Tuple[bytes, Dict]:
        start_time = time.time()
        try:
            if not output_path:
                temp_file = tempfile.NamedTemporaryFile(
                    suffix='.mp3',
                    delete=False
                )
                output_path = temp_file.name
                temp_file.close()

            tts = gTTS(text=text, lang=self.language, slow=slow)
            tts.save(output_path)

            with open(output_path, 'rb') as f:
                audio_bytes = f.read()

            duration = len(audio_bytes) / 16000 / 2

            latency = time.time() - start_time

            metadata = {
                "engine": "gTTS",
                "language": self.language,
                "duration": duration,
                "latency": latency,
                "text_length": len(text),
                "word_count": len(text.split())
            }

            if output_path.startswith(tempfile.gettempdir()):
                try:
                    os.remove(output_path)
                except:
                    pass

            return audio_bytes, metadata

        except Exception as e:
            logger.error(f"Erreur lors de la synthèse gTTS: {e}")
            raise

    def get_available_voices(self) -> list:
        if self.engine_name == "pyttsx3":
            voices = self.engine.getProperty('voices')
            return [
                {
                    "id": voice.id,
                    "name": voice.name,
                    "languages": voice.languages,
                    "gender": getattr(voice, 'gender', 'unknown')
                }
                for voice in voices
            ]
        elif self.engine_name == "gtts":
            return [
                {"id": "default", "name": f"gTTS {self.language}", "languages": [self.language]}
            ]
        else:
            return []

    def set_voice(self, voice_id: str):
        if self.engine_name == "pyttsx3":
            self.engine.setProperty('voice', voice_id)
            self.voice_id = voice_id
        else:
            logger.warning(f"Changement de voix non supporté pour {self.engine_name}")

    def set_rate(self, rate: int):
        if self.engine_name == "pyttsx3":
            self.engine.setProperty('rate', rate)
        self.rate = rate

    def set_volume(self, volume: float):
        if self.engine_name == "pyttsx3":
            self.engine.setProperty('volume', volume)
        self.volume = volume

    def get_info(self) -> Dict:
        return {
            "engine": self.engine_name,
            "language": self.language,
            "rate": self.rate,
            "volume": self.volume,
            "voice_id": self.voice_id
        }
