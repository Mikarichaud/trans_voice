"""
Module de pré-traitement audio pour Speech-to-Text
Inclut : VAD (Voice Activity Detection), réduction de bruit, normalisation, MFCC
"""

import numpy as np
import librosa
import soundfile as sf
import noisereduce as nr
from scipy import signal
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class AudioPreprocessor:
    """Classe pour le pré-traitement audio avant STT"""
    
    def __init__(
        self,
        target_sr: int = 16000,
        normalize: bool = True,
        noise_reduction: bool = True,
        vad_enabled: bool = True
    ):
        """
        Args:
            target_sr: Taux d'échantillonnage cible (Hz)
            normalize: Normaliser l'amplitude audio
            noise_reduction: Activer la réduction de bruit
            vad_enabled: Activer la détection d'activité vocale
        """
        self.target_sr = target_sr
        self.normalize = normalize
        self.noise_reduction = noise_reduction
        self.vad_enabled = vad_enabled
    
    def preprocess(
        self,
        audio_path: str,
        output_path: Optional[str] = None
    ) -> Tuple[np.ndarray, int]:
        """
        Pré-traite un fichier audio
        
        Returns:
            Tuple (audio_array, sample_rate)
        """
        logger.info(f"Pré-traitement de {audio_path}")
        
        # Charger l'audio
        audio, sr = librosa.load(audio_path, sr=self.target_sr, mono=True)
        
        # 1. Réduction de bruit
        if self.noise_reduction:
            audio = self._reduce_noise(audio, sr)
        
        # 2. Normalisation
        if self.normalize:
            audio = self._normalize(audio)
        
        # 3. VAD (Voice Activity Detection)
        if self.vad_enabled:
            audio = self._apply_vad(audio, sr)
        
        # 4. Filtrage passe-bas (supprimer les fréquences > 8kHz pour la voix)
        audio = self._apply_lowpass_filter(audio, sr, cutoff=8000)
        
        # Sauvegarder si un chemin de sortie est fourni
        if output_path:
            sf.write(output_path, audio, sr)
            logger.info(f"Audio pré-traité sauvegardé: {output_path}")
        
        return audio, sr
    
    def _reduce_noise(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """Réduction de bruit spectral"""
        try:
            # Utiliser noisereduce avec méthode stationnaire
            reduced = nr.reduce_noise(
                y=audio,
                sr=sr,
                stationary=True,
                prop_decrease=0.8
            )
            logger.debug("Réduction de bruit appliquée")
            return reduced
        except Exception as e:
            logger.warning(f"Erreur lors de la réduction de bruit: {e}")
            return audio
    
    def _normalize(self, audio: np.ndarray) -> np.ndarray:
        """Normalisation de l'amplitude"""
        if len(audio) == 0:
            return audio
        
        # Normalisation RMS (Root Mean Square)
        rms = np.sqrt(np.mean(audio**2))
        if rms > 0:
            target_rms = 0.1  # Niveau cible
            audio = audio * (target_rms / rms)
        
        # Limiter à [-1, 1]
        audio = np.clip(audio, -1.0, 1.0)
        
        return audio
    
    def _apply_vad(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """Détection d'activité vocale (VAD)"""
        try:
            import webrtcvad
            
            # webrtcvad nécessite des échantillons de 10, 20 ou 30 ms
            # et un taux d'échantillonnage de 8000, 16000 ou 32000 Hz
            if sr not in [8000, 16000, 32000]:
                logger.warning(f"VAD: taux d'échantillonnage {sr} non supporté, rééchantillonnage à 16000")
                audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
                sr = 16000
            
            vad = webrtcvad.Vad(2)  # Mode agressif (0-3)
            frame_duration_ms = 30  # 30ms par frame
            frame_size = int(sr * frame_duration_ms / 1000)
            
            # Convertir en int16 pour webrtcvad
            audio_int16 = (audio * 32767).astype(np.int16)
            
            # Détecter les segments vocaux
            voice_segments = []
            for i in range(0, len(audio_int16) - frame_size, frame_size):
                frame = audio_int16[i:i + frame_size]
                if len(frame) == frame_size:
                    is_speech = vad.is_speech(frame.tobytes(), sr)
                    if is_speech:
                        voice_segments.append((i, i + frame_size))
            
            # Extraire uniquement les segments vocaux
            if voice_segments:
                # Fusionner les segments proches
                merged = self._merge_segments(voice_segments, max_gap=frame_size * 2)
                
                # Extraire l'audio des segments vocaux
                mask = np.zeros(len(audio), dtype=bool)
                for start, end in merged:
                    mask[start:end] = True
                
                audio = audio[mask]
                logger.debug(f"VAD: {len(voice_segments)} segments vocaux détectés")
            else:
                logger.warning("VAD: Aucun segment vocal détecté")
            
            return audio
            
        except ImportError:
            logger.warning("webrtcvad non disponible, VAD désactivé")
            return audio
        except Exception as e:
            logger.warning(f"Erreur VAD: {e}")
            return audio
    
    def _merge_segments(self, segments: list, max_gap: int) -> list:
        """Fusionne les segments proches"""
        if not segments:
            return []
        
        merged = [segments[0]]
        for current in segments[1:]:
            last = merged[-1]
            if current[0] - last[1] <= max_gap:
                merged[-1] = (last[0], current[1])
            else:
                merged.append(current)
        
        return merged
    
    def _apply_lowpass_filter(self, audio: np.ndarray, sr: int, cutoff: int = 8000) -> np.ndarray:
        """Filtre passe-bas pour supprimer les hautes fréquences"""
        nyquist = sr / 2
        
        # S'assurer que cutoff est valide
        if cutoff >= nyquist:
            cutoff = nyquist * 0.95  # Utiliser 95% de la fréquence de Nyquist
        
        normal_cutoff = cutoff / nyquist
        
        # Vérifier que normal_cutoff est dans la plage valide (0 < Wn < 1)
        if normal_cutoff >= 1.0:
            normal_cutoff = 0.95
        elif normal_cutoff <= 0:
            normal_cutoff = 0.01
        
        # Filtre Butterworth
        b, a = signal.butter(4, normal_cutoff, btype='low', analog=False)
        filtered = signal.filtfilt(b, a, audio)
        
        return filtered
    
    def extract_mfcc(
        self,
        audio: np.ndarray,
        sr: int,
        n_mfcc: int = 13,
        n_fft: int = 2048,
        hop_length: int = 512
    ) -> np.ndarray:
        """
        Extrait les caractéristiques MFCC (Mel-Frequency Cepstral Coefficients)
        
        Returns:
            Array de shape (n_mfcc, time_frames)
        """
        mfccs = librosa.feature.mfcc(
            y=audio,
            sr=sr,
            n_mfcc=n_mfcc,
            n_fft=n_fft,
            hop_length=hop_length
        )
        return mfccs
    
    def extract_log_mel_spectrogram(
        self,
        audio: np.ndarray,
        sr: int,
        n_mels: int = 80,
        n_fft: int = 2048,
        hop_length: int = 512
    ) -> np.ndarray:
        """
        Extrait le spectrogramme log-Mel
        
        Returns:
            Array de shape (n_mels, time_frames)
        """
        mel_spec = librosa.feature.melspectrogram(
            y=audio,
            sr=sr,
            n_mels=n_mels,
            n_fft=n_fft,
            hop_length=hop_length
        )
        log_mel = librosa.power_to_db(mel_spec, ref=np.max)
        return log_mel


