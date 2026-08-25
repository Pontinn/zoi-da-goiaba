// Superficie N-API do addon de captura de audio do Zoi (Windows / WASAPI).
//
// `probe()` continua sendo a checagem honesta de disponibilidade: ativa um
// Process Loopback de verdade e descarta. `start`/`stop` sobem e derrubam o
// motor de composicao de includes (capture_engine.cc).
//
// Os callbacks JS sao entregues por ThreadSafeFunction. O frame PCM e COPIADO
// para um ArrayBuffer novo dentro da thread do JS: ArrayBuffer externo nao e
// confiavel sob o sandbox de memoria do V8, e a copia de 3,8 KB por frame e
// irrelevante perto do custo de um frame de video.

#include <napi.h>

#include <windows.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <mmdeviceapi.h>
#include <wrl/implements.h>

#include <cstring>
#include <map>
#include <memory>
#include <string>
#include <thread>
#include <vector>

#include "capture_engine.h"

namespace {

constexpr DWORD kProbeTimeoutMs = 5000;
/** Fila da ThreadSafeFunction: ~1 s de audio. Cheia, o frame e descartado. */
constexpr size_t kPcmQueueSize = 128;

// ---------------------------------------------------------------------------
// probe
// ---------------------------------------------------------------------------

class ProbeHandler
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

std::string FormatStage(const char* stage, HRESULT hr) {
  char buffer[160];
  snprintf(buffer, sizeof(buffer), "%s falhou (HRESULT 0x%08lX)", stage,
           static_cast<unsigned long>(hr));
  return std::string(buffer);
}

WAVEFORMATEX MakeCaptureFormat() {
  WAVEFORMATEX format = {};
  format.wFormatTag = WAVE_FORMAT_IEEE_FLOAT;
  format.nChannels = 2;
  format.nSamplesPerSec = 48000;
  format.wBitsPerSample = 32;
  format.nBlockAlign = static_cast<WORD>(format.nChannels * format.wBitsPerSample / 8);
  format.nAvgBytesPerSec = format.nSamplesPerSec * format.nBlockAlign;
  format.cbSize = 0;
  return format;
}

std::string RunProbeOnComThread() {
  const HRESULT comHr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(comHr)) return FormatStage("CoInitializeEx", comHr);

  std::string error;
  {
    AUDIOCLIENT_ACTIVATION_PARAMS activationParams = {};
    activationParams.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    activationParams.ProcessLoopbackParams.TargetProcessId = GetCurrentProcessId();
    activationParams.ProcessLoopbackParams.ProcessLoopbackMode =
        PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE;

    PROPVARIANT activationValue = {};
    activationValue.vt = VT_BLOB;
    activationValue.blob.cbSize = sizeof(activationParams);
    activationValue.blob.pBlobData = reinterpret_cast<BYTE*>(&activationParams);

    const HANDLE done = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    if (!done) {
      CoUninitialize();
      return FormatStage("CreateEvent", HRESULT_FROM_WIN32(GetLastError()));
    }

    auto handler = Microsoft::WRL::Make<ProbeHandler>();
    handler->done = done;

    Microsoft::WRL::ComPtr<IActivateAudioInterfaceAsyncOperation> operation;
    HRESULT hr = ActivateAudioInterfaceAsync(VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
                                             __uuidof(IAudioClient), &activationValue,
                                             handler.Get(), &operation);
    if (FAILED(hr)) {
      error = FormatStage("ActivateAudioInterfaceAsync", hr);
    } else if (WaitForSingleObject(done, kProbeTimeoutMs) != WAIT_OBJECT_0) {
      error = "ActivateAudioInterfaceAsync nao respondeu no tempo limite";
    } else if (FAILED(handler->activateResult)) {
      error = FormatStage("GetActivateResult", handler->activateResult);
    } else if (!handler->audioClient) {
      error = "ativacao devolveu um IAudioClient nulo";
    } else {
      IAudioClient* client = handler->audioClient.Get();
      WAVEFORMATEX format = MakeCaptureFormat();
      hr = client->Initialize(AUDCLNT_SHAREMODE_SHARED,
                              AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                              200000, 0, &format, nullptr);
      if (FAILED(hr)) {
        error = FormatStage("IAudioClient::Initialize", hr);
      } else {
        const HANDLE sampleReady = CreateEventW(nullptr, FALSE, FALSE, nullptr);
        hr = sampleReady ? client->SetEventHandle(sampleReady)
                         : HRESULT_FROM_WIN32(GetLastError());
        Microsoft::WRL::ComPtr<IAudioCaptureClient> captureClient;
        if (SUCCEEDED(hr)) {
          hr = client->GetService(__uuidof(IAudioCaptureClient), &captureClient);
          if (FAILED(hr)) error = FormatStage("GetService(IAudioCaptureClient)", hr);
        } else {
          error = FormatStage("SetEventHandle", hr);
        }

        if (error.empty()) {
          hr = client->Start();
          if (FAILED(hr)) {
            error = FormatStage("IAudioClient::Start", hr);
          } else {
            client->Stop();
            client->Reset();
          }
        }
        if (sampleReady) CloseHandle(sampleReady);
      }
    }

    CloseHandle(done);
  }

  CoUninitialize();
  return error;
}

Napi::Value Probe(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  std::string error;
  std::thread worker([&error]() { error = RunProbeOnComThread(); });
  worker.join();

  Napi::Object result = Napi::Object::New(env);
  result.Set("ok", Napi::Boolean::New(env, error.empty()));
  result.Set("error", error.empty()
                          ? env.Null()
                          : static_cast<Napi::Value>(Napi::String::New(env, error)));
  return result;
}

// ---------------------------------------------------------------------------
// start / stop
// ---------------------------------------------------------------------------

struct PcmFrame {
  std::vector<float> samples;
  int64_t timestampUs = 0;
};

struct StatusMessage {
  std::string state;
  std::string detail;
};

/** Uma captura viva: motor + as pontes para os callbacks JS. */
struct CaptureSession {
  zoi::Engine engine;
  Napi::ThreadSafeFunction pcmCallback;
  Napi::ThreadSafeFunction statusCallback;
};

std::map<int32_t, std::unique_ptr<CaptureSession>> g_sessions;
int32_t g_nextHandle = 1;

std::wstring Widen(const std::string& value) {
  if (value.empty()) return std::wstring();
  const int size =
      MultiByteToWideChar(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), nullptr, 0);
  std::wstring wide(static_cast<size_t>(size), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), wide.data(),
                      size);
  return wide;
}

bool ReadOptions(Napi::Env env, const Napi::Object& source, zoi::EngineOptions* options,
                 std::string* error) {
  const std::string mode =
      source.Has("mode") ? source.Get("mode").ToString().Utf8Value() : "process-exclusion";
  if (mode == "endpoint-loopback") {
    options->mode = zoi::CaptureMode::EndpointLoopback;
  } else if (mode == "process-exclusion") {
    options->mode = zoi::CaptureMode::ProcessExclusion;
  } else {
    *error = "mode invalido";
    return false;
  }

  if (source.Has("excludedExecutables")) {
    Napi::Value value = source.Get("excludedExecutables");
    if (!value.IsArray()) {
      *error = "excludedExecutables deve ser uma lista";
      return false;
    }
    Napi::Array list = value.As<Napi::Array>();
    for (uint32_t index = 0; index < list.Length(); ++index) {
      const std::string name = list.Get(index).ToString().Utf8Value();
      options->forbidden.executables.insert(zoi::ToLowerBaseName(Widen(name)));
    }
  }

  if (source.Has("excludedRootPids")) {
    Napi::Value value = source.Get("excludedRootPids");
    if (!value.IsArray()) {
      *error = "excludedRootPids deve ser uma lista";
      return false;
    }
    Napi::Array list = value.As<Napi::Array>();
    for (uint32_t index = 0; index < list.Length(); ++index) {
      const double pid = list.Get(index).ToNumber().DoubleValue();
      if (pid > 0) options->forbidden.rootPids.insert(static_cast<DWORD>(pid));
    }
  }

  options->format.sampleRate =
      source.Has("sampleRate") ? source.Get("sampleRate").ToNumber().Uint32Value() : 48000;
  options->format.channels = static_cast<uint16_t>(
      source.Has("channels") ? source.Get("channels").ToNumber().Uint32Value() : 2);
  options->frameMs = source.Has("frameMs") ? source.Get("frameMs").ToNumber().Uint32Value() : 10;

  if (options->format.sampleRate < 8000 || options->format.sampleRate > 192000) {
    *error = "sampleRate fora da faixa suportada";
    return false;
  }
  if (options->format.channels < 1 || options->format.channels > 2) {
    *error = "channels deve ser 1 ou 2";
    return false;
  }
  if (options->frameMs < 5 || options->frameMs > 100) {
    *error = "frameMs fora da faixa suportada";
    return false;
  }

  (void)env;
  return true;
}

Napi::Value Start(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 3 || !info[0].IsObject() || !info[1].IsFunction() ||
      !info[2].IsFunction()) {
    Napi::TypeError::New(env, "start(options, onPcm, onStatus)").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  zoi::EngineOptions options;
  std::string error;
  if (!ReadOptions(env, info[0].As<Napi::Object>(), &options, &error)) {
    Napi::TypeError::New(env, error).ThrowAsJavaScriptException();
    return env.Undefined();
  }

  auto session = std::make_unique<CaptureSession>();
  session->pcmCallback = Napi::ThreadSafeFunction::New(env, info[1].As<Napi::Function>(),
                                                       "zoi-audio-pcm", kPcmQueueSize, 1);
  session->statusCallback = Napi::ThreadSafeFunction::New(env, info[2].As<Napi::Function>(),
                                                          "zoi-audio-status", 16, 1);

  Napi::ThreadSafeFunction pcmCallback = session->pcmCallback;
  Napi::ThreadSafeFunction statusCallback = session->statusCallback;

  auto pcmSink = [pcmCallback](const float* samples, size_t sampleCount,
                               int64_t timestampUs) mutable {
    auto* frame = new PcmFrame();
    frame->samples.assign(samples, samples + sampleCount);
    frame->timestampUs = timestampUs;

    const napi_status status = pcmCallback.NonBlockingCall(
        frame, [](Napi::Env callbackEnv, Napi::Function jsCallback, PcmFrame* payload) {
          const size_t byteLength = payload->samples.size() * sizeof(float);
          Napi::ArrayBuffer buffer = Napi::ArrayBuffer::New(callbackEnv, byteLength);
          std::memcpy(buffer.Data(), payload->samples.data(), byteLength);
          jsCallback.Call({buffer, Napi::Number::New(callbackEnv,
                                                     static_cast<double>(payload->timestampUs))});
          delete payload;
        });
    // Fila cheia: descartar o frame e melhor do que acumular atraso de audio.
    if (status != napi_ok) delete frame;
  };

  auto statusSink = [statusCallback](const std::string& state,
                                     const std::string& detail) mutable {
    auto* message = new StatusMessage{state, detail};
    const napi_status status = statusCallback.NonBlockingCall(
        message, [](Napi::Env callbackEnv, Napi::Function jsCallback, StatusMessage* payload) {
          jsCallback.Call({Napi::String::New(callbackEnv, payload->state),
                           Napi::String::New(callbackEnv, payload->detail)});
          delete payload;
        });
    if (status != napi_ok) delete message;
  };

  if (!session->engine.Start(options, pcmSink, statusSink, &error)) {
    session->pcmCallback.Release();
    session->statusCallback.Release();
    Napi::Error::New(env, error).ThrowAsJavaScriptException();
    return env.Undefined();
  }

  const int32_t handle = g_nextHandle++;
  g_sessions[handle] = std::move(session);
  return Napi::Number::New(env, handle);
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsNumber()) return env.Undefined();

  const int32_t handle = info[0].As<Napi::Number>().Int32Value();
  const auto found = g_sessions.find(handle);
  if (found == g_sessions.end()) return env.Undefined();

  // Ordem obrigatoria: o motor para (e junta as threads) ANTES de soltar as
  // pontes de callback, senao uma chamada em voo cairia numa funcao liberada.
  std::unique_ptr<CaptureSession> session = std::move(found->second);
  g_sessions.erase(found);
  session->engine.Stop();
  session->pcmCallback.Release();
  session->statusCallback.Release();

  return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("probe", Napi::Function::New(env, Probe));
  exports.Set("start", Napi::Function::New(env, Start));
  exports.Set("stop", Napi::Function::New(env, Stop));
  return exports;
}

}  // namespace

NODE_API_MODULE(zoi_audio_capture, Init)
