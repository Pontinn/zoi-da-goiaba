#include "session_tracker.h"

#include <tlhelp32.h>
#include <wrl/implements.h>

#include <algorithm>

namespace zoi {

namespace {

/** Corta cadeias de parentesco patologicas (ou ciclicas) na varredura. */
constexpr int kMaxAncestorDepth = 64;

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

HRESULT SessionScanner::Reopen() {
  if (!enumerator_) return E_UNEXPECTED;

  if (manager_ && sessionNotifier_) {
    manager_->UnregisterSessionNotification(sessionNotifier_.Get());
  }
  sessionNotifier_.Reset();
  manager_.Reset();
  device_.Reset();

  HRESULT hr = enumerator_->GetDefaultAudioEndpoint(eRender, eConsole, &device_);
  if (FAILED(hr)) return hr;

  hr = device_->Activate(__uuidof(IAudioSessionManager2), CLSCTX_ALL, nullptr, &manager_);
  if (FAILED(hr)) return hr;

  // Uma enumeracao inicial e pre-requisito documentado para que o
  // IAudioSessionManager2 comece a emitir OnSessionCreated.
  Microsoft::WRL::ComPtr<IAudioSessionEnumerator> sessions;
  manager_->GetSessionEnumerator(&sessions);

  sessionNotifier_ = Microsoft::WRL::Make<SessionNotifier>(wakeEvent_);
  hr = manager_->RegisterSessionNotification(sessionNotifier_.Get());
  if (FAILED(hr)) sessionNotifier_.Reset();

  return S_OK;
}

void SessionScanner::Close() {
  if (manager_ && sessionNotifier_) {
    manager_->UnregisterSessionNotification(sessionNotifier_.Get());
  }
  if (enumerator_ && deviceNotifier_) {
    enumerator_->UnregisterEndpointNotificationCallback(deviceNotifier_.Get());
  }
  sessionNotifier_.Reset();
  deviceNotifier_.Reset();
  manager_.Reset();
  device_.Reset();
  enumerator_.Reset();
  wakeEvent_ = nullptr;
}

HRESULT SessionScanner::ListSessionPids(std::vector<DWORD>* out) const {
  out->clear();
  if (!manager_) return E_UNEXPECTED;

  Microsoft::WRL::ComPtr<IAudioSessionEnumerator> sessions;
  HRESULT hr = manager_->GetSessionEnumerator(&sessions);
  if (FAILED(hr)) return hr;

  int count = 0;
  hr = sessions->GetCount(&count);
  if (FAILED(hr)) return hr;

  std::unordered_set<DWORD> seen;
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

  return S_OK;
}

HRESULT SessionScanner::GetDefaultDevice(Microsoft::WRL::ComPtr<IMMDevice>* out) const {
  if (!enumerator_) return E_UNEXPECTED;
  return enumerator_->GetDefaultAudioEndpoint(eRender, eConsole, out->GetAddressOf());
}

}  // namespace zoi
