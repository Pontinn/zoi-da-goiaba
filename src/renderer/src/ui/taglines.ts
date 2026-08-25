// Frases de abertura da home. Uma e sorteada a cada vez que o app abre.
// Lista unica e facil de editar: acrescente ou troque frases aqui.
export const HOME_TAGLINES: readonly string[] = [
  'bora ver a tela de quem hoje?',
  'o zoi ta afiado',
  'duas telas, zero vergonha',
  'cine goiaba ta aberto',
  'chama a galera, a pipoca e sua',
  'sem servidor no meio, so nos',
  'transmite ai que a gente julga'
]

export function pickTagline(random: () => number = Math.random): string {
  const index = Math.floor(random() * HOME_TAGLINES.length) % HOME_TAGLINES.length
  return HOME_TAGLINES[index] ?? HOME_TAGLINES[0] ?? ''
}
