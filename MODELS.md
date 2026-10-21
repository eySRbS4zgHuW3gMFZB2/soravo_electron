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

Sizes are the exact byte counts of the files that are downloaded, and a
model only counts as installed when its file is that long. A download that
was cut short is a broken model, not a small one, so it is reported as
missing rather than left to fail at the first dictation.

### Whisper Family (OpenAI, MIT)
| ID | Name | Size | License |
|----|------|------|---------|
| tiny.en | Whisper Tiny (English, f16) | 78 MB | MIT |
| tiny | Whisper Tiny (Multilingual, f16) | 78 MB | MIT |
| tiny.en-q8 | Whisper Tiny (English, Q8) | 44 MB | MIT |
| tiny.en-fp16 | Whisper Tiny (English, Q5_1) | 32 MB | MIT |
| base.en | Whisper Base (English, f16) | 148 MB | MIT |
| base | Whisper Base (Multilingual, f16) | 148 MB | MIT |
| small.en | Whisper Small (English, f16) | 488 MB | MIT |
| small | Whisper Small (Multilingual, f16) | 488 MB | MIT |
| distil-large-v3 | Distil-Whisper Large v3 | 1.5 GB | MIT |
| medium.en | Whisper Medium (English, f16) | 1.5 GB | MIT |
| medium | Whisper Medium (Multilingual, f16) | 1.5 GB | MIT |
| large-v3 | Whisper Large v3 | 3.1 GB | MIT |
| large-v3-turbo | Whisper Large v3 Turbo | 1.6 GB | MIT |

### Moonshine (UsefulSensors, MIT)
| ID | Name | Size | License | Also needs |
|----|------|------|---------|------------|
| moonshine-tiny | Moonshine Tiny (Q4_K) | 21 MB | MIT | `tokenizer.bin` |
| moonshine-streaming-tiny | Moonshine Streaming Tiny (Q4_K) | 32 MB | MIT | `tokenizer.bin` |

### Academic / Research (MIT)
| ID | Name | Size | License |
|----|------|------|---------|
| gigaam-v3 | GigaAM v3 (RNNT, Q8) | 249 MB | MIT |
| kyutai-stt | Kyutai STT 1B (Q4_K) | 667 MB | MIT |
| glm-asr-nano | GLM-ASR Nano (Q4_K) | 1.3 GB | MIT |
| hikari-medium | Hikari Medium (f16) | 1.5 GB | MIT |

### MOSS (OpenMOSS, MIT)
| ID | Name | Size | License |
|----|------|------|---------|
| moss-transcribe | MOSS Transcribe Preview 2B (Q4_K) | 2.8 GB | MIT |
| moss-diarize | MOSS Transcribe + Diarize 0.9B (Q4_K) | 1.2 GB | MIT |
| moss-audio | MOSS Audio 4B Instruct (Q4_K) | 4.1 GB | MIT |

### Industry (MIT)
| ID | Name | Size | License | Also needs |
|----|------|------|---------|------------|
| mini-omni2 | minI-Omni2 (Q4_K) | 1.1 GB | MIT | `snac-24khz.gguf` |
| vibevoice-streaming | VibeVoice ASR Streaming 1.5B (Q4_K) | 1.9 GB | MIT |
| vibevoice-bitnet | VibeVoice ASR BitNet (TQ2) | 1.6 GB | MIT |
| vibevoice | VibeVoice ASR (Q4_K) | 4.8 GB | MIT |
| mimo-asr | MiMo ASR (Q4_K) | 4.5 GB | MIT |
| hojo-asr | Hojo-ASR V1 (Q4_K) | 4.4 GB | MIT |

### NVIDIA Parakeet & Canary (CC-BY-4.0)
| ID | Name | Size | License |
|----|------|------|---------|
| parakeet-tdt-v2 | Parakeet TDT v2 (English, Q4_K) | 397 MB | CC-BY-4.0 |
| canary-1b-v2 | Canary 1B v2 (Multilingual, Q4_K) | 611 MB | CC-BY-4.0 |

## Companion Files

Some backends are more than one file. The engine loads the second file
from the model's own folder, by name, so the app downloads it alongside
the model and checks for it before every transcription.

- **Moonshine** reads its vocabulary from `tokenizer.bin`, which sits next
  to the model file. Both Moonshine models use the same tokenizer.
- **minI-Omni2** reads its audio codec from `snac-24khz.gguf`.

A model whose companion is missing shows as "Incomplete" in the Models
page, with a **Repair** button that fetches only what is missing. The
app also fetches a missing companion by itself the first time the model is
used, so an install made before the app knew about companions starts
working on its own.

## License Notes

- **MIT**: Permissive. Use, modify, distribute with attribution. Commercial use allowed.
- **CC-BY-4.0**: Attribution required. Commercial use allowed with credit to NVIDIA. See [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

## Verification

- CrispASR license verified from https://github.com/CrispStrobe/CrispASR/blob/main/LICENSE (MIT)
- Whisper.cpp license verified from https://github.com/ggml-org/whisper.cpp/blob/master/LICENSE (MIT)
- NVIDIA Parakeet/Canary licenses from https://huggingface.co/nvidia/parakeet-tdt-v2.0 and https://huggingface.co/nvidia/canary-1b-v2 (CC-BY-4.0)
- The Parakeet and Canary files are the GGUF conversions in
  https://huggingface.co/cstr/parakeet-tdt-0.6b-v2-GGUF and
  https://huggingface.co/cstr/canary-1b-v2-GGUF; the upstream NVIDIA
  repositories hold PyTorch weights, which the engine cannot read.
- Every URL in the catalog was fetched and loaded by the engine, and every
  size is the byte count the server reports.