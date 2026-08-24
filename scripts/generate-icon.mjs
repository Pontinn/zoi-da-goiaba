// Gera build/icon.ico (multi-resolucao) e build/icon.png a partir de logo/icone.png.
// Rodar com: npm run icon
// O .ico e montado na mao (sharp nao escreve ICO): cabecalho ICONDIR + entradas
// apontando para payloads PNG, formato aceito pelo Windows Vista+ e pelo NSIS.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = resolve(projectRoot, 'logo/icone.png')
const outputDir = resolve(projectRoot, 'build')

// 256 e obrigatorio para o electron-builder (icone do instalador NSIS).
const SIZES = [16, 24, 32, 48, 64, 128, 256]

function buildIco(images) {
  const headerSize = 6
  const entrySize = 16
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0) // reservado
  header.writeUInt16LE(1, 2) // tipo 1 = icone
  header.writeUInt16LE(images.length, 4)

  const directory = Buffer.alloc(entrySize * images.length)
  let offset = headerSize + entrySize * images.length

  images.forEach((image, index) => {
    const at = index * entrySize
    directory.writeUInt8(image.size >= 256 ? 0 : image.size, at + 0) // largura (0 = 256)
    directory.writeUInt8(image.size >= 256 ? 0 : image.size, at + 1) // altura (0 = 256)
    directory.writeUInt8(0, at + 2) // paleta
    directory.writeUInt8(0, at + 3) // reservado
    directory.writeUInt16LE(1, at + 4) // planos de cor
    directory.writeUInt16LE(32, at + 6) // bits por pixel
    directory.writeUInt32LE(image.data.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += image.data.length
  })

  return Buffer.concat([header, directory, ...images.map((image) => image.data)])
}

async function main() {
  const source = await readFile(sourcePath)
  await mkdir(outputDir, { recursive: true })

  const images = []
  for (const size of SIZES) {
    const data = await sharp(source)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer()
    images.push({ size, data })
  }

  await writeFile(resolve(outputDir, 'icon.ico'), buildIco(images))

  // PNG 512 usado como icone de janela em dev e por targets nao-Windows.
  await sharp(source)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(outputDir, 'icon.png'))

  console.log(`icone gerado em build/icon.ico (${SIZES.join(', ')}) e build/icon.png`)
}

main().catch((error) => {
  console.error('falha ao gerar o icone:', error)
  process.exit(1)
})
