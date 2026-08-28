// Entry da SEGUNDA janela de renderer: o overlay de ponteiros do transmissor.
//
// Esta janela nao tem sessao, nao tem PeerJS e nao tem roster: ela so recebe
// frames ja resolvidos (apelido e cor incluidos) pelo canal
// `pointer-overlay:render` e desenha.
//
// Ordem dos imports: `theme.css` primeiro (os tokens), `overlay.css` DEPOIS,
// porque e ela que apaga o fundo opaco que o tema pinta no `body`. Um fundo
// opaco aqui apagaria o monitor inteiro da pessoa.
import React from 'react'
import { createRoot } from 'react-dom/client'
import '../ui/theme.css'
import { OverlayApp } from './OverlayApp'
import './overlay.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Elemento #root nao encontrado no overlay.html')
}

createRoot(container).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>
)
