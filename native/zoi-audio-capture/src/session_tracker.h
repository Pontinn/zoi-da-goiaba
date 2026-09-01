// Rastreio de processos e de sessoes de audio.
//
// Duas responsabilidades, ambas de LEITURA:
//   1. ProcessSnapshot: foto da arvore de processos (Toolhelp32) com consultas
//      de parentesco resistentes a reuso de PID.
//   2. SessionScanner: quais PIDs tem sessao de audio nos endpoints de render
//      ATIVOS, mais as notificacoes de sessao nova e de troca de endpoint.
//
// Por que TODOS os endpoints ativos e nao so o padrao: uma sessao roteada para
// outro dispositivo (roteamento por aplicativo do Windows 11) ou vivendo numa
// role diferente era simplesmente INVISIVEL para a enumeracao, e essa e uma das
// causas candidatas do sintoma de aplicativo mudo. A lista e um superconjunto
// estrito da de antes, com o dispositivo padrao garantido na posicao 0.
//
// A classificacao vive aqui, mas a ESCOLHA de ancora vive no motor: subir a
// cadeia de ancestrais serve so para DETECTAR arvore proibida, nunca para
// escolher onde ancorar a captura.
#pragma once

#include <windows.h>
#include <audiopolicy.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>

#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace zoi {

struct ProcessEntry {
  DWORD pid = 0;
  DWORD parentPid = 0;
  /** Basename do executavel em minusculas (ex.: "discord.exe"). */
  std::wstring exeName;
};

/** Conjunto de regras que define uma arvore PROIBIDA. */
struct ForbiddenRules {
  std::unordered_set<std::wstring> executables;
  std::unordered_set<DWORD> rootPids;
};

/**
 * Foto imutavel da tabela de processos. Recriada a cada varredura: consultas
 * sao baratas porque o pai e o nome ja vieram no snapshot do Toolhelp32.
 */
class ProcessSnapshot {
 public:
  /** Recria a foto. Devolve false se o snapshot do sistema falhar. */
  bool Refresh();

  bool Contains(DWORD pid) const;
  /** Entrada do processo, ou nullptr se ele nao estava vivo no snapshot. */
  const ProcessEntry* Find(DWORD pid) const;

  /**
   * `ancestorPid` e ancestral valido de `pid`? Um elo so vale se o pai for MAIS
   * VELHO que o filho: sem isso, um PID reciclado apontaria para o executavel
   * errado e a classificacao mentiria.
   */
  bool IsAncestorOf(DWORD ancestorPid, DWORD pid) const;

  /** O PID pertence a uma arvore proibida (ele mesmo ou algum ancestral)? */
  bool IsForbidden(DWORD pid, const ForbiddenRules& rules) const;

  /** Todos os PIDs vivos que pertencem a alguma arvore proibida. */
  std::vector<DWORD> ListForbidden(const ForbiddenRules& rules) const;

  /**
   * Existe algum PID proibido DENTRO da subarvore de `rootPid` (inclusive ele)?
   * E a pre-checagem de abertura: um include so abre quando isso e false.
   */
  bool SubtreeContainsAny(DWORD rootPid, const std::vector<DWORD>& pids) const;

 private:
  /** Instante de criacao em unidades de FILETIME; 0 quando desconhecido. */
  ULONGLONG CreationTime(DWORD pid) const;

  std::unordered_map<DWORD, ProcessEntry> entries_;
  mutable std::unordered_map<DWORD, ULONGLONG> creationTimes_;
};

/**
 * Enumera as sessoes de audio do endpoint de render padrao e mantem vivas as
 * assinaturas de notificacao (sessao nova, troca de endpoint padrao).
 *
 * Tudo aqui e COM: usar SEMPRE da mesma thread MTA (a thread de controle).
 */
class SessionScanner {
 public:
  SessionScanner() = default;
  ~SessionScanner();

  SessionScanner(const SessionScanner&) = delete;
  SessionScanner& operator=(const SessionScanner&) = delete;

  /**
   * Abre o endpoint padrao e registra as notificacoes. `wakeEvent` e sinalizado
   * por qualquer evento que exija reconciliacao imediata.
   */
  HRESULT Open(HANDLE wakeEvent);
  void Close();

  /** Reabre no endpoint padrao ATUAL (usado apos troca de dispositivo). */
  HRESULT Reopen();

  /** PIDs com sessao de audio, sem repeticao e sem as sessoes de sistema. */
  HRESULT ListSessionPids(std::vector<DWORD>* out) const;

  /**
   * Dispositivo de render padrao atual (para o modo endpoint-loopback).
   * INALTERADA de proposito: nesse modo "sistema inteiro" quer dizer o
   * dispositivo padrao do sistema, e nao a uniao de todos.
   */
  HRESULT GetDefaultDevice(Microsoft::WRL::ComPtr<IMMDevice>* out) const;

  /** Quantos endpoints estao vinculados agora (vai no texto de diagnostico). */
  std::string DescribeEndpoints() const;
  /**
   * O dispositivo PADRAO do sistema esta entre os vinculados? Falso significa
   * que a captura esta rodando sem ele, e e a unica forma de quem le o log
   * saber disso.
   */
  bool DefaultEndpointBound() const;

 private:
  /** Um endpoint de render aberto: dispositivo, gerenciador e notificacao. */
  struct EndpointBinding {
    Microsoft::WRL::ComPtr<IMMDevice> device;
    Microsoft::WRL::ComPtr<IAudioSessionManager2> manager;
    Microsoft::WRL::ComPtr<IAudioSessionNotification> notifier;
  };

  /** Abre um dispositivo e monta o binding. Devolve false se o Activate falhar. */
  bool BindEndpoint(const Microsoft::WRL::ComPtr<IMMDevice>& device, EndpointBinding* out);

  HANDLE wakeEvent_ = nullptr;
  Microsoft::WRL::ComPtr<IMMDeviceEnumerator> enumerator_;
  std::vector<EndpointBinding> endpoints_;
  bool defaultBound_ = false;
  Microsoft::WRL::ComPtr<IMMNotificationClient> deviceNotifier_;
};

/** Basename em minusculas de um caminho de executavel. */
std::wstring ToLowerBaseName(const std::wstring& path);

/** Converte para UTF-8 (usado so em textos de diagnostico). */
std::string ToUtf8(const std::wstring& value);

}  // namespace zoi
