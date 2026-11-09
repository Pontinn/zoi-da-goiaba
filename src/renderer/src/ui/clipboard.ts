// Copia para a area de transferencia com fallback: em ambiente sem Clipboard API
// o chamador exibe "selecione o codigo e copie com Ctrl+C".
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Le a area de transferencia (botao "Colar codigo"). `null` quando a leitura
// falha ou a Clipboard API nao existe: o chamador orienta a usar Ctrl+V.
export async function readText(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText()
  } catch {
    return null
  }
}
