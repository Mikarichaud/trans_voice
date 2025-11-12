"""
Service Speech-to-Text utilisant Whisper (modèle local)
Avec support pour différents modèles et langues
Note: Le package 'openai-whisper' est le modèle Whisper utilisé localement, pas via API
"""

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
    """Service de reconnaissance vocale avec Whisper"""
    
    def __init__(
        self,
        model_size: str = "base",
        device: Optional[str] = None,
        language: str = "pt",
        preprocess: bool = True
    ):
        """
        Args:
            model_size: Taille du modèle Whisper ("tiny", "base", "small", "medium", "large")
            device: Device PyTorch ("cpu", "cuda", "mps")
            language: Code langue ISO 639-1 (ex: "pt", "fr", "en")
            preprocess: Activer le pré-traitement audio
        """
        self.model_size = model_size
        self.language = language
        self.preprocess = preprocess
        
        # Déterminer le device
        # NOTE: Désactiver MPS temporairement car il cause des problèmes avec Whisper
        # (hallucinations avec "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        if device is None:
            if torch.cuda.is_available():
                device = "cuda"
            # elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            #     device = "mps"  # DÉSACTIVÉ temporairement
            else:
                device = "cpu"
        
        self.device = device
        if device == "cpu":
            logger.warning("⚠️  Utilisation de CPU (MPS désactivé pour éviter les problèmes avec Whisper)")
        logger.info(f"Initialisation STT avec modèle {model_size} sur {device}")
        
        # Charger le modèle Whisper
        self.model = None
        self._load_model()
        
        # Lock pour s'assurer qu'une seule transcription se fait à la fois
        # Cela évite les problèmes d'état partagé dans Whisper
        self._transcribe_lock = threading.Lock()
        
        # Initialiser le pré-processeur
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
        """Charge le modèle Whisper"""
        try:
            logger.info(f"Chargement du modèle Whisper {self.model_size}...")
            self.model = whisper.load_model(self.model_size, device=self.device)
            logger.info("Modèle Whisper chargé avec succès")
        except Exception as e:
            logger.error(f"Erreur lors du chargement du modèle: {e}")
            raise
    
    def _reload_model(self):
        """Recharge le modèle Whisper (pour réinitialiser l'état interne)"""
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
        condition_on_previous_text: bool = False,  # False pour éviter les problèmes de contexte entre fichiers différents
        word_timestamps: bool = False
    ) -> Dict:
        """
        Transcrit un fichier audio
        
        Args:
            audio_path: Chemin vers le fichier audio
            task: "transcribe" ou "translate"
            temperature: Température pour le sampling (0.0 = déterministe)
            beam_size: Taille du beam search
            best_of: Nombre de candidats à générer
            patience: Patience pour le beam search
            length_penalty: Pénalité de longueur
            suppress_tokens: Tokens à supprimer
            initial_prompt: Prompt initial pour guider la transcription
            condition_on_previous_text: Conditionner sur le texte précédent
            word_timestamps: Inclure les timestamps par mot
        
        Returns:
            Dict avec 'text', 'segments', 'language', 'latency', etc.
        """
        start_time = time.time()
        original_audio_path = audio_path  # Sauvegarder le chemin original
        preprocessed_path = None
        converted_path = None
        
        try:
            # Vérifier que le fichier existe et n'est pas vide
            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Fichier audio non trouvé: {audio_path}")
            
            file_size = os.path.getsize(audio_path)
            logger.info(f"Transcription de {audio_path} ({file_size} bytes)")
            
            if file_size == 0:
                raise ValueError("Fichier audio vide")
            
            # TOUJOURS convertir le format en premier (même si préprocesseur activé)
            logger.info(f"Vérification du format pour: {audio_path}")
            converted_path = self._ensure_format(audio_path)
            if converted_path != audio_path:
                audio_path = converted_path
                logger.info(f"Fichier converti: {audio_path}")
            
            # Pré-traitement si activé (après conversion)
            # TEMPORAIREMENT DÉSACTIVÉ pour tester si c'est la cause du problème
            # Le préprocesseur pourrait corrompre l'audio et causer les répétitions "A A A A..."
            if False and self.preprocess and self.preprocessor:  # DÉSACTIVÉ temporairement
                preprocessed_path = self._get_temp_path(audio_path)
                try:
                    audio, sr = self.preprocessor.preprocess(audio_path, preprocessed_path)
                    # Vérifier que le fichier pré-traité est valide
                    if os.path.exists(preprocessed_path) and os.path.getsize(preprocessed_path) > 0:
                        # Vérifier rapidement avec librosa
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
            
            # Vérifier que le fichier audio final existe et n'est pas vide
            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Fichier audio final non trouvé: {audio_path}")
            
            final_file_size = os.path.getsize(audio_path)
            logger.info(f"Fichier audio final pour transcription: {audio_path} ({final_file_size} bytes)")
            
            if final_file_size == 0:
                raise ValueError(f"Fichier audio final vide: {audio_path}")
            
            # Vérifier rapidement le contenu audio avec librosa pour s'assurer qu'il est valide
            try:
                test_audio, test_sr = librosa.load(audio_path, sr=None, duration=0.1)  # Charger seulement 0.1s pour vérifier
                logger.info(f"Fichier audio valide: {len(test_audio)} échantillons à {test_sr}Hz")
                if len(test_audio) == 0:
                    raise ValueError(f"Fichier audio ne contient aucun échantillon: {audio_path}")
            except Exception as e:
                logger.error(f"Erreur lors de la vérification du fichier audio: {e}")
                raise ValueError(f"Fichier audio invalide ou corrompu: {audio_path}")
            
            # Options de transcription - FORCER un contexte vierge pour éviter les problèmes
            # Utiliser des paramètres stricts pour éviter les répétitions et les hallucinations
            decode_options = {
                "language": self.language,
                "task": task,
                "temperature": 0.0,  # FORCER à 0.0 pour être déterministe
                "beam_size": beam_size,
                "best_of": best_of,
                "patience": patience,
                "length_penalty": length_penalty,
                "suppress_tokens": suppress_tokens,
                "condition_on_previous_text": False,  # FORCER à False pour éviter le contexte persistant
                "word_timestamps": word_timestamps,
                "no_speech_threshold": 0.6,  # Seuil pour détecter si c'est de la parole
                "compression_ratio_threshold": 2.4,  # Seuil de compression pour détecter les répétitions (plus strict)
                "logprob_threshold": -1.0,  # Seuil de probabilité de log
                "initial_prompt": None,  # FORCER à None explicitement
            }
            
            # Ne pas utiliser initial_prompt pour éviter tout contexte
            # if initial_prompt:
            #     decode_options["initial_prompt"] = initial_prompt
            
            # Transcription avec lock pour éviter les problèmes d'état partagé
            logger.info(f"Transcription de {audio_path} avec Whisper...")
            
            # SOLUTION RADICALE: Recharger le modèle AVANT chaque transcription
            # Cela garantit un état propre et évite tous les problèmes d'état persistant
            # (Même si c'est plus coûteux, c'est la seule solution fiable)
            logger.info("🔄 Rechargement du modèle Whisper pour garantir un état propre...")
            self._reload_model()
            
            # Utiliser un lock pour s'assurer qu'une seule transcription se fait à la fois
            # Cela évite que Whisper garde un état entre les appels
            with self._transcribe_lock:
                # Vider le cache PyTorch avant la transcription pour éviter les problèmes d'état
                if self.device == "cuda":
                    torch.cuda.empty_cache()
                elif self.device == "mps" and hasattr(torch.mps, "empty_cache"):
                    torch.mps.empty_cache()
                
                # Forcer un garbage collection pour nettoyer la mémoire
                gc.collect()
                
                # Transcription
                # IMPORTANT: Créer une copie fraîche des options pour éviter tout état partagé
                fresh_decode_options = decode_options.copy()
                
                # Calculer un hash du fichier pour le logging (mais ne pas l'utiliser pour la logique)
                import hashlib
                with open(audio_path, 'rb') as f:
                    file_hash = hashlib.md5(f.read()).hexdigest()
                logger.info(f"Hash MD5 du fichier audio: {file_hash[:16]}...")
                
                # SOLUTION: Forcer Whisper à utiliser un nouveau contexte en passant explicitement
                # tous les paramètres et en s'assurant qu'aucun état n'est réutilisé
                # Utiliser suppress_blank=True pour éviter les répétitions de caractères vides
                if "suppress_blank" not in fresh_decode_options:
                    fresh_decode_options["suppress_blank"] = True
                
                # Transcription avec options strictes
                logger.info(f"Options de transcription: {list(fresh_decode_options.keys())}")
                
                # SOLUTION: Charger l'audio avec librosa et le passer directement à Whisper
                # Cela évite les problèmes de compatibilité avec ffmpeg et les fichiers WAV générés par pydub
                try:
                    logger.info(f"Chargement de l'audio avec librosa pour Whisper...")
                    audio_array, audio_sr = librosa.load(audio_path, sr=16000, mono=True)
                    audio_duration = len(audio_array) / audio_sr
                    logger.info(f"Audio chargé: {len(audio_array)} échantillons à {audio_sr}Hz = {audio_duration:.2f}s")
                    
                    # Vérifier que l'audio est valide
                    if len(audio_array) == 0:
                        raise ValueError("Audio vide après chargement avec librosa")
                    
                    if audio_duration < 0.5:
                        raise ValueError(f"Audio trop court: {audio_duration:.2f}s (minimum 0.5s)")
                    
                    # Vérifier que l'audio n'est pas silencieux (au moins 1% de l'amplitude max)
                    max_amplitude = np.max(np.abs(audio_array))
                    if max_amplitude < 0.01:
                        logger.warning(f"Audio très silencieux (amplitude max: {max_amplitude:.4f})")
                    
                    # Passer l'array numpy directement à Whisper au lieu du chemin de fichier
                    logger.info(f"Envoi de l'audio à Whisper (durée: {audio_duration:.2f}s)...")
                    result = self.model.transcribe(
                        audio_array,
                        **fresh_decode_options
                    )
                except Exception as e:
                    logger.warning(f"Erreur lors du chargement avec librosa, tentative avec chemin de fichier: {e}")
                    # Fallback: utiliser le chemin de fichier directement
                    result = self.model.transcribe(
                        audio_path,
                        **fresh_decode_options
                    )
                
                # Vider le cache après la transcription aussi
                if self.device == "cuda":
                    torch.cuda.empty_cache()
                elif self.device == "mps" and hasattr(torch.mps, "empty_cache"):
                    torch.mps.empty_cache()
                
                # Forcer un garbage collection après
                gc.collect()
            
            # Vérifier le résultat
            if not result or "text" not in result:
                raise ValueError("Whisper n'a retourné aucun résultat")
            
            logger.info(f"Résultat Whisper brut: {result.get('text', '')[:100]}")
            
            latency = time.time() - start_time
            
            # Calculer des métriques
            text = result.get("text", "").strip()
            
            # Nettoyer les tokens spéciaux de Whisper (<|pt|>, <|transcribe|>, etc.)
            text = re.sub(r'<\|[^|]+\|>', '', text)  # Supprimer les tokens <|xxx|>
            text = text.strip()
            
            # Vérifier le résultat (détection des répétitions devenue moins nécessaire
            # car on recharge le modèle avant chaque transcription, mais on garde la vérification)
            if len(text) > 10:
                # Compter les répétitions de caractères consécutifs (5+ répétitions)
                repeated_pattern = re.search(r'(.)\1{4,}', text)
                if repeated_pattern:
                    repeated_char = repeated_pattern.group(1)
                    logger.error(f"❌ PROBLÈME: Répétitions suspectes détectées même après rechargement!")
                    logger.error(f"❌ Caractère répété: '{repeated_char}'")
                    logger.error(f"❌ Texte complet: {text[:200]}")
                    
                    # Essayer de nettoyer en supprimant les répétitions excessives (garder max 2 répétitions)
                    text_cleaned = re.sub(r'(.)\1{2,}', r'\1\1', text)
                    if text_cleaned != text:
                        logger.warning(f"⚠️  Tentative de nettoyage: {text_cleaned[:100]}")
                        text = text_cleaned
                    else:
                        # Si le nettoyage n'aide pas, c'est vraiment corrompu
                        logger.error(f"❌ Transcription trop corrompue, impossible de nettoyer")
                        raise ValueError(f"Transcription corrompue avec répétitions: {text[:100]}")
            
            # Log pour déboguer
            logger.info(f"✅ Texte transcrit (premiers 100 caractères): {text[:100]}")
            logger.info(f"✅ Longueur du texte: {len(text)} caractères, {len(text.split())} mots")
            
            word_count = len(text.split()) if text else 0
            
            # Nettoyer les segments pour éliminer les valeurs NaN (non JSON-compliant)
            def clean_segment(seg):
                """Nettoie un segment en remplaçant les NaN par None ou 0"""
                cleaned = {}
                for key, value in seg.items():
                    if isinstance(value, (int, float)):
                        if np.isnan(value) or np.isinf(value):
                            cleaned[key] = 0.0 if key in ['start', 'end', 'temperature', 'avg_logprob', 'compression_ratio', 'no_speech_prob'] else None
                        else:
                            cleaned[key] = float(value) if isinstance(value, (np.float32, np.float64)) else value
                    elif isinstance(value, list):
                        # Nettoyer les listes (tokens, etc.)
                        cleaned[key] = [v for v in value if v is not None and not (isinstance(v, float) and (np.isnan(v) or np.isinf(v)))]
                    else:
                        cleaned[key] = value
                return cleaned
            
            segments_cleaned = [clean_segment(seg) for seg in result.get("segments", [])]
            
            # S'assurer que latency n'est pas NaN
            if np.isnan(latency) or np.isinf(latency):
                latency = 0.0
            
            # Calculer le WER approximatif (nécessiterait une référence)
            # Pour l'instant, on retourne juste les métriques disponibles
            
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
            # Nettoyer les fichiers temporaires (même en cas d'erreur)
            cleanup_paths = []
            
            # Nettoyer le fichier pré-traité s'il existe
            if preprocessed_path and os.path.exists(preprocessed_path):
                cleanup_paths.append(preprocessed_path)
            
            # Nettoyer le fichier converti s'il est différent de l'original
            if converted_path and converted_path != original_audio_path and os.path.exists(converted_path):
                # Vérifier que ce n'est pas le fichier pré-traité
                if converted_path != preprocessed_path:
                    cleanup_paths.append(converted_path)
            
            # Supprimer tous les fichiers temporaires
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
        """
        Transcrit un buffer audio en mémoire
        
        Args:
            audio_buffer: Buffer audio (bytes)
            format: Format audio ("webm", "wav", "mp3", etc.)
        
        Returns:
            Dict avec la transcription
        """
        # Sauvegarder temporairement
        temp_path = self._get_temp_path(f"stream.{format}")
        
        try:
            with open(temp_path, "wb") as f:
                f.write(audio_buffer)
            
            return self.transcribe(temp_path)
            
        finally:
            # Nettoyer les fichiers temporaires
            cleanup_paths = []
            
            if temp_path and os.path.exists(temp_path):
                cleanup_paths.append(temp_path)
            
            # Nettoyer aussi les fichiers pré-traités potentiels
            if temp_path:
                import tempfile
                temp_dir = Path(tempfile.gettempdir()) / "trans_voice"
                if temp_dir.exists():
                    # Nettoyer les fichiers récents (moins de 2 minutes) qui pourraient être liés
                    current_time = time.time()
                    for file in temp_dir.glob("audio_*.wav"):
                        try:
                            file_time = file.stat().st_mtime
                            if current_time - file_time < 120:  # Fichiers de moins de 2 minutes
                                cleanup_paths.append(str(file))
                        except:
                            pass
            
            # Supprimer tous les fichiers
            for path in cleanup_paths:
                try:
                    if os.path.exists(path):
                        os.remove(path)
                        logger.debug(f"Fichier temporaire supprimé: {path}")
                except Exception as e:
                    logger.warning(f"Impossible de supprimer {path}: {e}")
    
    def _ensure_format(self, audio_path: str) -> str:
        """Convertit l'audio en format WAV si nécessaire"""
        # Whisper peut gérer plusieurs formats, mais WAV est optimal
        if audio_path.endswith('.wav'):
            return audio_path
        
        # Convertir les formats non supportés (comme .webm) en WAV
        try:
            from pydub import AudioSegment
            
            # Créer le chemin du fichier WAV
            wav_path = audio_path.rsplit('.', 1)[0] + '.wav'
            
            # Détecter le format depuis l'extension
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
                audio_format = ext[1:] if ext else 'webm'  # Par défaut webm
            
            # Charger avec pydub (nécessite ffmpeg)
            logger.info(f"Conversion de {audio_path} ({audio_format}) en WAV...")
            audio = AudioSegment.from_file(audio_path, format=audio_format)
            
            # Vérifier la durée source
            duration_ms = len(audio)
            duration_sec = duration_ms / 1000.0
            logger.info(f"Durée audio source: {duration_sec:.2f}s ({duration_ms}ms)")
            
            if duration_sec < 0.5:
                raise ValueError(f"Fichier audio trop court: {duration_sec:.2f}s (minimum 0.5s)")
            
            # Exporter en WAV mono 16kHz
            audio = audio.set_channels(1)  # Mono
            audio = audio.set_frame_rate(16000)  # 16kHz
            audio.export(wav_path, format="wav")
            
            # Vérifier que le fichier WAV est valide
            wav_size = os.path.getsize(wav_path)
            expected_min_size = int(duration_sec * 16000 * 2 * 0.8)  # 80% de la taille attendue
            logger.info(f"Fichier converti: {wav_path} ({wav_size} bytes, attendu: >{expected_min_size} bytes)")
            
            if wav_size < expected_min_size:
                raise ValueError(f"Fichier WAV converti trop petit: {wav_size} bytes (attendu: >{expected_min_size} bytes). Conversion incomplète.")
            
            # Double vérification avec librosa
            try:
                test_audio, test_sr = librosa.load(wav_path, sr=None)
                test_duration = len(test_audio) / test_sr
                logger.info(f"Vérification finale WAV: {len(test_audio)} échantillons à {test_sr}Hz = {test_duration:.2f}s")
                
                # Vérifier que la durée correspond (tolérance de 30%)
                if test_duration < duration_sec * 0.7:
                    raise ValueError(f"Durée WAV incorrecte: {test_duration:.2f}s vs {duration_sec:.2f}s attendus")
            except Exception as e:
                logger.error(f"Erreur lors de la vérification du WAV: {e}")
                if os.path.exists(wav_path):
                    os.remove(wav_path)
                raise
            
            # Supprimer l'ancien fichier si différent
            if wav_path != audio_path and os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                except:
                    pass
            
            return wav_path
        except ImportError:
            logger.warning("pydub non disponible, tentative avec librosa...")
            try:
                # Fallback: utiliser librosa (nécessite ffmpeg système)
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
            
            # Vérifier si c'est un problème avec ffmpeg
            if "ffmpeg" in error_msg.lower() or "No such file" in error_msg or "not found" in error_msg.lower():
                logger.error("ffmpeg n'est pas installé ou non trouvé dans le PATH")
                logger.error("Installez ffmpeg: brew install ffmpeg (macOS) ou apt-get install ffmpeg (Linux)")
                raise RuntimeError(
                    "ffmpeg est requis pour convertir les fichiers audio. "
                    "Installez-le avec: brew install ffmpeg (macOS) ou apt-get install ffmpeg (Linux)"
                )
            
            # Si la conversion échoue, on ne peut pas continuer
            logger.error(f"Impossible de convertir {audio_path}. Le format .webm nécessite une conversion en WAV.")
            raise RuntimeError(
                f"Impossible de convertir le fichier audio {audio_path} en WAV. "
                f"Erreur: {error_msg}"
            )
    
    def _get_temp_path(self, original_path: str) -> str:
        """Génère un chemin temporaire"""
        import tempfile
        temp_dir = Path(tempfile.gettempdir()) / "trans_voice"
        temp_dir.mkdir(exist_ok=True)
        
        ext = Path(original_path).suffix or ".wav"
        return str(temp_dir / f"audio_{int(time.time() * 1000)}{ext}")
    
    def calculate_wer(self, reference: str, hypothesis: str) -> float:
        """
        Calcule le Word Error Rate (WER)
        
        Args:
            reference: Texte de référence
            hypothesis: Texte transcrit
        
        Returns:
            WER (0.0 = parfait, 1.0+ = erreurs)
        """
        ref_words = reference.lower().split()
        hyp_words = hypothesis.lower().split()
        
        # Algorithme de Levenshtein pour les mots
        n = len(ref_words)
        m = len(hyp_words)
        
        # Matrice de distance
        dp = [[0] * (m + 1) for _ in range(n + 1)]
        
        # Initialisation
        for i in range(n + 1):
            dp[i][0] = i
        for j in range(m + 1):
            dp[0][j] = j
        
        # Calcul
        for i in range(1, n + 1):
            for j in range(1, m + 1):
                if ref_words[i - 1] == hyp_words[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1]
                else:
                    dp[i][j] = min(
                        dp[i - 1][j] + 1,      # Suppression
                        dp[i][j - 1] + 1,      # Insertion
                        dp[i - 1][j - 1] + 1   # Substitution
                    )
        
        errors = dp[n][m]
        wer = errors / n if n > 0 else 0.0
        
        return wer
    
    def get_model_info(self) -> Dict:
        """Retourne les informations sur le modèle"""
        return {
            "model_size": self.model_size,
            "device": self.device,
            "language": self.language,
            "preprocessing": self.preprocess
        }


