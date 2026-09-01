#include "session_tracker.h"

#include <tlhelp32.h>
#include <wrl/implements.h>

#include <algorithm>

namespace zoi {

namespace {

/** Corta cadeias de parentesco patologicas (ou ciclicas) na varredura. */
constexpr int kMaxAncestorDepth = 64;

/**
 * Teto de endpoints de render escaneados por volta. Sem ele, uma maquina com
 * muitos dispositivos virtuais (HDMI por monitor, cabo de audio, placa de
 * captura) poderia truncar justamente o dispositivo que funcionava antes; com
 * ele mais a insercao do padrao na posicao 0, o dispositivo de hoje nunca e
 * cortado.
 */
constexpr size_t kMaxScannedEndpoints = 8;

}  // namespace

std::wstring ToLowerBaseName(const std::wstring& path) {
  const size_t slash = path.find_last_of(L"\\/");
  std::wstring name = slash == std::wstring::npos ? path : path.substr(slash + 1);
  std::transform(name.begin(), name.end(), name.begin(),
                 [](wchar_t ch) { return static_cast<wchar_t>(towlower(ch)); });
  return name;
}

std::string ToUtf8(const std::wstring& value) {
  if (value.empty()) return std::string();
  const int size = WideCharToMultiByte(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()),
                                       nullptr, 0, nullptr, nullptr);
  std::string narrow(static_cast<size_t>(size), '\0');
  WideCharToMultiByte(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), narrow.data(),
                      size, nullptr, nullptr);
  return narrow;
}

// ---------------------------------------------------------------------------
// ProcessSnapshot
// ---------------------------------------------------------------------------

bool ProcessSnapshot::Refresh() {
  entries_.clear();
  creationTimes_.clear();

  const HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) return false;

  PROCESSENTRY32W entry = {};
  entry.dwSize = sizeof(entry);
  if (Process32FirstW(snapshot, &entry)) {
    do {
      ProcessEntry item;
      item.pid = entry.th32ProcessID;
      item.parentPid = entry.th32ParentProcessID;
      item.exeName = ToLowerBaseName(entry.szExeFile);
      entries_[item.pid] = std::move(item);
    } while (Process32NextW(snapshot, &entry));
  }

  CloseHandle(snapshot);
  return !entries_.empty();
}

bool ProcessSnapshot::Contains(DWORD pid) const {
  return entries_.find(pid) != entries_.end();
}

const ProcessEntry* ProcessSnapshot::Find(DWORD pid) const {
  const auto found = entries_.find(pid);
  return found == entries_.end() ? nullptr : &found->second;
}

ULONGLONG ProcessSnapshot::CreationTime(DWORD pid) const {
  const auto cached = creationTimes_.find(pid);
  if (cached != creationTimes_.end()) return cached->second;

  ULONGLONG value = 0;
  const HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (process) {
    FILETIME creation = {};
    FILETIME exitTime = {};
    FILETIME kernelTime = {};
    FILETIME userTime = {};
    if (GetProcessTimes(process, &creation, &exitTime, &kernelTime, &userTime)) {
      ULARGE_INTEGER packed;
      packed.LowPart = creation.dwLowDateTime;
      packed.HighPart = creation.dwHighDateTime;
      value = packed.QuadPart;
    }
    CloseHandle(process);
  }

  creationTimes_[pid] = value;
  return value;
}

bool ProcessSnapshot::IsAncestorOf(DWORD ancestorPid, DWORD pid) const {
  DWORD current = pid;
  for (int depth = 0; depth < kMaxAncestorDepth; ++depth) {
    const auto found = entries_.find(current);
    if (found == entries_.end()) return false;

    const DWORD parent = found->second.parentPid;
    if (parent == 0 || parent == current) return false;
    if (entries_.find(parent) == entries_.end()) return false;

    // Anti reuso de PID: um pai criado DEPOIS do filho e um PID reciclado.
    // Tempo desconhecido nao invalida o elo: a direcao segura e detectar
    // proibido demais (perde-se audio de um app) e nunca de menos.
    const ULONGLONG parentTime = CreationTime(parent);
    const ULONGLONG childTime = CreationTime(current);
    if (parentTime != 0 && childTime != 0 && parentTime > childTime) return false;

    if (parent == ancestorPid) return true;
    current = parent;
  }
  return false;
}

bool ProcessSnapshot::IsForbidden(DWORD pid, const ForbiddenRules& rules) const {
  DWORD current = pid;
  for (int depth = 0; depth < kMaxAncestorDepth; ++depth) {
    if (rules.rootPids.find(current) != rules.rootPids.end()) return true;

    const auto found = entries_.find(current);
    if (found == entries_.end()) return false;
    if (rules.executables.find(found->second.exeName) != rules.executables.end()) return true;

    const DWORD parent = found->second.parentPid;
    if (parent == 0 || parent == current) return false;
    if (entries_.find(parent) == entries_.end()) return false;

    const ULONGLONG parentTime = CreationTime(parent);
    const ULONGLONG childTime = CreationTime(current);
    if (parentTime != 0 && childTime != 0 && parentTime > childTime) return false;

    current = parent;
  }
  return false;
}

std::vector<DWORD> ProcessSnapshot::ListForbidden(const ForbiddenRules& rules) const {
  std::vector<DWORD> forbidden;
  for (const auto& pair : entries_) {
    if (IsForbidden(pair.first, rules)) forbidden.push_back(pair.first);
  }
  return forbidden;
}

bool ProcessSnapshot::SubtreeContainsAny(DWORD rootPid, const std::vector<DWORD>& pids) const {
  for (const DWORD pid : pids) {
    if (pid == rootPid) return true;
    if (IsAncestorOf(rootPid, pid)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Notificacoes COM
// ---------------------------------------------------------------------------

namespace {

/**
 * Sessao de audio nova. O callback chega em thread arbitraria do WASAPI, entao
 * ele NAO faz trabalho nenhum: so acorda a thread de controle, que reclassifica
 * tudo com um snapshot fresco. Isso e a rede (i) do SPEC secao 2.1.
 */
class SessionNotifier
    : public Microsoft::WRL::RuntimeClass<
          Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,
          Microsoft::WRL::FtmBase,
          IAudioSessionNotification> {
 public:
  explicit SessionNotifier(HANDLE wakeEvent) : wakeEvent_(wakeEvent) {}

  STDMETHODIMP OnSessionCreated(IAudioSessionControl* /*session*/) override {
    if (wakeEvent_) SetEvent(wakeEvent_);
    return S_OK;
  }

 private:
  HANDLE wakeEvent_ = nullptr;
};

/** Troca do endpoint de render padrao: forca reconciliacao imediata. */
class DeviceNotifier
    : public Microsoft::WRL::RuntimeClass<
          Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,
          Microsoft::WRL::FtmBase,
          IMMNotificationClient> {
 public:
  explicit DeviceNotifier(HANDLE wakeEvent) : wakeEvent_(wakeEvent) {}

  STDMETHODIMP OnDeviceStateChanged(LPCWSTR, DWORD) override { return Wake(); }
  STDMETHODIMP OnDeviceAdded(LPCWSTR) override { return S_OK; }
  STDMETHODIMP OnDeviceRemoved(LPCWSTR) override { return Wake(); }
  STDMETHODIMP OnDefaultDeviceChanged(EDataFlow flow, ERole, LPCWSTR) override {
    return flow == eRender ? Wake() : S_OK;
  }
  STDMETHODIMP OnPropertyValueChanged(LPCWSTR, const PROPERTYKEY) override { return S_OK; }

 private:
  HRESULT Wake() {
    if (wakeEvent_) SetEvent(wakeEvent_);
    return S_OK;
  }

  HANDLE wakeEvent_ = nullptr;
};

}  // namespace

// ---------------------------------------------------------------------------
// SessionScanner
// ---------------------------------------------------------------------------

SessionScanner::~SessionScanner() {
  Close();
}

HRESULT SessionScanner::Open(HANDLE wakeEvent) {
  wakeEvent_ = wakeEvent;

  HRESULT hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                                IID_PPV_ARGS(&enumerator_));
  if (FAILED(hr)) return hr;

  deviceNotifier_ = Microsoft::WRL::Make<DeviceNotifier>(wakeEvent_);
  hr = enumerator_->RegisterEndpointNotificationCallback(deviceNotifier_.Get());
  if (FAILED(hr)) deviceNotifier_.Reset();

  return Reopen();
}

bool SessionScanner::BindEndpoint(const Microsoft::WRL::ComPtr<IMMDevice>& device,
                                  EndpointBinding* out) {
  if (!device) return false;

  Microsoft::WRL::ComPtr<IAudioSessionManager2> manager;
  if (FAILED(device->Activate(__uuidof(IAudioSessionManager2), CLSCTX_ALL, nullptr, &manager))) {
    return false;
  }

  // Uma enumeracao inicial e pre-requisito documentado para que o
  // IAudioSessionManager2 comece a emitir OnSessionCreated.
  Microsoft::WRL::ComPtr<IAudioSessionEnumerator> sessions;
  manager->GetSessionEnumerator(&sessions);

  Microsoft::WRL::ComPtr<IAudioSessionNotification> notifier =
      Microsoft::WRL::Make<SessionNotifier>(wakeEvent_);
  // Registro que falha nao invalida o binding: a deteccao de sessao nova
  // naquele dispositivo passa a depender so do poll de 1 s, que ja e a rede de
  // seguranca declarada. Degradacao suave, nunca perda.
  if (FAILED(manager->RegisterSessionNotification(notifier.Get()))) notifier.Reset();

  out->device = device;
  out->manager = manager;
  out->notifier = notifier;
  return true;
}

HRESULT SessionScanner::Reopen() {
  if (!enumerator_) return E_UNEXPECTED;

  for (EndpointBinding& binding : endpoints_) {
    if (binding.manager && binding.notifier) {
      binding.manager->UnregisterSessionNotification(binding.notifier.Get());
    }
  }
  endpoints_.clear();
  defaultBound_ = false;

  // Dispositivo padrao de console: o unico que NAO pode ser cortado pelo teto
  // nem perdido em silencio, porque e o unico que a versao anterior escaneava.
  Microsoft::WRL::ComPtr<IMMDevice> defaultDevice;
  const HRESULT defaultHr =
      enumerator_->GetDefaultAudioEndpoint(eRender, eConsole, &defaultDevice);

  std::wstring defaultId;
  if (SUCCEEDED(defaultHr) && defaultDevice) {
    LPWSTR rawId = nullptr;
    if (SUCCEEDED(defaultDevice->GetId(&rawId)) && rawId) {
      defaultId.assign(rawId);
      CoTaskMemFree(rawId);
    }
  }

  Microsoft::WRL::ComPtr<IMMDeviceCollection> collection;
  if (SUCCEEDED(enumerator_->EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE, &collection)) &&
      collection) {
    UINT count = 0;
    if (FAILED(collection->GetCount(&count))) count = 0;

    for (UINT index = 0; index < count; ++index) {
      if (endpoints_.size() >= kMaxScannedEndpoints) break;

      Microsoft::WRL::ComPtr<IMMDevice> device;
      if (FAILED(collection->Item(index, &device)) || !device) continue;

      bool isDefault = false;
      LPWSTR rawId = nullptr;
      if (SUCCEEDED(device->GetId(&rawId)) && rawId) {
        isDefault = !defaultId.empty() && defaultId == rawId;
        CoTaskMemFree(rawId);
      }

      EndpointBinding binding;
      // Um dispositivo problematico nunca derruba os outros.
      if (!BindEndpoint(device, &binding)) continue;

      if (isDefault) {
        endpoints_.insert(endpoints_.begin(), std::move(binding));
        defaultBound_ = true;
      } else {
        endpoints_.push_back(std::move(binding));
      }
    }
  }

  // Degrau de seguranca, nivel 6a: o padrao nao foi vinculado (a enumeracao
  // falhou, ele nao apareceu na colecao, ou o Activate dele falhou). Tenta
  // EXPLICITAMENTE o caminho de antes desta feature. Este passo roda mesmo com
  // `endpoints_` ja cheio de outros dispositivos: sem ele, um Activate que
  // falhasse so no padrao enquanto outro dispositivo funcionasse faria o unico
  // endpoint da versao anterior sumir sem erro e sem log.
  if (!defaultBound_) {
    Microsoft::WRL::ComPtr<IMMDevice> fallback = defaultDevice;
    HRESULT fallbackHr = defaultHr;
    if (!fallback) {
      fallbackHr = enumerator_->GetDefaultAudioEndpoint(eRender, eConsole, &fallback);
    }
    EndpointBinding binding;
    if (SUCCEEDED(fallbackHr) && fallback && BindEndpoint(fallback, &binding)) {
      endpoints_.insert(endpoints_.begin(), std::move(binding));
      defaultBound_ = true;
    } else if (endpoints_.empty()) {
      // Nivel 6b, ultimo recurso: sem endpoint nenhum, devolve o HRESULT da
      // falha do padrao, que e o que o motor ja transforma em `failed` hoje.
      return FAILED(fallbackHr) ? fallbackHr : E_FAIL;
    }
  }

  return endpoints_.empty() ? E_FAIL : S_OK;
}

void SessionScanner::Close() {
  for (EndpointBinding& binding : endpoints_) {
    if (binding.manager && binding.notifier) {
      binding.manager->UnregisterSessionNotification(binding.notifier.Get());
    }
  }
  endpoints_.clear();
  defaultBound_ = false;
  if (enumerator_ && deviceNotifier_) {
    enumerator_->UnregisterEndpointNotificationCallback(deviceNotifier_.Get());
  }
  deviceNotifier_.Reset();
  enumerator_.Reset();
  wakeEvent_ = nullptr;
}

std::string SessionScanner::DescribeEndpoints() const {
  return std::to_string(endpoints_.size());
}

bool SessionScanner::DefaultEndpointBound() const {
  return defaultBound_;
}

HRESULT SessionScanner::ListSessionPids(std::vector<DWORD>* out) const {
  out->clear();
  if (endpoints_.empty()) return E_UNEXPECTED;

  // O `seen` vive FORA do laco de endpoints: e ele que faz a UNIAO sem
  // repeticao. O mesmo processo com sessao em dois dispositivos vira uma unica
  // ancora, que e o correto (o include captura o que o processo renderiza, nao
  // o que um dispositivo toca).
  std::unordered_set<DWORD> seen;
  bool anyEndpointAnswered = false;

  for (const EndpointBinding& binding : endpoints_) {
    if (!binding.manager) continue;

    Microsoft::WRL::ComPtr<IAudioSessionEnumerator> sessions;
    if (FAILED(binding.manager->GetSessionEnumerator(&sessions)) || !sessions) continue;

    int count = 0;
    if (FAILED(sessions->GetCount(&count))) continue;
    anyEndpointAnswered = true;

    for (int index = 0; index < count; ++index) {
      Microsoft::WRL::ComPtr<IAudioSessionControl> control;
      if (FAILED(sessions->GetSession(index, &control))) continue;

      Microsoft::WRL::ComPtr<IAudioSessionControl2> control2;
      if (FAILED(control.As(&control2))) continue;

      // Sessao de sons do sistema nao tem processo dono utilizavel.
      if (control2->IsSystemSoundsSession() == S_OK) continue;

      AudioSessionState state = AudioSessionStateInactive;
      if (SUCCEEDED(control->GetState(&state)) && state == AudioSessionStateExpired) continue;

      DWORD pid = 0;
      if (FAILED(control2->GetProcessId(&pid)) || pid == 0) continue;

      if (seen.insert(pid).second) out->push_back(pid);
    }
  }

  // So e erro quando NENHUM endpoint respondeu.
  return anyEndpointAnswered ? S_OK : E_FAIL;
}

HRESULT SessionScanner::GetDefaultDevice(Microsoft::WRL::ComPtr<IMMDevice>* out) const {
  if (!enumerator_) return E_UNEXPECTED;
  return enumerator_->GetDefaultAudioEndpoint(eRender, eConsole, out->GetAddressOf());
}

}  // namespace zoi
