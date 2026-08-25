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
  }
  sink_ = nullptr;
}

void Mixer::SetSources(std::vector<AudioRingBuffer*> sources) {
  std::lock_guard<std::mutex> guard(sourcesMutex_);
  sources_ = std::move(sources);
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
    {
      std::lock_guard<std::mutex> guard(sourcesMutex_);
      for (AudioRingBuffer* source : sources_) {
        std::fill(scratch.begin(), scratch.end(), 0.0f);
        const size_t frames = source->Read(scratch.data(), framesPerTick_);
        if (frames == 0) continue;
        const size_t samples = frames * format_.channels;
        for (size_t index = 0; index < samples; ++index) {
          mixed[index] += scratch[index];
        }
      }
    }

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
