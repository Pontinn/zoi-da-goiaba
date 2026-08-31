#include "mixer.h"

#include <algorithm>
#include <cstring>

namespace zoi {

namespace {

#ifndef CREATE_WAITABLE_TIMER_HIGH_RESOLUTION
#define CREATE_WAITABLE_TIMER_HIGH_RESOLUTION 0x00000002
#endif

float Clamp(float value) {
  if (value > 1.0f) return 1.0f;
  if (value < -1.0f) return -1.0f;
  return value;
}

/**
 * Duracao da rampa de entrada e de saida do silencio, por fonte.
 *
 * DUPLICACAO CONSCIENTE de `AUDIO_FADE_MS` em `src/shared/config.ts`: C++ nao
 * importa TypeScript e gerar um cabecalho para UM numero seria maquinaria maior
 * que o problema. Mudou aqui, muda la.
 *
 * 1 ms e um decimo do frame de 10 ms (nunca soa como corte de volume) e uma
 * ordem de grandeza acima do periodo de amostragem, o que espalha o transiente
 * por 48 amostras em vez de concentra-lo em uma.
 */
constexpr uint32_t kFadeMs = 1;

}  // namespace

// ---------------------------------------------------------------------------
// AudioRingBuffer
// ---------------------------------------------------------------------------

AudioRingBuffer::AudioRingBuffer(size_t capacityFrames, uint16_t channels)
    : capacityFrames_(capacityFrames), channels_(channels) {
  data_.assign(capacityFrames_ * channels_, 0.0f);
}

void AudioRingBuffer::Write(const float* samples, size_t frames) {
  if (frames == 0 || capacityFrames_ == 0) return;
  std::lock_guard<std::mutex> guard(mutex_);

  // Mais do que cabe: fica so a cauda (o audio mais recente).
  if (frames > capacityFrames_) {
    samples += (frames - capacityFrames_) * channels_;
    frames = capacityFrames_;
  }

  size_t writeIndex = (readIndex_ + availableFrames_) % capacityFrames_;
  for (size_t frame = 0; frame < frames; ++frame) {
    std::memcpy(&data_[writeIndex * channels_], &samples[frame * channels_],
                channels_ * sizeof(float));
    writeIndex = (writeIndex + 1) % capacityFrames_;
  }

  availableFrames_ += frames;
  if (availableFrames_ > capacityFrames_) {
    // Estouro: descarta o mais velho avancando a leitura.
    readIndex_ = (readIndex_ + (availableFrames_ - capacityFrames_)) % capacityFrames_;
    availableFrames_ = capacityFrames_;
  }
}

size_t AudioRingBuffer::Read(float* out, size_t frames) {
  std::lock_guard<std::mutex> guard(mutex_);
  const size_t count = std::min(frames, availableFrames_);
  for (size_t frame = 0; frame < count; ++frame) {
    std::memcpy(&out[frame * channels_], &data_[readIndex_ * channels_],
                channels_ * sizeof(float));
    readIndex_ = (readIndex_ + 1) % capacityFrames_;
  }
  availableFrames_ -= count;
  return count;
}

void AudioRingBuffer::Clear() {
  std::lock_guard<std::mutex> guard(mutex_);
  readIndex_ = 0;
  availableFrames_ = 0;
}

// ---------------------------------------------------------------------------
// Mixer
// ---------------------------------------------------------------------------

Mixer::~Mixer() {
  Stop();
}

bool Mixer::Start(const AudioFormat& format, uint32_t frameMs, PcmSink sink) {
  if (thread_.joinable()) return false;

  format_ = format;
  frameMs_ = frameMs == 0 ? 10 : frameMs;
  framesPerTick_ = static_cast<size_t>(format_.sampleRate) * frameMs_ / 1000;
  if (framesPerTick_ == 0) return false;
  fadeFrames_ = static_cast<size_t>(format_.sampleRate) * kFadeMs / 1000;
  if (fadeFrames_ < 2) fadeFrames_ = 2;
  if (fadeFrames_ > framesPerTick_) fadeFrames_ = framesPerTick_;
  sink_ = std::move(sink);

  stopEvent_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (!stopEvent_) return false;

  timer_ = CreateWaitableTimerExW(nullptr, nullptr, CREATE_WAITABLE_TIMER_HIGH_RESOLUTION,
                                  TIMER_ALL_ACCESS);
  if (!timer_) {
    // Windows sem timer de alta resolucao: o periodico comum resolve.
    timer_ = CreateWaitableTimerW(nullptr, FALSE, nullptr);
  }
  if (!timer_) {
    CloseHandle(stopEvent_);
    stopEvent_ = nullptr;
    return false;
  }

  LARGE_INTEGER due;
  due.QuadPart = -static_cast<LONGLONG>(frameMs_) * 10000;
  if (!SetWaitableTimer(timer_, &due, static_cast<LONG>(frameMs_), nullptr, nullptr, FALSE)) {
    CloseHandle(timer_);
    CloseHandle(stopEvent_);
    timer_ = nullptr;
    stopEvent_ = nullptr;
    return false;
  }

  thread_ = std::thread([this]() { Run(); });
  return true;
}

void Mixer::Stop() {
  if (stopEvent_) SetEvent(stopEvent_);
  if (thread_.joinable()) thread_.join();
  if (timer_) {
    CancelWaitableTimer(timer_);
    CloseHandle(timer_);
    timer_ = nullptr;
  }
  if (stopEvent_) {
    CloseHandle(stopEvent_);
    stopEvent_ = nullptr;
  }
  {
    std::lock_guard<std::mutex> guard(sourcesMutex_);
    sources_.clear();
    sourceSilenced_.clear();
    lastFrame_.clear();
  }
  sink_ = nullptr;
}

void Mixer::SetSources(std::vector<AudioRingBuffer*> sources) {
  std::lock_guard<std::mutex> guard(sourcesMutex_);
  sources_ = std::move(sources);
  // Os dois auxiliares nascem ZERADOS junto com a composicao nova: toda fonte
  // recem-publicada entra marcada como vinda do silencio, entao a PRIMEIRA
  // entrega dela sobe com rampa. E o que se quer: uma captura recem-aberta
  // entrando no mix e exatamente uma transicao silencio -> sinal.
  sourceSilenced_.assign(sources_.size(), 1);
  lastFrame_.assign(sources_.size() * format_.channels, 0.0f);
}

MixerHealth Mixer::TakeHealth() {
  MixerHealth health;
  health.underrunTicks = underrunTicks_.exchange(0);
  health.underrunFrames = underrunFrames_.exchange(0);
  health.silentTicks = silentTicks_.exchange(0);
  return health;
}

bool Mixer::HasUnderrun() const {
  return underrunTicks_.load() > 0;
}

void Mixer::Run() {
  const size_t sampleCount = framesPerTick_ * format_.channels;
  std::vector<float> mixed(sampleCount, 0.0f);
  std::vector<float> scratch(sampleCount, 0.0f);
  int64_t emittedFrames = 0;

  const HANDLE waits[2] = {stopEvent_, timer_};
  while (true) {
    const DWORD result = WaitForMultipleObjects(2, waits, FALSE, INFINITE);
    if (result != WAIT_OBJECT_0 + 1) break;  // stop ou falha de espera

    std::fill(mixed.begin(), mixed.end(), 0.0f);
    bool tickHadUnderrun = false;
    bool tickHadAudio = false;
    {
      std::lock_guard<std::mutex> guard(sourcesMutex_);
      const size_t channels = format_.channels;
      for (size_t index = 0; index < sources_.size(); ++index) {
        std::fill(scratch.begin(), scratch.end(), 0.0f);
        const size_t frames = sources_[index]->Read(scratch.data(), framesPerTick_);

        // Quantas amostras deste `scratch` entram na soma. Com a cauda de
        // decaimento o pedaco somado NAO e `frames * channels`.
        size_t samples = frames * channels;

        if (frames == 0) {
          // Fonte muda. Se ela estava tocando no tique anterior, o anel drenou
          // exatamente na fronteira do tique: sem a cauda, o resultado seria
          // amplitude total seguida de silencio absoluto, a mesma classe de
          // clique que esta rampa existe para corrigir. A cauda nao inventa
          // audio: e uma reta de 1 ms que sai do ultimo valor REAL e chega a
          // zero, o que o fade-out teria produzido se o codigo soubesse, no
          // tique anterior, que aquele era o ultimo.
          if (sourceSilenced_[index] == 0 && fadeFrames_ >= 2) {
            const float divisor = static_cast<float>(fadeFrames_ - 1);
            for (size_t i = 0; i < fadeFrames_; ++i) {
              const float gain = static_cast<float>(fadeFrames_ - 1 - i) / divisor;
              for (size_t c = 0; c < channels; ++c) {
                // ATRIBUICAO, nao multiplicacao: `scratch` acabou de ser zerado
                // e nao ha quadro lido neste tique.
                scratch[i * channels + c] = lastFrame_[index * channels + c] * gain;
              }
            }
            samples = fadeFrames_ * channels;
          }
          sourceSilenced_[index] = 1;
          // Zero quadros NUNCA conta como underrun: e o estado normal de um
          // aplicativo que nao esta tocando nada, e conta-lo faria o relatorio
          // de saude disparar para sempre em toda maquina saudavel.
          if (samples == 0) continue;
        } else {
          tickHadAudio = true;
          const size_t fade = std::min(frames, fadeFrames_);

          // O ultimo quadro lido e guardado ANTES de qualquer rampa: guardar
          // depois salvaria um valor ja atenuado.
          for (size_t c = 0; c < channels; ++c) {
            lastFrame_[index * channels + c] = scratch[(frames - 1) * channels + c];
          }

          if (fade >= 2) {
            const float divisor = static_cast<float>(fade - 1);
            // (1) fade-in: a fonte estava silenciada e voltou.
            if (sourceSilenced_[index] != 0) {
              for (size_t i = 0; i < fade; ++i) {
                const float gain = static_cast<float>(i) / divisor;
                for (size_t c = 0; c < channels; ++c) {
                  scratch[i * channels + c] *= gain;
                }
              }
            }
            // (2) fade-out DENTRO do frame: leitura parcial, a cauda de `mixed`
            // vai ficar no zero do fill, entao o sinal precisa encostar nele.
            if (frames < framesPerTick_) {
              const size_t start = frames - fade;
              for (size_t i = 0; i < fade; ++i) {
                const float gain = static_cast<float>(fade - 1 - i) / divisor;
                for (size_t c = 0; c < channels; ++c) {
                  scratch[(start + i) * channels + c] *= gain;
                }
              }
            }
          }

          if (frames < framesPerTick_) {
            // Unico caso em que audio real foi perdido.
            underrunFrames_.fetch_add(framesPerTick_ - frames);
            tickHadUnderrun = true;
            sourceSilenced_[index] = 1;
          } else {
            sourceSilenced_[index] = 0;
          }
        }

        // A rampa vive em `scratch` e NUNCA em `mixed`: `mixed` e a soma de
        // todas as fontes, e atenuar la faria um engasgo de uma fonte abaixar o
        // volume de todas as outras.
        for (size_t sample = 0; sample < samples; ++sample) {
          mixed[sample] += scratch[sample];
        }
      }
    }

    if (tickHadUnderrun) underrunTicks_.fetch_add(1);
    if (!tickHadAudio) silentTicks_.fetch_add(1);

    for (size_t index = 0; index < sampleCount; ++index) {
      mixed[index] = Clamp(mixed[index]);
    }

    const int64_t timestampUs =
        emittedFrames * 1000000LL / static_cast<int64_t>(format_.sampleRate);
    if (sink_) sink_(mixed.data(), sampleCount, timestampUs);
    emittedFrames += static_cast<int64_t>(framesPerTick_);
  }
}

}  // namespace zoi
