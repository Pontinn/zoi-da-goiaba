// Declaracao minima do breakout box (Insertable Streams for MediaStreamTrack).
//
// O Chromium 150 do Electron 43 expoe `MediaStreamTrackGenerator` (confirmado
// no spike do Sprint 1), mas a lib DOM do TypeScript ainda nao o declara.
// `AudioData` ja vem da lib DOM (WebCodecs), entao nao e redeclarado aqui.

interface MediaStreamTrackGeneratorInit {
  kind: 'audio' | 'video'
}

declare class MediaStreamTrackGenerator extends MediaStreamTrack {
  constructor(init: MediaStreamTrackGeneratorInit)
  readonly writable: WritableStream<AudioData | VideoFrame>
}
