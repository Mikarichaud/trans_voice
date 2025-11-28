import numpy as np
import librosa
import soundfile as sf
import noisereduce as nr
from scipy import signal
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)

class AudioPreprocessor:

    def __init__(
        self,
        target_sr: int = 16000,
        normalize: bool = True,
        noise_reduction: bool = True,
        vad_enabled: bool = True
    ):
        self.target_sr = target_sr
        self.normalize = normalize
        self.noise_reduction = noise_reduction
        self.vad_enabled = vad_enabled

    def preprocess(
        self,
        audio_path: str,
        output_path: Optional[str] = None
    ) -> Tuple[np.ndarray, int]:
        logger.info(f"Pré-traitement de {audio_path}")

        audio, sr = librosa.load(audio_path, sr=self.target_sr, mono=True)

        if self.noise_reduction:
            audio = self._reduce_noise(audio, sr)

        if self.normalize:
            audio = self._normalize(audio)

        if self.vad_enabled:
            audio = self._apply_vad(audio, sr)

        audio = self._apply_lowpass_filter(audio, sr, cutoff=8000)

        if output_path:
            sf.write(output_path, audio, sr)
            logger.info(f"Audio pré-traité sauvegardé: {output_path}")

        return audio, sr

    def _reduce_noise(self, audio: np.ndarray, sr: int) -> np.ndarray:
        try:
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
        if len(audio) == 0:
            return audio

        rms = np.sqrt(np.mean(audio**2))
        if rms > 0:
            target_rms = 0.1 
            audio = audio * (target_rms / rms)

        audio = np.clip(audio, -1.0, 1.0)

        return audio

    def _apply_vad(self, audio: np.ndarray, sr: int) -> np.ndarray:
        try:
            import webrtcvad

            if sr not in [8000, 16000, 32000]:
                logger.warning(f"VAD: taux d'échantillonnage {sr} non supporté, rééchantillonnage à 16000")
                audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
                sr = 16000

            vad = webrtcvad.Vad(2) 
            frame_duration_ms = 30 
            frame_size = int(sr * frame_duration_ms / 1000)

            audio_int16 = (audio * 32767).astype(np.int16)

            voice_segments = []
            for i in range(0, len(audio_int16) - frame_size, frame_size):
                frame = audio_int16[i:i + frame_size]
                if len(frame) == frame_size:
                    is_speech = vad.is_speech(frame.tobytes(), sr)
                    if is_speech:
                        voice_segments.append((i, i + frame_size))

            if voice_segments:
                merged = self._merge_segments(voice_segments, max_gap=frame_size * 2)

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
        nyquist = sr / 2

        if cutoff >= nyquist:
            cutoff = nyquist * 0.95  

        normal_cutoff = cutoff / nyquist

        if normal_cutoff >= 1.0:
            normal_cutoff = 0.95
        elif normal_cutoff <= 0:
            normal_cutoff = 0.01

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
        mel_spec = librosa.feature.melspectrogram(
            y=audio,
            sr=sr,
            n_mels=n_mels,
            n_fft=n_fft,
            hop_length=hop_length
        )
        log_mel = librosa.power_to_db(mel_spec, ref=np.max)
        return log_mel
