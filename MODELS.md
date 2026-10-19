# Soravo Models

ASR models available in Soravo. All models are downloaded on-demand from HuggingFace — none ship with the app binary.

## License Summary

| License | Models |
|---------|--------|
| MIT | Whisper family, Moonshine, GigaAM, Kyutai, GLM-ASR, Hikari, MOSS, minI-Omni2, VibeVoice, MiMo ASR, Hojo ASR |
| CC-BY-4.0 | NVIDIA Parakeet TDT v2, NVIDIA Canary 1B v2 |

## Transcription Engine

**CrispASR** — MIT License
- Repository: https://github.com/CrispStrobe/CrispASR
- ggml runtime hub for multilingual ASR and TTS models
- Supports Whisper GGUF/BIN models natively
- Supports Parakeet TDT, Canary, and other PyTorch models

## Model Catalog

### Whisper Family (OpenAI, MIT)
| ID | Name | Size | License |
|----|------|------|---------|
| tiny.en | Whisper Tiny (English, Q5) | 78 MB | MIT |
| tiny | Whisper Tiny (Multilingual, Q5) | 78 MB | MIT |
| tiny.en-q8 | Whisper Tiny (English, Q8) | 42 MB | MIT |
| tiny.en-fp16 | Whisper Tiny (English, fp16) | 74 MB | MIT |
| base.en | Whisper Base (English, Q5) | 148 MB | MIT |
| base | Whisper Base (Multilingual, Q5) | 148 MB | MIT |
| small.en | Whisper Small (English, Q5) | 466 MB | MIT |
| small | Whisper Small (Multilingual, Q5) | 466 MB | MIT |
| distil-large-v3 | Distil-Whisper Large v3 (Q5) | 513 MB | MIT |
| medium.en | Whisper Medium (English) | 1.5 GB | MIT |
| medium | Whisper Medium (Multilingual) | 1.5 GB | MIT |
| large-v3 | Whisper Large v3 | 3.0 GB | MIT |
| large-v3-turbo | Whisper Large v3 Turbo | 1.6 GB | MIT |

### Moonshine (UsefulSensors, MIT)
| ID | Name | Size | License |
|----|------|------|---------|
| moonshine-tiny | Moonshine Tiny (Q4_K) | 20 MB | MIT |
| moonshine-streaming-tiny | Moonshine Streaming Tiny (Q4_K) | 31 MB | MIT |

### Academic / Research (MIT)
| ID | Name | Size | License |
|----|------|------|---------|
| gigaam-v3 | GigaAM v3 (RNNT, Q8) | 249 MB | MIT |
| kyutai-stt | Kyutai STT 1B (Q4_K) | 636 MB | MIT |
| glm-asr-nano | GLM-ASR Nano (Q4_K) | 1.2 GB | MIT |
| hikari-medium | Hikari Medium (f16) | 1.5 GB | MIT |

### MOSS (OpenMOSS, MIT)
| ID | Name | Size | License |
|----|------|------|---------|
| moss-transcribe | MOSS Transcribe Preview 2B (Q4_K) | 2.7 GB | MIT |
| moss-diarize | MOSS Transcribe + Diarize 0.9B (Q4_K) | 1.1 GB | MIT |
| moss-audio | MOSS Audio 4B Instruct (Q4_K) | 3.9 GB | MIT |

### Industry (MIT)
| ID | Name | Size | License |
|----|------|------|---------|
| mini-omni2 | minI-Omni2 (Q4_K) | 1.0 GB | MIT |
| vibevoice-streaming | VibeVoice ASR Streaming 1.5B (Q4_K) | 1.8 GB | MIT |
| vibevoice-bitnet | VibeVoice ASR BitNet (TQ2) | 1.6 GB | MIT |
| vibevoice | VibeVoice ASR (Q4_K) | 4.6 GB | MIT |
| mimo-asr | MiMo ASR (Q4_K) | 4.3 GB | MIT |
| hojo-asr | Hojo-ASR V1 (Q4_K) | 4.2 GB | MIT |

### NVIDIA Parakeet & Canary (CC-BY-4.0)
| ID | Name | Size | License |
|----|------|------|---------|
| parakeet-tdt-v2 | Parakeet TDT v2 (English) | 1.1 GB | CC-BY-4.0 |
| canary-1b-v2 | Canary 1B v2 (Multilingual) | 1.0 GB | CC-BY-4.0 |

## License Notes

- **MIT**: Permissive. Use, modify, distribute with attribution. Commercial use allowed.
- **CC-BY-4.0**: Attribution required. Commercial use allowed with credit to NVIDIA. See [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

## Verification

- CrispASR license verified from https://github.com/CrispStrobe/CrispASR/blob/main/LICENSE (MIT)
- Whisper.cpp license verified from https://github.com/ggml-org/whisper.cpp/blob/master/LICENSE (MIT)
- NVIDIA Parakeet/Canary licenses from https://huggingface.co/nvidia/parakeet-tdt-v2.0 and https://huggingface.co/nvidia/canary-1b-v2 (CC-BY-4.0)