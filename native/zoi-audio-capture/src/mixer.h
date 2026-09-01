// Buffer circular por captura e mixer de cadencia fixa.
//
// Cada captura escreve no seu proprio anel; o mixer roda num relogio unico de
// `frameMs` e emite SEMPRE um frame, mesmo que ninguem esteja tocando nada
// (silencio). Frame continuo e o que mantem a track de audio do WebRTC viva.
//
// Emitir sempre um frame continua sendo a regra. O que mudou (feature
// audio-quality) e que uma FONTE nunca entra nem sai do silencio por degrau: a
// contribuicao dela sobe e desce por uma rampa de 1 ms. Um degrau de amplitude
// entre sinal real e zero e exatamente o estalo que a feature corrige, e ele
// acontecia em tres lugares: na cauda de um frame que veio incompleto, na
// retomada depois de um engasgo, e no primeiro tique totalmente mudo depois de
// um tique cheio.
#pragma once

#include <windows.h>

#include <atomic>
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

/** Contadores de saude do mix, drenados pela thread de controle do Engine. */
struct MixerHealth {
  /** Tiques com perda de audio REAL: alguma fonte devolveu 0 < frames < framesPerTick_. */
  uint64_t underrunTicks = 0;
  /** Soma dos quadros que faltaram nesses tiques (framesPerTick_ - frames). */
  uint64_t underrunFrames = 0;
  /**
   * Tiques em que NENHUMA fonte entregou quadro. NAO e underrun: e o estado
   * normal de um aplicativo que nao esta tocando nada. Vai no relatorio como
   * CONTEXTO e nunca dispara o relatorio sozinho.
   */
  uint64_t silentTicks = 0;
};

class Mixer {
 public:
  ~Mixer();

  bool Start(const AudioFormat& format, uint32_t frameMs, PcmSink sink);
  void Stop();

  /** Troca a lista de fontes. Os anexos precisam sobreviver ate a proxima troca. */
  void SetSources(std::vector<AudioRingBuffer*> sources);

  /** Le e ZERA os tres contadores. Chamada de outra thread. */
  MixerHealth TakeHealth();
  /**
   * Houve underrun REAL desde a ultima drenagem, SEM drenar nada. O Engine
   * precisa decidir se vale reportar ANTES de drenar: checar o gatilho drenando
   * apagaria justamente os eventos que se quer reportar.
   */
  bool HasUnderrun() const;

 private:
  void Run();

  PcmSink sink_;
  AudioFormat format_;
  size_t framesPerTick_ = 480;
  uint32_t frameMs_ = 10;
  /** Quadros da rampa de entrada e de saida do silencio (48 a 48 kHz). */
  size_t fadeFrames_ = 0;

  std::mutex sourcesMutex_;
  std::vector<AudioRingBuffer*> sources_;
  /**
   * Paralelos a `sources_` e escritos SOMENTE dentro de `sourcesMutex_`:
   * `sourceSilenced_[i]` diz se a fonte i veio do silencio no tique anterior, e
   * `lastFrame_` guarda o ULTIMO quadro entregue por ela (um valor por canal),
   * usado pela cauda de decaimento.
   */
  std::vector<uint8_t> sourceSilenced_;
  std::vector<float> lastFrame_;

  std::atomic<uint64_t> underrunTicks_{0};
  std::atomic<uint64_t> underrunFrames_{0};
  std::atomic<uint64_t> silentTicks_{0};

  std::thread thread_;
  HANDLE stopEvent_ = nullptr;
  HANDLE timer_ = nullptr;
};

}  // namespace zoi
