// Harness temporario do Sprint 2 (placeholder ate o Sprint 6 trazer as telas reais).
// Serve para exercitar a superficie IPC e os sons sem UI definitiva.
import { useEffect, useState } from 'react'
import type { CaptureSource } from '@shared/ipc'
import { MediaManager, mediaManager } from './services/media-manager'
import { Session, session } from './services/session'
import {
  playSound,
  preloadSounds,
  SOUND_IDS,
  SOUND_URLS,
  type SoundId
} from './services/sound-player'

const shell: React.CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  padding: 24,
  background: '#0e0b12',
  color: '#f3eefa',
  fontFamily: 'Segoe UI, system-ui, sans-serif',
  boxSizing: 'border-box'
}

const buttonStyle: React.CSSProperties = {
  background: '#2a1b3d',
  color: '#f3eefa',
  border: '1px solid #4c3268',
  borderRadius: 8,
  padding: '6px 12px',
  marginRight: 8,
  marginBottom: 8,
  cursor: 'pointer'
}

export default function App(): JSX.Element {
  const [installId, setInstallId] = useState<string>('')
  const [nickname, setNickname] = useState<string>('')
  const [draft, setDraft] = useState<string>('')
  const [version, setVersion] = useState<string>('')
  const [sources, setSources] = useState<CaptureSource[]>([])
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    preloadSounds()
    // Ponte do harness para verificacao automatizada; sai junto com o placeholder.
    ;(window as unknown as Record<string, unknown>)['__zoiHarness'] = {
      soundIds: SOUND_IDS,
      soundUrls: SOUND_URLS,
      playSound,
      session,
      mediaManager,
      createSession: (): Session => new Session(),
      createSessionWithMedia: (): { session: Session; media: MediaManager } => {
        const created = new Session()
        const media = new MediaManager(created)
        created.setMediaHooks(media)
        return { session: created, media }
      }
    }
    void window.zoi.settings.get().then((settings) => {
      setInstallId(settings.installId)
      setNickname(settings.nickname ?? '')
      setDraft(settings.nickname ?? '')
    })
    void window.zoi.app.getVersion().then(setVersion)
  }, [])

  async function saveNickname(): Promise<void> {
    try {
      const settings = await window.zoi.settings.set({ nickname: draft })
      setNickname(settings.nickname ?? '')
      setMessage(`apelido salvo: ${settings.nickname ?? ''}`)
    } catch (error) {
      setMessage(String(error))
    }
  }

  async function loadSources(): Promise<void> {
    const list = await window.zoi.capture.listSources({ thumbnailWidth: 320 })
    setSources(list)
    setMessage(`${list.length} fontes encontradas`)
  }

  return (
    <main style={shell}>
      <h1 style={{ fontSize: 28, margin: '0 0 4px' }}>Zói da Goiaba</h1>
      <p style={{ opacity: 0.6, margin: '0 0 20px' }}>
        harness de desenvolvimento (versao {version || '...'})
      </p>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16 }}>settings</h2>
        <p style={{ opacity: 0.7, fontSize: 13 }}>installId: {installId || '...'}</p>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="apelido"
          style={{ ...buttonStyle, cursor: 'text', width: 220 }}
        />
        <button type="button" style={buttonStyle} onClick={() => void saveNickname()}>
          salvar apelido
        </button>
        <span style={{ opacity: 0.7, fontSize: 13 }}>atual: {nickname || '(nenhum)'}</span>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16 }}>sons</h2>
        {SOUND_IDS.map((id: SoundId) => (
          <button type="button" key={id} style={buttonStyle} onClick={() => playSound(id)}>
            {id}
          </button>
        ))}
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>fontes de captura</h2>
        <button type="button" style={buttonStyle} onClick={() => void loadSources()}>
          listar fontes
        </button>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
          {sources.slice(0, 12).map((source) => (
            <figure key={source.id} style={{ margin: 0, width: 160 }}>
              <img
                src={source.thumbnailDataUrl}
                alt={source.name}
                style={{ width: 160, borderRadius: 6, background: '#000' }}
              />
              <figcaption style={{ fontSize: 11, opacity: 0.7 }}>
                [{source.kind}] {source.name}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <p style={{ marginTop: 20, opacity: 0.8, fontSize: 13 }}>{message}</p>
    </main>
  )
}
