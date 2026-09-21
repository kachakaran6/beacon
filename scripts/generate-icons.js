import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const buildDir = path.join(rootDir, 'build')
const publicDir = path.join(rootDir, 'public')
const sourcePngPath = path.join(buildDir, 'beacon.png')
const svgPath = path.join(buildDir, 'icon.svg')

async function generate() {
  fs.mkdirSync(buildDir, { recursive: true })
  fs.mkdirSync(publicDir, { recursive: true })

  const inputBuffer = fs.existsSync(sourcePngPath)
    ? fs.readFileSync(sourcePngPath)
    : fs.readFileSync(svgPath)

  const sizes = [16, 24, 32, 48, 64, 128, 256, 512]
  const pngBuffers = []

  for (const size of sizes) {
    const pngBuffer = await sharp(inputBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()

    if (size === 256) {
      fs.writeFileSync(path.join(buildDir, 'icon-256.png'), pngBuffer)
      fs.writeFileSync(path.join(publicDir, 'icon.png'), pngBuffer)
    }
    if (size === 512) {
      fs.writeFileSync(path.join(buildDir, 'icon-512.png'), pngBuffer)
      fs.writeFileSync(path.join(buildDir, 'icon.png'), pngBuffer)
    }
    if (size === 32) {
      fs.writeFileSync(path.join(publicDir, 'favicon.png'), pngBuffer)
    }
    pngBuffers.push(pngBuffer)
  }

  // Generate multi-size .ico (16, 24, 32, 48, 64, 128, 256)
  const icoBuffer = await pngToIco(pngBuffers.slice(0, 7))
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer)

  if (fs.existsSync(svgPath)) {
    fs.copyFileSync(svgPath, path.join(publicDir, 'favicon.svg'))
  }

  console.log('Icons successfully generated in build/ and public/ using beacon.png')
}

generate().catch((err) => {
  console.error(err)
  process.exit(1)
})
