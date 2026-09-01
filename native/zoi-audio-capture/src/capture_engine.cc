#include "capture_engine.h"

#include <audioclientactivationparams.h>
#include <mmreg.h>
#include <wrl/implements.h>

#include <algorithm>
#include <cstdio>
#include <unordered_set>

namespace zoi {

namespace {

/** Espera maxima pela ativacao assincrona do Process Loopback. */
constexpr DWORD kActivationTimeoutMs = 3000;
/** Buffer WASAPI por captura: 20 ms, como na amostra oficial da Microsoft. */
constexpr REFERENCE_TIME kBufferDuration = 200000;
/** Cadencia da reconciliacao. Cobre as tres redes do SPEC secao 2.1. */
constexpr DWORD kReconcileIntervalMs = 1000;
/** Janela minima entre dois relatorios `health`. */
constexpr ULONGLONG kHealthReportIntervalMs = 15000;
/** Janela minima entre duas emissoes de `app-skipped` da MESMA chave. */
constexpr ULONGLONG kAppSkippedReplayMs = 10000;
/**
 * Por quanto tempo, a partir da subida do motor, a reemissao de `app-skipped`
 * acontece. Depois disso cada chave e emitida uma unica vez.
 *
 * O numero e ~30x o tempo tipico entre o fork do worker e a interface assinar o
 * canal de status (selecao de fonte mais setup de track), com folga deliberada
 * para maquina lenta ou usuario demorando no seletor de fonte.
 */
constexpr ULONGLONG kAppSkippedReplayWindowMs = 60000;

/** Por que uma sessao vista nao esta sendo capturada. */
enum SkipReason { kForbiddenTree = 0, kForbiddenSubtree = 1, kActivationFailed = 2 };

const char* SkipReasonText(int reason) {
  switch (reason) {
    case kForbiddenSubtree:
      return "subarvore-proibida";
    case kActivationFailed:
      return "falha-ativacao";
    default:
      return "arvore-proibida";
  }
}

/**
 * O motivo vira aviso na interface?
 *
 * `arvore-proibida` NUNCA vira aviso: e o Discord e o proprio Zoi, ou seja o
 * comportamento PRETENDIDO da captura por aplicativo. Avisar "o som do
 * discord.exe nao esta indo na transmissao" seria alarmar o usuario com o
 * produto funcionando, varias vezes por sessao. Os TRES motivos vao para o log;
 * so DOIS viram aviso.
 */
bool IsWarnableReason(int reason) {
  return reason == kForbiddenSubtree || reason == kActivationFailed;
}

std::string FormatHr(const char* stage, HRESULT hr) {
  char buffer[160];
  snprintf(buffer, sizeof(buffer), "%s (HRESULT 0x%08lX)", stage,
           static_cast<unsigned long>(hr));
  return std::string(buffer);
}

WAVEFORMATEX MakeFormat(const AudioFormat& format) {
  WAVEFORMATEX wave = {};
  wave.wFormatTag = WAVE_FORMAT_IEEE_FLOAT;
  wave.nChannels = format.channels;
  wave.nSamplesPerSec = format.sampleRate;
  wave.wBitsPerSample = 32;
  wave.nBlockAlign = static_cast<WORD>(wave.nChannels * wave.wBitsPerSample / 8);
  wave.nAvgBytesPerSec = wave.nSamplesPerSec * wave.nBlockAlign;
  wave.cbSize = 0;
  return wave;
}

bool IsFloatFormat(const WAVEFORMATEX* wave) {
  if (wave->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) return true;
  if (wave->wFormatTag == WAVE_FORMAT_EXTENSIBLE && wave->cbSize >= 22) {
    const auto* extensible = reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(wave);
    return IsEqualGUID(extensible->SubFormat, KSDATAFORMAT_SUBTYPE_IEEE_FLOAT) != 0;
  }
  return false;
}

/** Handler da ativacao assincrona: o WASAPI sempre responde por callback. */
class ActivationHandler
    : public Microsoft::WRL::RuntimeClass<
          Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,
          Microsoft::WRL::FtmBase,
          IActivateAudioInterfaceCompletionHandler> {
 public:
  HANDLE done = nullptr;
  HRESULT activateResult = E_UNEXPECTED;
  Microsoft::WRL::ComPtr<IAudioClient> audioClient;

  STDMETHODIMP ActivateCompleted(IActivateAudioInterfaceAsyncOperation* operation) override {
    Microsoft::WRL::ComPtr<IUnknown> activated;
    const HRESULT hr = operation->GetActivateResult(&activateResult, &activated);
    if (FAILED(hr)) {
      activateResult = hr;
    } else if (SUCCEEDED(activateResult) && activated) {
      activated.As(&audioClient);
    }
    if (done) SetEvent(done);
    return S_OK;
  }
};

}  // namespace

// ---------------------------------------------------------------------------
// CaptureStream
// ---------------------------------------------------------------------------

CaptureStream::CaptureStream(size_t capacityFrames, const AudioFormat& format)
    : format_(format), buffer_(capacityFrames, format.channels) {}

CaptureStream::~CaptureStream() {
  Stop();
}

HRESULT CaptureStream::StartProcessInclude(DWORD targetPid, std::string* detail) {
  targetPid_ = targetPid;

  AUDIOCLIENT_ACTIVATION_PARAMS activationParams = {};
  activationParams.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
  activationParams.ProcessLoopbackParams.TargetProcessId = targetPid;
  activationParams.ProcessLoopbackParams.ProcessLoopbackMode =
      PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;

  PROPVARIANT activationValue = {};
  activationValue.vt = VT_BLOB;
  activationValue.blob.cbSize = sizeof(activationParams);
  activationValue.blob.pBlobData = reinterpret_cast<BYTE*>(&activationParams);

  const HANDLE done = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (!done) return HRESULT_FROM_WIN32(GetLastError());

  auto handler = Microsoft::WRL::Make<ActivationHandler>();
  handler->done = done;

  Microsoft::WRL::ComPtr<IActivateAudioInterfaceAsyncOperation> operation;
  HRESULT hr =
      ActivateAudioInterfaceAsync(VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK, __uuidof(IAudioClient),
                                  &activationValue, handler.Get(), &operation);
  if (SUCCEEDED(hr)) {
    if (WaitForSingleObject(done, kActivationTimeoutMs) != WAIT_OBJECT_0) {
      hr = HRESULT_FROM_WIN32(ERROR_TIMEOUT);
    } else {
      hr = handler->activateResult;
    }
  }
  CloseHandle(done);

  if (FAILED(hr)) {
    *detail = FormatHr("ativacao de include falhou", hr);
    return hr;
  }
  if (!handler->audioClient) {
    *detail = "ativacao de include devolveu cliente nulo";
    return E_UNEXPECTED;
  }

  client_ = handler->audioClient;

  // Neste modo o formato PRECISA ser explicito: GetMixFormat nao e usavel.
  WAVEFORMATEX wave = MakeFormat(format_);
  hr = client_->Initialize(AUDCLNT_SHAREMODE_SHARED,
                           AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                           kBufferDuration, 0, &wave, nullptr);
  if (FAILED(hr)) {
    *detail = FormatHr("Initialize do include falhou", hr);
    client_.Reset();
    return hr;
  }

  needsConversion_ = false;
  return Launch(true, detail);
}

HRESULT CaptureStream::StartEndpointLoopback(IMMDevice* device, std::string* detail) {
  targetPid_ = 0;
  if (!device) return E_INVALIDARG;

  HRESULT hr = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, &client_);
  if (FAILED(hr)) {
    *detail = FormatHr("Activate do endpoint falhou", hr);
    return hr;
  }

  // O loopback classico NAO aceita modo event-driven: a leitura e por polling.
  WAVEFORMATEX wave = MakeFormat(format_);
  hr = client_->Initialize(
      AUDCLNT_SHAREMODE_SHARED,
      AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM |
          AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY,
      kBufferDuration, 0, &wave, nullptr);
  needsConversion_ = false;

  if (FAILED(hr)) {
    // Sem conversao automatica: aceita o formato do mixer e converte aqui.
    WAVEFORMATEX* mixFormat = nullptr;
    const HRESULT mixHr = client_->GetMixFormat(&mixFormat);
    if (FAILED(mixHr) || !mixFormat) {
      *detail = FormatHr("Initialize do endpoint falhou", hr);
      client_.Reset();
      return hr;
    }
    if (!IsFloatFormat(mixFormat)) {
      *detail = "formato do endpoint nao e float32";
      CoTaskMemFree(mixFormat);
      client_.Reset();
      return AUDCLNT_E_UNSUPPORTED_FORMAT;
    }
    sourceSampleRate_ = mixFormat->nSamplesPerSec;
    sourceChannels_ = mixFormat->nChannels;
    hr = client_->Initialize(AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK,
                             kBufferDuration, 0, mixFormat, nullptr);
    CoTaskMemFree(mixFormat);
    if (FAILED(hr)) {
      *detail = FormatHr("Initialize do endpoint falhou", hr);
      client_.Reset();
      return hr;
    }
    needsConversion_ = true;
    resamplePosition_ = 0.0;
    resampleTail_.assign(format_.channels, 0.0f);
  }

  return Launch(false, detail);
}

HRESULT CaptureStream::Launch(bool eventDriven, std::string* detail) {
  if (eventDriven) {
    sampleReadyEvent_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    if (!sampleReadyEvent_) return HRESULT_FROM_WIN32(GetLastError());
    const HRESULT hr = client_->SetEventHandle(sampleReadyEvent_);
    if (FAILED(hr)) {
      *detail = FormatHr("SetEventHandle falhou", hr);
      return hr;
    }
  }

  HRESULT hr = client_->GetService(__uuidof(IAudioCaptureClient), &capture_);
  if (FAILED(hr)) {
    *detail = FormatHr("GetService(IAudioCaptureClient) falhou", hr);
    return hr;
  }

  stopEvent_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (!stopEvent_) return HRESULT_FROM_WIN32(GetLastError());

  hr = client_->Start();
  if (FAILED(hr)) {
    *detail = FormatHr("Start da captura falhou", hr);
    return hr;
  }

  thread_ = std::thread([this, eventDriven]() { Run(eventDriven); });
  return S_OK;
}

void CaptureStream::Stop() {
  if (stopEvent_) SetEvent(stopEvent_);
  if (thread_.joinable()) thread_.join();
  if (client_) client_->Stop();

  capture_.Reset();
  client_.Reset();
  if (sampleReadyEvent_) {
    CloseHandle(sampleReadyEvent_);
    sampleReadyEvent_ = nullptr;
  }
  if (stopEvent_) {
    CloseHandle(stopEvent_);
    stopEvent_ = nullptr;
  }
}

void CaptureStream::ConvertAndStore(const BYTE* data, UINT32 frames, bool silent) {
  const uint16_t outChannels = format_.channels;

  if (!needsConversion_) {
    if (silent || !data) {
      converted_.assign(static_cast<size_t>(frames) * outChannels, 0.0f);
      buffer_.Write(converted_.data(), frames);
    } else {
      buffer_.Write(reinterpret_cast<const float*>(data), frames);
    }
    return;
  }

  // Downmix para 2 canais e reamostragem linear para a taxa alvo.
  const double ratio = static_cast<double>(sourceSampleRate_) / format_.sampleRate;
  const size_t maxOut = static_cast<size_t>(frames / ratio) + 2;
  converted_.assign(maxOut * outChannels, 0.0f);

  const float* input = silent ? nullptr : reinterpret_cast<const float*>(data);
  size_t produced = 0;
  double position = resamplePosition_;

  while (position < frames && produced < maxOut) {
    const size_t index = static_cast<size_t>(position);
    for (uint16_t channel = 0; channel < outChannels; ++channel) {
      float sample = 0.0f;
      if (input) {
        const uint16_t sourceChannel = std::min<uint16_t>(channel, sourceChannels_ - 1);
        sample = input[index * sourceChannels_ + sourceChannel];
      }
      converted_[produced * outChannels + channel] = sample;
    }
    ++produced;
    position += ratio;
  }

  resamplePosition_ = position - frames;
  if (resamplePosition_ < 0.0) resamplePosition_ = 0.0;
  if (produced > 0) buffer_.Write(converted_.data(), produced);
}

void CaptureStream::Run(bool eventDriven) {
  const HRESULT comHr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  const bool comOwned = SUCCEEDED(comHr);

  const HANDLE waits[2] = {stopEvent_, sampleReadyEvent_};
  while (true) {
    if (eventDriven) {
      const DWORD result = WaitForMultipleObjects(2, waits, FALSE, 200);
      if (result == WAIT_OBJECT_0) break;
    } else {
      if (WaitForSingleObject(stopEvent_, 5) == WAIT_OBJECT_0) break;
    }

    while (true) {
      BYTE* data = nullptr;
      UINT32 frames = 0;
      DWORD flags = 0;
      const HRESULT hr = capture_->GetBuffer(&data, &frames, &flags, nullptr, nullptr);
      if (hr == AUDCLNT_S_BUFFER_EMPTY) break;
      if (FAILED(hr)) {
        failed_.store(true);
        break;
      }
      if (frames > 0) {
        ConvertAndStore(data, frames, (flags & AUDCLNT_BUFFERFLAGS_SILENT) != 0);
      }
      capture_->ReleaseBuffer(frames);
      if (frames == 0) break;
    }

    if (failed_.load()) break;
  }

  if (comOwned) CoUninitialize();
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

Engine::~Engine() {
  Stop();
}

bool Engine::Start(const EngineOptions& options, PcmSink pcmSink, StatusSink statusSink,
                   std::string* error) {
  if (running_.load()) {
    *error = "motor ja esta ativo";
    return false;
  }

  options_ = options;
  statusSink_ = std::move(statusSink);

  stopEvent_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  wakeEvent_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (!stopEvent_ || !wakeEvent_) {
    *error = "falha ao criar eventos de controle";
    Stop();
    return false;
  }

  if (!mixer_.Start(options_.format, options_.frameMs, std::move(pcmSink))) {
    *error = "falha ao iniciar o relogio do mixer";
    Stop();
    return false;
  }

  running_.store(true);
  controlThread_ = std::thread([this]() { RunControlThread(); });
  return true;
}

void Engine::Stop() {
  running_.store(false);
  if (stopEvent_) SetEvent(stopEvent_);
  if (controlThread_.joinable()) controlThread_.join();

  mixer_.Stop();

  if (stopEvent_) {
    CloseHandle(stopEvent_);
    stopEvent_ = nullptr;
  }
  if (wakeEvent_) {
    CloseHandle(wakeEvent_);
    wakeEvent_ = nullptr;
  }
  statusSink_ = nullptr;
  lastState_.clear();
}

void Engine::Report(const std::string& state, const std::string& detail) {
  if (state == lastState_ && detail.empty()) return;
  lastState_ = state;
  if (statusSink_) statusSink_(state, detail);
}

void Engine::ReportRaw(const std::string& state, const std::string& detail) {
  if (statusSink_) statusSink_(state, detail);
}

void Engine::SetPcmDropCounter(std::shared_ptr<std::atomic<uint64_t>> counter) {
  pcmDropCounter_ = std::move(counter);
}

void Engine::ReportHealth() {
  const ULONGLONG now = GetTickCount64();

  // 1. Janela: sai sem tocar em contador nenhum.
  if (lastHealthAt_ != 0 && now - lastHealthAt_ < kHealthReportIntervalMs) return;

  // 2. Gatilho por PEEK, nunca por drenagem: `TakeHealth` e `exchange` ZERAM os
  //    contadores, e checar drenando apagaria justamente os eventos que se quer
  //    reportar quando a janela ainda nao abriu. `silentTicks` fica de FORA do
  //    gatilho de proposito: tique mudo e o estado normal de um aplicativo
  //    parado, e coloca-lo aqui faria o relatorio sair a cada 15 s para sempre,
  //    em qualquer maquina.
  const bool worth = mixer_.HasUnderrun() || (pcmDropCounter_ && pcmDropCounter_->load() > 0);
  if (!worth) return;

  // 3. So agora drena.
  const MixerHealth health = mixer_.TakeHealth();
  const uint64_t drops = pcmDropCounter_ ? pcmDropCounter_->exchange(0) : 0;

  char buffer[160];
  snprintf(buffer, sizeof(buffer), "underruns=%llu quadros=%llu mudos=%llu descartes-tsfn=%llu",
           static_cast<unsigned long long>(health.underrunTicks),
           static_cast<unsigned long long>(health.underrunFrames),
           static_cast<unsigned long long>(health.silentTicks),
           static_cast<unsigned long long>(drops));
  ReportRaw("health", buffer);
  lastHealthAt_ = now;
}

void Engine::PublishSources() {
  std::vector<AudioRingBuffer*> sources;
  if (endpointCapture_) sources.push_back(endpointCapture_->Buffer());
  for (const auto& pair : captures_) {
    sources.push_back(pair.second->Buffer());
  }
  mixer_.SetSources(std::move(sources));
}

void Engine::RunControlThread() {
  engineStartedAt_ = GetTickCount64();
  const HRESULT comHr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  const bool comOwned = SUCCEEDED(comHr);

  const HRESULT openHr = scanner_.Open(wakeEvent_);
  if (FAILED(openHr) && options_.mode == CaptureMode::ProcessExclusion) {
    Report("failed", FormatHr("nao foi possivel abrir o endpoint de audio", openHr));
    if (comOwned) CoUninitialize();
    return;
  }

  ProcessSnapshot snapshot;
  if (options_.mode == CaptureMode::ProcessExclusion) {
    Reconcile(&snapshot);
  } else {
    ReconcileEndpoint();
  }
  Report("active", "");

  const HANDLE waits[2] = {stopEvent_, wakeEvent_};
  while (running_.load()) {
    const DWORD result = WaitForMultipleObjects(2, waits, FALSE, kReconcileIntervalMs);
    if (result == WAIT_OBJECT_0) break;

    if (options_.mode == CaptureMode::ProcessExclusion) {
      if (result == WAIT_OBJECT_0 + 1) {
        // Sessao nova ou troca de endpoint: reabre o manager antes de olhar.
        scanner_.Reopen();
      }
      Reconcile(&snapshot);
    } else {
      ReconcileEndpoint();
    }
    ReportHealth();
  }

  // Derruba tudo ainda dentro do apartamento COM que criou os objetos.
  mixer_.SetSources({});
  captures_.clear();
  endpointCapture_.reset();
  scanner_.Close();
  if (comOwned) CoUninitialize();
}

void Engine::Reconcile(ProcessSnapshot* snapshot) {
  if (!snapshot->Refresh()) return;
  skipped_.clear();

  std::vector<DWORD> sessionPids;
  if (FAILED(scanner_.ListSessionPids(&sessionPids))) {
    // Endpoint pode ter sumido: tenta reabrir na proxima volta.
    scanner_.Reopen();
    return;
  }

  const std::vector<DWORD> forbidden = snapshot->ListForbidden(options_.forbidden);

  // Passo 1: so sessoes de PID vivo e fora de qualquer arvore proibida.
  std::vector<DWORD> allowed;
  for (const DWORD pid : sessionPids) {
    // Sessao de PID ja morto nao e recusa: e corrida normal entre a enumeracao
    // e a tabela de processos, entao nao entra na lista de diagnostico.
    if (!snapshot->Contains(pid)) continue;
    if (snapshot->IsForbidden(pid, options_.forbidden)) {
      skipped_.push_back({pid, kForbiddenTree, S_OK});
      continue;
    }
    allowed.push_back(pid);
  }

  // Passo 2: dedup por parentesco. Uma sessao descendente de outra ja esta
  // coberta pelo INCLUDE_TARGET_PROCESS_TREE da mais alta; abrir as duas
  // duplicaria o audio.
  std::vector<DWORD> anchors;
  for (const DWORD pid : allowed) {
    bool covered = false;
    for (const DWORD other : allowed) {
      if (other != pid && snapshot->IsAncestorOf(other, pid)) {
        covered = true;
        break;
      }
    }
    if (!covered) anchors.push_back(pid);
  }

  // Passo 3: pre-checagem de subarvore. Se existe qualquer processo proibido
  // dentro da arvore da ancora, o include NAO abre (e fecha se estava aberto).
  std::unordered_set<DWORD> keep;
  for (const DWORD pid : anchors) {
    if (snapshot->SubtreeContainsAny(pid, forbidden)) {
      skipped_.push_back({pid, kForbiddenSubtree, S_OK});
      continue;
    }
    keep.insert(pid);
  }

  bool changed = false;

  // Fecha o que nao pode mais existir (arvore morta, proibido apareceu dentro,
  // sessao coberta por uma ancora mais alta, ou captura que falhou sozinha).
  std::vector<DWORD> doomed;
  for (const auto& pair : captures_) {
    const bool stillWanted = keep.find(pair.first) != keep.end();
    if (!stillWanted || pair.second->Failed()) doomed.push_back(pair.first);
  }
  if (!doomed.empty()) {
    // Tirar do mixer ANTES de destruir: o relogio le os aneis por ponteiro.
    std::vector<AudioRingBuffer*> survivors;
    if (endpointCapture_) survivors.push_back(endpointCapture_->Buffer());
    for (const auto& pair : captures_) {
      if (std::find(doomed.begin(), doomed.end(), pair.first) == doomed.end()) {
        survivors.push_back(pair.second->Buffer());
      }
    }
    mixer_.SetSources(std::move(survivors));
    for (const DWORD pid : doomed) captures_.erase(pid);
    changed = true;
  }

  // Abre o que falta.
  for (const DWORD pid : keep) {
    if (captures_.find(pid) != captures_.end()) continue;

    auto stream = std::make_unique<CaptureStream>(
        static_cast<size_t>(options_.format.sampleRate) / 5, options_.format);
    std::string detail;
    const HRESULT startHr = stream->StartProcessInclude(pid, &detail);
    if (FAILED(startHr)) {
      // Falha parcial nao derruba o motor: segue com as outras capturas.
      skipped_.push_back({pid, kActivationFailed, startHr});
      continue;
    }
    captures_[pid] = std::move(stream);
    changed = true;
  }

  if (changed) {
    PublishSources();
    Report("active", DescribeAnchors(*snapshot));
  }

  // Log das sessoes vistas e nao capturadas. Este caminho e INCONDICIONAL e nao
  // depende de assinante nenhum: e a transparencia que substitui o aviso que o
  // sistema nao tem informacao para dar.
  const std::string signature = DescribeSkipped(*snapshot, sessionPids.size());
  if (signature != lastSkippedSignature_) {
    lastSkippedSignature_ = signature;
    ReportRaw("skipped", signature);
  }

  // Aviso por aplicativo, so para os motivos AVISAVEIS. A reemissao existe
  // porque o motor roda o primeiro Reconcile milissegundos depois do fork,
  // muito antes de a interface assinar o canal de status: sem ela, a unica
  // emissao cairia no vazio e o aviso nunca chegaria ao usuario.
  const ULONGLONG now = GetTickCount64();
  const bool withinReplayWindow = (now - engineStartedAt_) < kAppSkippedReplayWindowMs;
  for (const SkipEntry& entry : skipped_) {
    if (!IsWarnableReason(entry.reason)) continue;
    const uint64_t key =
        static_cast<uint64_t>(entry.pid) * 256ull + static_cast<uint64_t>(entry.reason);
    const auto found = warnedApps_.find(key);
    const bool isNew = found == warnedApps_.end();
    const bool canRepeat =
        !isNew && withinReplayWindow && (now - found->second) >= kAppSkippedReplayMs;
    if (!isNew && !canRepeat) continue;

    warnedApps_[key] = now;
    const ProcessEntry* process = snapshot->Find(entry.pid);
    ReportRaw("app-skipped", process ? ToUtf8(process->exeName) : std::string());
  }
}

std::string Engine::DescribeSkipped(const ProcessSnapshot& snapshot, size_t seenCount) const {
  std::string detail = "vistas=" + std::to_string(seenCount);
  int listed = 0;
  for (const SkipEntry& entry : skipped_) {
    if (listed >= 10) {
      detail += " ...";
      break;
    }
    const ProcessEntry* process = snapshot.Find(entry.pid);
    detail += " " + std::to_string(entry.pid) + ":" +
              (process ? ToUtf8(process->exeName) : "?") + "=" + SkipReasonText(entry.reason);
    if (entry.reason == kActivationFailed) {
      char code[16];
      snprintf(code, sizeof(code), "(0x%08lX)", static_cast<unsigned long>(entry.hr));
      detail += code;
    }
    ++listed;
  }
  return detail;
}

std::string Engine::DescribeAnchors(const ProcessSnapshot& snapshot) const {
  std::string detail = "capturas=" + std::to_string(captures_.size());
  int listed = 0;
  for (const auto& pair : captures_) {
    if (listed >= 10) {
      detail += " ...";
      break;
    }
    const ProcessEntry* entry = snapshot.Find(pair.first);
    detail += " " + std::to_string(pair.first) + ":" + (entry ? ToUtf8(entry->exeName) : "?");
    ++listed;
  }
  return detail;
}

void Engine::ReconcileEndpoint() {
  if (endpointCapture_ && !endpointCapture_->Failed()) return;

  if (endpointCapture_) {
    mixer_.SetSources({});
    endpointCapture_.reset();
  }

  Microsoft::WRL::ComPtr<IMMDevice> device;
  if (FAILED(scanner_.GetDefaultDevice(&device)) || !device) {
    Report("failed", "nenhum dispositivo de saida padrao disponivel");
    return;
  }

  auto stream = std::make_unique<CaptureStream>(
      static_cast<size_t>(options_.format.sampleRate) / 5, options_.format);
  std::string detail;
  if (FAILED(stream->StartEndpointLoopback(device.Get(), &detail))) {
    Report("failed", detail);
    return;
  }

  endpointCapture_ = std::move(stream);
  PublishSources();
}

}  // namespace zoi
