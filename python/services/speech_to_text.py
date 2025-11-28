import whisper
import torch
import numpy as np
import librosa
import soundfile as sf
from pathlib import Path
from typing import Optional, Dict, Tuple
import logging
import time
import os
import re
import threading
import gc

from .audio_preprocessor import AudioPreprocessor

logger = logging.getLogger(__name__)

class SpeechToTextService:

    def __init__(
        self,
        model_size: str = "base",
        device: Optional[str] = None,
        language: str = "pt",
        preprocess: bool = True
    ):
        self.model_size = model_size
        self.language = language
        self.preprocess = preprocess

        if device is None:
            if torch.cuda.is_available():
                device = "cuda"
            else:
                device = "cpu"

        self.device = device
        if device == "cpu":
            logger.warning(" Utilisation du CPU")

        self.model = None
        self._load_model()

        self._transcribe_lock = threading.Lock()

        if self.preprocess:
            self.preprocessor = AudioPreprocessor(
                target_sr=16000,
                normalize=True,
                noise_reduction=True,
                vad_enabled=True
            )
        else:
            self.preprocessor = None

    def _load_model(self):
        try:
            logger.info(f"Chargement du modèle Whisper {self.model_size}...")
            self.model = whisper.load_model(self.model_size, device=self.device)
            logger.info("Modèle Whisper chargé avec succès")
        except Exception as e:
            logger.error(f"Erreur lors du chargement du modèle: {e}")
            raise

    def _reload_model(self):
        try:
            logger.warning("⚠️  Rechargement du modèle Whisper pour réinitialiser l'état...")
            del self.model
            if self.device == "cuda":
                torch.cuda.empty_cache()
            elif self.device == "mps" and hasattr(torch.mps, "empty_cache"):
                torch.mps.empty_cache()
            gc.collect()
            self._load_model()
            logger.info("✅ Modèle Whisper rechargé avec succès")
        except Exception as e:
            logger.error(f"Erreur lors du rechargement du modèle: {e}")
            raise

    def transcribe(
        self,
        audio_path: str,
        task: str = "transcribe",
        temperature: float = 0.0,
        beam_size: int = 5,
        best_of: int = 5,
        patience: float = 1.0,
        length_penalty: float = 1.0,
        suppress_tokens: str = "-1",
        initial_prompt: Optional[str] = None,
        condition_on_previous_text: bool = False,
        word_timestamps: bool = False
    ) -> Dict:
        start_time = time.time()
        original_audio_path = audio_path
        preprocessed_path = None
        converted_path = None

        try:
            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Fichier audio non trouvé: {audio_path}")

            file_size = os.path.getsize(audio_path)
            logger.info(f"Transcription de {audio_path} ({file_size} bytes)")

            if file_size == 0:
                raise ValueError("Fichier audio vide")

            logger.info(f"Vérification du format pour: {audio_path}")
            converted_path = self._ensure_format(audio_path)
            if converted_path != audio_path:
                audio_path = converted_path
                logger.info(f"Fichier converti: {audio_path}")

            if False and self.preprocess and self.preprocessor:
                preprocessed_path = self._get_temp_path(audio_path)
                try:
                    audio, sr = self.preprocessor.preprocess(audio_path, preprocessed_path)
                    if os.path.exists(preprocessed_path) and os.path.getsize(preprocessed_path) > 0:
                        test_audio, test_sr = librosa.load(preprocessed_path, sr=None, duration=0.1)
                        if len(test_audio) > 0:
                            audio_path = preprocessed_path
                            logger.info(f"Fichier pré-traité: {audio_path}")
                        else:
                            logger.warning("Fichier pré-traité invalide, utilisation du fichier original")
                            if os.path.exists(preprocessed_path):
                                os.remove(preprocessed_path)
                            preprocessed_path = None
                    else:
                        logger.warning("Fichier pré-traité vide, utilisation du fichier original")
                        if preprocessed_path and os.path.exists(preprocessed_path):
                            os.remove(preprocessed_path)
                        preprocessed_path = None
                except Exception as e:
                    logger.error(f"Erreur lors du pré-traitement: {e}, utilisation du fichier original")
                    if preprocessed_path and os.path.exists(preprocessed_path):
                        try:
                            os.remove(preprocessed_path)
                        except:
                            pass
                    preprocessed_path = None

            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Fichier audio final non trouvé: {audio_path}")

            final_file_size = os.path.getsize(audio_path)
            logger.info(f"Fichier audio final pour transcription: {audio_path} ({final_file_size} bytes)")

            if final_file_size == 0:
                raise ValueError(f"Fichier audio final vide: {audio_path}")

            try:
                test_audio, test_sr = librosa.load(audio_path, sr=None, duration=0.1)
                logger.info(f"Fichier audio valide: {len(test_audio)} échantillons à {test_sr}Hz")
                if len(test_audio) == 0:
                    raise ValueError(f"Fichier audio ne contient aucun échantillon: {audio_path}")
            except Exception as e:
                logger.error(f"Erreur lors de la vérification du fichier audio: {e}")
                raise ValueError(f"Fichier audio invalide ou corrompu: {audio_path}")

            decode_options = {
                "language": self.language,
                "task": task,
                "temperature": 0.0,
                "beam_size": beam_size,
                "best_of": best_of,
                "patience": patience,
                "length_penalty": length_penalty,
                "suppress_tokens": suppress_tokens,
                "condition_on_previous_text": False,
                "word_timestamps": word_timestamps,
                "no_speech_threshold": 0.6,
                "compression_ratio_threshold": 2.4,
                "logprob_threshold": -1.0,
                "initial_prompt": None,
            }

            logger.info(f"Transcription de {audio_path} avec Whisper...")

            logger.info("🔄 Rechargement du modèle Whisper pour garantir un état propre...")
            self._reload_model()

            with self._transcribe_lock:
                if self.device == "cuda":
                    torch.cuda.empty_cache()
                elif self.device == "mps" and hasattr(torch.mps, "empty_cache"):
                    torch.mps.empty_cache()

                gc.collect()

                fresh_decode_options = decode_options.copy()

                import hashlib
                with open(audio_path, 'rb') as f:
                    file_hash = hashlib.md5(f.read()).hexdigest()
                logger.info(f"Hash MD5 du fichier audio: {file_hash[:16]}...")

                if "suppress_blank" not in fresh_decode_options:
                    fresh_decode_options["suppress_blank"] = True

                logger.info(f"Options de transcription: {list(fresh_decode_options.keys())}")

                try:
                    logger.info(f"Chargement de l'audio avec librosa pour Whisper...")
                    audio_array, audio_sr = librosa.load(audio_path, sr=16000, mono=True)
                    audio_duration = len(audio_array) / audio_sr
                    logger.info(f"Audio chargé: {len(audio_array)} échantillons à {audio_sr}Hz = {audio_duration:.2f}s")

                    if len(audio_array) == 0:
                        raise ValueError("Audio vide après chargement avec librosa")

                    if audio_duration < 0.5:
                        raise ValueError(f"Audio trop court: {audio_duration:.2f}s (minimum 0.5s)")

                    max_amplitude = np.max(np.abs(audio_array))
                    if max_amplitude < 0.01:
                        logger.warning(f"Audio très silencieux (amplitude max: {max_amplitude:.4f})")

                    logger.info(f"Envoi de l'audio à Whisper (durée: {audio_duration:.2f}s)...")
                    result = self.model.transcribe(
                        audio_array,
                        **fresh_decode_options
                    )
                except Exception as e:
                    logger.warning(f"Erreur lors du chargement avec librosa, tentative avec chemin de fichier: {e}")
                    result = self.model.transcribe(
                        audio_path,
                        **fresh_decode_options
                    )

                if self.device == "cuda":
                    torch.cuda.empty_cache()
                elif self.device == "mps" and hasattr(torch.mps, "empty_cache"):
                    torch.mps.empty_cache()

                gc.collect()

            if not result or "text" not in result:
                raise ValueError("Whisper n'a retourné aucun résultat")

            logger.info(f"Résultat Whisper brut: {result.get('text', '')[:100]}")

            latency = time.time() - start_time

            text = result.get("text", "").strip()

            text = re.sub(r'<\|[^|]+\|>', '', text)
            text = text.strip()

            if len(text) > 10:
                repeated_pattern = re.search(r'(.)\1{4,}', text)
                if repeated_pattern:
                    repeated_char = repeated_pattern.group(1)
                    logger.error(f"❌ PROBLÈME: Répétitions suspectes détectées même après rechargement!")
                    logger.error(f"❌ Caractère répété: '{repeated_char}'")
                    logger.error(f"❌ Texte complet: {text[:200]}")

                    text_cleaned = re.sub(r'(.)\1{2,}', r'\1\1', text)
                    if text_cleaned != text:
                        logger.warning(f"⚠️  Tentative de nettoyage: {text_cleaned[:100]}")
                        text = text_cleaned
                    else:
                        logger.error(f"❌ Transcription trop corrompue, impossible de nettoyer")
                        raise ValueError(f"Transcription corrompue avec répétitions: {text[:100]}")

            logger.info(f"✅ Texte transcrit (premiers 100 caractères): {text[:100]}")
            logger.info(f"✅ Longueur du texte: {len(text)} caractères, {len(text.split())} mots")

            word_count = len(text.split()) if text else 0

            def clean_segment(seg):
                cleaned = {}
                for key, value in seg.items():
                    if isinstance(value, (int, float)):
                        if np.isnan(value) or np.isinf(value):
                            cleaned[key] = 0.0 if key in ['start', 'end', 'temperature', 'avg_logprob', 'compression_ratio', 'no_speech_prob'] else None
                        else:
                            cleaned[key] = float(value) if isinstance(value, (np.float32, np.float64)) else value
                    elif isinstance(value, list):
                        cleaned[key] = [v for v in value if v is not None and not (isinstance(v, float) and (np.isnan(v) or np.isinf(v)))]
                    else:
                        cleaned[key] = value
                return cleaned

            segments_cleaned = [clean_segment(seg) for seg in result.get("segments", [])]

            if np.isnan(latency) or np.isinf(latency):
                latency = 0.0

            return {
                "text": text,
                "language": result.get("language", self.language),
                "segments": segments_cleaned,
                "latency": float(latency) if not np.isnan(latency) else 0.0,
                "word_count": word_count,
                "model_size": self.model_size,
                "device": self.device
            }

        except Exception as e:
            logger.error(f"Erreur lors de la transcription: {e}")
            raise
        finally:
            cleanup_paths = []

            if preprocessed_path and os.path.exists(preprocessed_path):
                cleanup_paths.append(preprocessed_path)

            if converted_path and converted_path != original_audio_path and os.path.exists(converted_path):
                if converted_path != preprocessed_path:
                    cleanup_paths.append(converted_path)

            for path in cleanup_paths:
                try:
                    if os.path.exists(path):
                        os.remove(path)
                        logger.debug(f"Fichier temporaire supprimé: {path}")
                except Exception as e:
                    logger.warning(f"Impossible de supprimer {path}: {e}")

    def transcribe_stream(
        self,
        audio_buffer: bytes,
        format: str = "webm"
    ) -> Dict:
        temp_path = self._get_temp_path(f"stream.{format}")

        try:
            with open(temp_path, "wb") as f:
                f.write(audio_buffer)

            return self.transcribe(temp_path)

        finally:
            cleanup_paths = []

            if temp_path and os.path.exists(temp_path):
                cleanup_paths.append(temp_path)

            if temp_path:
                import tempfile
                temp_dir = Path(tempfile.gettempdir()) / "trans_voice"
                if temp_dir.exists():
                    current_time = time.time()
                    for file in temp_dir.glob("audio_*.wav"):
                        try:
                            file_time = file.stat().st_mtime
                            if current_time - file_time < 120:
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

    def _ensure_format(self, audio_path: str) -> str:
        if audio_path.endswith('.wav'):
            return audio_path

        try:
            from pydub import AudioSegment

            wav_path = audio_path.rsplit('.', 1)[0] + '.wav'

            ext = Path(audio_path).suffix.lower()
            if ext == '.webm':
                audio_format = 'webm'
            elif ext == '.mp3':
                audio_format = 'mp3'
            elif ext == '.m4a':
                audio_format = 'm4a'
            elif ext == '.ogg':
                audio_format = 'ogg'
            else:
                audio_format = ext[1:] if ext else 'webm'

            logger.info(f"Conversion de {audio_path} ({audio_format}) en WAV...")
            audio = AudioSegment.from_file(audio_path, format=audio_format)

            duration_ms = len(audio)
            duration_sec = duration_ms / 1000.0
            logger.info(f"Durée audio source: {duration_sec:.2f}s ({duration_ms}ms)")

            if duration_sec < 0.5:
                raise ValueError(f"Fichier audio trop court: {duration_sec:.2f}s (minimum 0.5s)")

            audio = audio.set_channels(1)
            audio = audio.set_frame_rate(16000)
            audio.export(wav_path, format="wav")

            wav_size = os.path.getsize(wav_path)
            expected_min_size = int(duration_sec * 16000 * 2 * 0.8)
            logger.info(f"Fichier converti: {wav_path} ({wav_size} bytes, attendu: >{expected_min_size} bytes)")

            if wav_size < expected_min_size:
                raise ValueError(f"Fichier WAV converti trop petit: {wav_size} bytes (attendu: >{expected_min_size} bytes). Conversion incomplète.")

            try:
                test_audio, test_sr = librosa.load(wav_path, sr=None)
                test_duration = len(test_audio) / test_sr
                logger.info(f"Vérification finale WAV: {len(test_audio)} échantillons à {test_sr}Hz = {test_duration:.2f}s")

                if test_duration < duration_sec * 0.7:
                    raise ValueError(f"Durée WAV incorrecte: {test_duration:.2f}s vs {duration_sec:.2f}s attendus")
            except Exception as e:
                logger.error(f"Erreur lors de la vérification du WAV: {e}")
                if os.path.exists(wav_path):
                    os.remove(wav_path)
                raise

            if wav_path != audio_path and os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                except:
                    pass

            return wav_path
        except ImportError:
            logger.warning("pydub non disponible, tentative avec librosa...")
            try:
                audio, sr = librosa.load(audio_path, sr=16000, mono=True)
                wav_path = audio_path.rsplit('.', 1)[0] + '.wav'
                sf.write(wav_path, audio, sr)

                if wav_path != audio_path and os.path.exists(audio_path):
                    try:
                        os.remove(audio_path)
                    except:
                        pass

                return wav_path
            except Exception as e:
                logger.error(f"Impossible de convertir {audio_path} en WAV: {e}")
                raise
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Erreur lors de la conversion {audio_path} en WAV: {error_msg}")

            if "ffmpeg" in error_msg.lower() or "No such file" in error_msg or "not found" in error_msg.lower():
                logger.error("ffmpeg n'est pas installé ou non trouvé dans le PATH")
                logger.error("Installez ffmpeg: brew install ffmpeg (macOS) ou apt-get install ffmpeg (Linux)")
                raise RuntimeError(
                    "ffmpeg est requis pour convertir les fichiers audio. "
                    "Installez-le avec: brew install ffmpeg (macOS) ou apt-get install ffmpeg (Linux)"
                )

            logger.error(f"Impossible de convertir {audio_path}. Le format .webm nécessite une conversion en WAV.")
            raise RuntimeError(
                f"Impossible de convertir le fichier audio {audio_path} en WAV. "
                f"Erreur: {error_msg}"
            )

    def _get_temp_path(self, original_path: str) -> str:
        import tempfile
        temp_dir = Path(tempfile.gettempdir()) / "trans_voice"
        temp_dir.mkdir(exist_ok=True)

        ext = Path(original_path).suffix or ".wav"
        return str(temp_dir / f"audio_{int(time.time() * 1000)}{ext}")

    def calculate_wer(self, reference: str, hypothesis: str) -> float:
        ref_words = reference.lower().split()
        hyp_words = hypothesis.lower().split()

        n = len(ref_words)
        m = len(hyp_words)

        dp = [[0] * (m + 1) for _ in range(n + 1)]

        for i in range(n + 1):
            dp[i][0] = i
        for j in range(m + 1):
            dp[0][j] = j

        for i in range(1, n + 1):
            for j in range(1, m + 1):
                if ref_words[i - 1] == hyp_words[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1]
                else:
                    dp[i][j] = min(
                        dp[i - 1][j] + 1,
                        dp[i][j - 1] + 1,
                        dp[i - 1][j - 1] + 1
                    )

        errors = dp[n][m]
        wer = errors / n if n > 0 else 0.0

        return wer

    def get_model_info(self) -> Dict:
        return {
            "model_size": self.model_size,
            "device": self.device,
            "language": self.language,
            "preprocessing": self.preprocess
        }
