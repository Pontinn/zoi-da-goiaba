// Entry da SEGUNDA janela de renderer: o overlay de ponteiros do transmissor.
//
// Esta janela nao tem sessao, nao tem PeerJS e nao tem roster: ela so recebe
// frames ja resolvidos (nickname e cor incluidos) pelo canal
// `pointer-overlay:render` e desenha. O desenho de verdade e a feature F2.3;
// aqui fica so a casca, que ja precisa existir para a janela subir.
import React from 'react'
import { createRoot } from 'react-dom/client'
import '../ui/theme.css'

function OverlayApp(): React.ReactElement {
  return <div className="z-overlay" />
}

const container = document.getElementById('root')
if (!container) {
  throw new Error('Elemento #root nao encontrado no overlay.html')
}

createRoot(container).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>
)
