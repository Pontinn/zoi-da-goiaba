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
