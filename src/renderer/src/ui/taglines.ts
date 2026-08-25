// Frases da home, escritas pelo usuario. Sorteadas a cada abertura do app.
// Editar aqui e a unica coisa necessaria para trocar/incluir frases.

/** Saudacao principal. `{nome}` vira o apelido, destacado em roxo na tela. */
export const HOME_GREETINGS: readonly string[] = [
  'Bão, {nome}?',
  'Uai, {nome}!',
  'Fala, {nome} caralho!',
  'Fala tu, {nome}!',
  'Reage, {nome}!',
  'Cê tá bão, {nome}?',
  'Acorda, {nome}!',
  'Abre o zoi, {nome}!',
  'Ó o zoi, {nome}!',
  'E aí, {nome}!'
]

/** Linha de baixo, sorteada de forma independente da saudacao. */
export const HOME_TAGLINES: readonly string[] = [
  'Só de bizóio.',
  'Fecha a aba anônima aí.',
  'Mostra essa porra logo.',
  'Vigiando seus vacilos.',
  'Trem bão é tela cheia.',
  'Cuidado pra não vazar nude.',
  'O zói tudo vê, sô.',
  'Fofoca em tempo real.',
  'De olho nesse seu histórico.',
  'Compartilha a tela, caralho.',
  'Lá ele.',
  'Apaga o histórico antes.',
  'O zói tá arregalado.',
  'Sala do sexo, bicho',
  'Calma meu miniquerido',
  'Eu sou fã do mixirica_pvp',
  'Dois zói valendo.',
  'Nada escapa do zói.',
  'Espiando com respeito.',
  'O zói não pisca não.',
  'Trem feio é tela preta.',
  'Ocê vai mostrar ou não vai?',
  'Presta atenção no trem, uai.',
  'Cadê o filme que prometeram?',
  'Alguém compartilha, pelo amor.',
  'Roda o filme antes que eu durmo.',
  'Silêncio, que o zói tá trabalhando.',
  '"Vou desinstalar essa bosta aqui!" - Soares, Flavio',
  '"Vamo jogar Lethal Company?" - Loubaque, Rafael',
  'Bruna não toma banho MESMO',
  '"Gente, que cor que é essa? Azul ou verde?" - Pontin, Leo',
  '"Não gosto de católicos" - Filho, Romilson',
  'pipipi, pópópó',
  'Filmes eróticos só depois das 00h. Entrada somente com identificação',
  '"Nossa, meu namoado é um gato" - Caroliny, Bruna'
]

function pick(list: readonly string[], random: () => number): string {
  const index = Math.floor(random() * list.length) % list.length
  return list[index] ?? list[0] ?? ''
}

export function pickTagline(random: () => number = Math.random): string {
  return pick(HOME_TAGLINES, random)
}

/** Partes da saudacao ao redor do apelido, para destacar o nome na cor da marca. */
export interface Greeting {
  before: string
  after: string
}

export function pickGreeting(random: () => number = Math.random): Greeting {
  const template = pick(HOME_GREETINGS, random)
  const [before = '', after = ''] = template.split('{nome}')
  return { before, after }
}
