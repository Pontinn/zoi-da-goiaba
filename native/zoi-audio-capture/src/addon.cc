// Addon nativo de captura de audio do Zoi (Windows / WASAPI).
//
// Sprint 1 (spike): so o `probe()` e real. Ele tenta uma ativacao de Process
// Loopback de verdade (modo EXCLUDE ancorado no proprio PID) e descarta o
// cliente: e o unico teste honesto de disponibilidade da API na maquina.
// `start`/`stop` sao stubs que lancam `not-implemented` ate o Sprint 2.

#include <napi.h>

#include <windows.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <mmdeviceapi.h>
#include <wrl/implements.h>

#include <string>
#include <thread>

namespace {

constexpr DWORD kActivationTimeoutMs = 5000;

/**
 * Handler de conclusao da ativacao assincrona. `ActivateAudioInterfaceAsync`
 * sempre devolve o resultado por callback, mesmo quando falha de imediato.
 */
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
    if (done) {
      SetEvent(done);
    }
    return S_OK;
  }
};

std::string FormatStage(const char* stage, HRESULT hr) {
  char buffer[128];
  snprintf(buffer, sizeof(buffer), "%s falhou (HRESULT 0x%08lX)", stage,
           static_cast<unsigned long>(hr));
  return std::string(buffer);
}

/** Formato exigido pelo Process Loopback: PCM float 32 bits, 48 kHz, estereo. */
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

/**
 * Roda numa thread propria com COM em MTA: o handler de conclusao chega em
 * thread arbitraria do WASAPI e nao pode depender do apartamento do Node.
 */
std::string RunProbeOnComThread() {
  const HRESULT comHr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(comHr)) {
    return FormatStage("CoInitializeEx", comHr);
  }

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

    auto handler = Microsoft::WRL::Make<ActivationHandler>();
    handler->done = done;

    Microsoft::WRL::ComPtr<IActivateAudioInterfaceAsyncOperation> operation;
    HRESULT hr = ActivateAudioInterfaceAsync(VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
                                             __uuidof(IAudioClient), &activationValue,
                                             handler.Get(), &operation);
    if (FAILED(hr)) {
      error = FormatStage("ActivateAudioInterfaceAsync", hr);
    } else if (WaitForSingleObject(done, kActivationTimeoutMs) != WAIT_OBJECT_0) {
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
          if (FAILED(hr)) {
            error = FormatStage("GetService(IAudioCaptureClient)", hr);
          }
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
        if (sampleReady) {
          CloseHandle(sampleReady);
        }
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
  result.Set("error", error.empty() ? env.Null()
                                    : static_cast<Napi::Value>(
                                          Napi::String::New(env, error)));
  return result;
}

Napi::Value Start(const Napi::CallbackInfo& info) {
  Napi::Error::New(info.Env(), "not-implemented").ThrowAsJavaScriptException();
  return info.Env().Undefined();
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
  Napi::Error::New(info.Env(), "not-implemented").ThrowAsJavaScriptException();
  return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("probe", Napi::Function::New(env, Probe));
  exports.Set("start", Napi::Function::New(env, Start));
  exports.Set("stop", Napi::Function::New(env, Stop));
  return exports;
}

}  // namespace

NODE_API_MODULE(zoi_audio_capture, Init)
