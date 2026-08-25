// Capturas WASAPI e o motor que decide QUAIS abrir.
//
// Regra central de seguranca (SPEC secao 2.1): a ancora de um include e SEMPRE
// o proprio PID da sessao de audio, NUNCA um ancestral. Subir a arvore serve so
// para detectar arvore proibida. O modo de falha aceitavel e perder o audio de
// algum app; nunca deixar passar o audio proibido.
#pragma once

#include <windows.h>
#include <audioclient.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>

#include <atomic>
#include <map>
#include <memory>
#include <string>
#include <thread>
#include <vector>

#include "mixer.h"
#include "session_tracker.h"

namespace zoi {

enum class CaptureMode {
  /** Composicao de includes por arvore de processo permitida. */
  ProcessExclusion,
  /** Loopback classico do endpoint inteiro (rede de seguranca da cascata). */
  EndpointLoopback
};

/** Uma captura WASAPI viva, com thread propria e anel proprio. */
class CaptureStream {
 public:
  CaptureStream(size_t capacityFrames, const AudioFormat& format);
  ~CaptureStream();

  CaptureStream(const CaptureStream&) = delete;
  CaptureStream& operator=(const CaptureStream&) = delete;

  /** Include ancorado na arvore de `targetPid` (WASAPI Process Loopback). */
  HRESULT StartProcessInclude(DWORD targetPid, std::string* detail);
  /** Loopback classico do endpoint de render informado. */
  HRESULT StartEndpointLoopback(IMMDevice* device, std::string* detail);

  void Stop();

  AudioRingBuffer* Buffer() { return &buffer_; }
  DWORD TargetPid() const { return targetPid_; }
  bool Failed() const { return failed_.load(); }

 private:
  HRESULT Launch(bool eventDriven, std::string* detail);
  void Run(bool eventDriven);
  void ConvertAndStore(const BYTE* data, UINT32 frames, bool silent);

  AudioFormat format_;
  AudioRingBuffer buffer_;
  DWORD targetPid_ = 0;

  Microsoft::WRL::ComPtr<IAudioClient> client_;
  Microsoft::WRL::ComPtr<IAudioCaptureClient> capture_;
  HANDLE sampleReadyEvent_ = nullptr;
  HANDLE stopEvent_ = nullptr;
  std::thread thread_;
  std::atomic<bool> failed_{false};

  /** Formato de origem quando o WASAPI nao aceitou o formato pedido. */
  bool needsConversion_ = false;
  uint32_t sourceSampleRate_ = 48000;
  uint16_t sourceChannels_ = 2;
  double resamplePosition_ = 0.0;
  std::vector<float> resampleTail_;
  std::vector<float> converted_;
};

struct EngineOptions {
  CaptureMode mode = CaptureMode::ProcessExclusion;
  ForbiddenRules forbidden;
  AudioFormat format;
  uint32_t frameMs = 10;
};

using StatusSink = std::function<void(const std::string& state, const std::string& detail)>;

/**
 * Orquestra tudo: enumera sessoes, classifica arvores, abre/fecha includes e
 * mantem o mixer alimentado. Todo o trabalho COM acontece numa unica thread de
 * controle em MTA.
 */
class Engine {
 public:
  ~Engine();

  bool Start(const EngineOptions& options, PcmSink pcmSink, StatusSink statusSink,
             std::string* error);
  void Stop();

 private:
  void RunControlThread();
  void Reconcile(ProcessSnapshot* snapshot);
  void ReconcileEndpoint();
  void PublishSources();
  void Report(const std::string& state, const std::string& detail);
  /** Texto curto de diagnostico com as ancoras abertas (vai no `detail`). */
  std::string DescribeAnchors(const ProcessSnapshot& snapshot) const;

  EngineOptions options_;
  StatusSink statusSink_;
  Mixer mixer_;
  SessionScanner scanner_;

  /** Includes vivos, indexados pela ancora (PID da sessao). */
  std::map<DWORD, std::unique_ptr<CaptureStream>> captures_;
  std::unique_ptr<CaptureStream> endpointCapture_;

  std::thread controlThread_;
  HANDLE stopEvent_ = nullptr;
  HANDLE wakeEvent_ = nullptr;
  std::atomic<bool> running_{false};
  std::string lastState_;
};

}  // namespace zoi
