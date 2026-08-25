// Sons de notificacao do app (RF-39/RNF-09).
//
// FONTE CANONICA dos arquivos: a pasta `audios\` na raiz do repo. Os `.m4a` aqui
// em `assets\audios\` sao uma COPIA versionada, importada como asset do Vite para
// entrar no bundle: zero download em runtime. Ao trocar um som, troque na raiz e
// copie de novo (a pasta `audios\originais` nunca e empacotada).
import { clampSoundVolume, DEFAULT_SOUND_VOLUME, SOUND_IDS, type SoundId } from '@shared/sounds'
import enteredUrl from '../assets/audios/entrou.m4a'
import leftUrl from '../assets/audios/saiu.m4a'
import transmittingUrl from '../assets/audios/transmitindo.m4a'
import stoppedTransmittingUrl from '../assets/audios/parou-transmissao.m4a'
import removedUrl from '../assets/audios/desconectado.m4a'
import connectionErrorUrl from '../assets/audios/erro-conexao.m4a'
import reconnectedUrl from '../assets/audios/reconectado.m4a'

export { SOUND_IDS, type SoundId }

/** URLs dos assets ja resolvidas pelo bundler (uteis para diagnostico). */
export const SOUND_URLS: Record<SoundId, string> = {
  entered: enteredUrl,
  left: leftUrl,
  transmitting: transmittingUrl,
  stoppedTransmitting: stoppedTransmittingUrl,
  removed: removedUrl,
  connectionError: connectionErrorUrl,
  reconnected: reconnectedUrl
}

/**
 * Volume dos sons do app (0..1), ajustavel nas Configuracoes e persistido nos
 * settings. E independente do volume da transmissao assistida, que vive no
 * elemento de video do player. Comeca no padrao ate o boot ler o valor salvo.
 */
let appSoundVolume = DEFAULT_SOUND_VOLUME

const preloaded = new Map<SoundId, HTMLAudioElement>()

/** Volume atual dos sons do app, ja normalizado para 0..1. */
export function getSoundVolume(): number {
  return appSoundVolume
}

/**
 * Troca o volume dos sons do app. Vale ja para os elementos pre-carregados e
 * para todo disparo seguinte; 0 e mudo de verdade.
 */
export function setSoundVolume(volume: number): void {
  appSoundVolume = clampSoundVolume(volume)
  for (const audio of preloaded.values()) audio.volume = appSoundVolume
}

function elementFor(id: SoundId): HTMLAudioElement {
  const cached = preloaded.get(id)
  if (cached) return cached
  const audio = new Audio(SOUND_URLS[id])
  audio.preload = 'auto'
  audio.volume = appSoundVolume
  preloaded.set(id, audio)
  return audio
}

/** Pre-instancia os 7 sons para que o primeiro toque nao tenha latencia de I/O. */
export function preloadSounds(): void {
  for (const id of SOUND_IDS) {
    const audio = elementFor(id)
    audio.load()
  }
}

/**
 * Toca um som. Usa um clone por disparo para permitir sobreposicao (dois eventos
 * quase simultaneos nao cortam um ao outro) e para ser idempotente em re-chamadas.
 */
export function playSound(id: SoundId): void {
  try {
    // `cloneNode` copia atributos, nao a propriedade `volume`: reaplicar sempre.
    const instance = elementFor(id).cloneNode(true) as HTMLAudioElement
    instance.volume = appSoundVolume
    void instance.play().catch((error: unknown) => {
      console.warn(`[sound] falha ao tocar "${id}":`, error)
    })
  } catch (error) {
    console.warn(`[sound] falha ao preparar "${id}":`, error)
  }
}
