import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '../public/icons')
mkdirSync(PUBLIC, { recursive: true })

const svg = readFileSync(join(PUBLIC, 'icon.svg'))

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for (const size of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(PUBLIC, `icon-${size}x${size}.png`))
  console.log(`✓ icon-${size}x${size}.png`)
}

// Apple touch icon (180×180)
await sharp(svg).resize(180, 180).png().toFile(join(PUBLIC, 'apple-touch-icon.png'))
console.log('✓ apple-touch-icon.png')

// favicon 32×32
await sharp(svg).resize(32, 32).png().toFile(join(PUBLIC, 'favicon-32x32.png'))
console.log('✓ favicon-32x32.png')

// favicon 16×16
await sharp(svg).resize(16, 16).png().toFile(join(PUBLIC, 'favicon-16x16.png'))
console.log('✓ favicon-16x16.png')

console.log('All icons generated.')
