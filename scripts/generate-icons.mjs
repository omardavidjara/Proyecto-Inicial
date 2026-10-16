// Genera los iconos de la PWA y el logo a partir del vectorial `assets/logo.svg`.
// Uso: `node scripts/generate-icons.mjs` (solo al cambiar el logo; los PNG se suben al repo).
// sharp viene con Next.js: no hace falta instalar nada.
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url))
const SOURCE = root("assets/logo.svg")
// Fondo de los iconos opacos (maskable y Apple): el `--foreground` de app/globals.css
const BACKGROUND = "#18181b"
// Los iconos maskable se recortan en círculo: el logo ocupa el 78 % (zona segura del 80 %)
const MASKABLE_SCALE = 0.78

/** Logo transparente fuera del círculo, a tamaño completo */
async function plain(size, file) {
  await sharp(SOURCE, { density: 600 }).resize(size, size).png({ compressionLevel: 9 }).toFile(root(file))
}

/** Logo centrado sobre fondo opaco (Android lo recorta; iOS no admite transparencia) */
async function onBackground(size, file) {
  const inner = Math.round(size * MASKABLE_SCALE)
  const logo = await sharp(SOURCE, { density: 600 }).resize(inner, inner).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: logo, gravity: "center" }])
    .flatten({ background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toFile(root(file))
}

await Promise.all([
  plain(512, "public/logo.png"),
  plain(192, "public/icons/icon-192.png"),
  plain(512, "public/icons/icon-512.png"),
  plain(256, "app/icon.png"),
  onBackground(192, "public/icons/icon-maskable-192.png"),
  onBackground(512, "public/icons/icon-maskable-512.png"),
  onBackground(180, "app/apple-icon.png"),
])
console.log("Iconos generados desde assets/logo.svg")
