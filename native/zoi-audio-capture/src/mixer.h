// Buffer circular por captura e mixer de cadencia fixa.
//
// Cada captura escreve no seu proprio anel; o mixer roda num relogio unico de
// `frameMs` e emite SEMPRE um frame, mesmo que ninguem esteja tocando nada
// (silencio). Frame continuo e o que mantem a track de audio do WebRTC viva.
#pragma once

#include <windows.h>

#include <cstdint>
#include <functional>
#include <mutex>
#include <thread>
#include <vector>

namespace zoi {

struct AudioFormat {
  uint32_t sampleRate = 48000;
  uint16_t channels = 2;
};

/**
 * Anel de amostras float interleaved, um produtor (thread da captura) e um
 * consumidor (thread do mixer). Cheio, descarta o MAIS VELHO: atraso acumulado
 * e pior que um estalo, porque descola o labio do video.
 */
class AudioRingBuffer {
 public:
  AudioRingBuffer(size_t capacityFrames, uint16_t channels);

  void Write(const float* samples, size_t frames);
  /** Le ate `frames`; devolve quantos frames sairam de fato. */
  size_t Read(float* out, size_t frames);
  void Clear();

 private:
  mutable std::mutex mutex_;
  std::vector<float> data_;
  size_t capacityFrames_ = 0;
  uint16_t channels_ = 2;
  size_t readIndex_ = 0;
  size_t availableFrames_ = 0;
};

/** Frame pronto: `samples` tem frames*canais floats e vive so na chamada. */
using PcmSink = std::function<void(const float* samples, size_t sampleCount, int64_t timestampUs)>;

class Mixer {
 public:
  ~Mixer();

  bool Start(const AudioFormat& format, uint32_t frameMs, PcmSink sink);
  void Stop();

  /** Troca a lista de fontes. Os anexos precisam sobreviver ate a proxima troca. */
  void SetSources(std::vector<AudioRingBuffer*> sources);

 private:
  void Run();

  PcmSink sink_;
  AudioFormat format_;
  size_t framesPerTick_ = 480;
  uint32_t frameMs_ = 10;

  std::mutex sourcesMutex_;
  std::vector<AudioRingBuffer*> sources_;

  std::thread thread_;
  HANDLE stopEvent_ = nullptr;
  HANDLE timer_ = nullptr;
};

}  // namespace zoi
