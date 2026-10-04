// Contraste WCAG 2.1 AA de los tokens de app/globals.css (docs/DESIGN.md §2 y §9).
// Lee los colores del propio CSS: si alguien cambia un token, este test lo comprueba.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { CLASS_COLORS } from '@/lib/sessions'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2].toLowerCase()]))
}

const light = tokens(css.match(/:root\s*{([^}]*)}/)![1])
const dark = { ...light, ...tokens(css.match(/@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{([^}]*)}/)![1]) }

type Rgb = [number, number, number]

const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb

/** Color con transparencia sobre un fondo (como `bg-success/10`) */
const over = (fg: string, alpha: number, bg: string): Rgb => {
  const [f, b] = [rgb(fg), rgb(bg)]
  return f.map((c, i) => Math.round(alpha * c + (1 - alpha) * b[i])) as Rgb
}

const luminance = (c: Rgb) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a: string | Rgb, b: string | Rgb): number {
  const [la, lb] = [a, b].map((c) => luminance(typeof c === 'string' ? rgb(c) : c))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const TEXT = 4.5 // texto normal
const UI = 3 // iconos, bordes de foco, marcas de color

describe.each([
  ['claro', light, 0.1],
  ['oscuro', dark, 0.2],
] as const)('modo %s', (_, t, badgeAlpha) => {
  test('tokens presentes', () => {
    for (const key of ['background', 'foreground', 'card', 'muted', 'muted-foreground', 'primary', 'primary-foreground', 'destructive', 'success', 'warning', 'ring', 'brand']) {
      expect(t[key], key).toMatch(/^#/)
    }
  })

  test.each([
    ['texto sobre fondo', 'foreground', 'background'],
    ['texto sobre tarjeta', 'foreground', 'card'],
    ['texto sobre muted', 'foreground', 'muted'],
    ['texto secundario sobre fondo', 'muted-foreground', 'background'],
    ['texto secundario sobre tarjeta', 'muted-foreground', 'card'],
    ['texto secundario sobre muted', 'muted-foreground', 'muted'],
    ['botón principal', 'primary-foreground', 'primary'],
    ['enlaces y cifras en primary', 'primary', 'background'],
    ['primary sobre tarjeta', 'primary', 'card'],
    ['botón secundario', 'secondary-foreground', 'secondary'],
    ['destructive sobre fondo', 'destructive', 'background'],
  ])('%s ≥ 4,5:1', (_, fg, bg) => {
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(TEXT)
  })

  // Insignias, botón destructivo y pestaña activa usan el color al 10–20 % de fondo
  test.each(['success', 'warning', 'destructive', 'primary'])('insignia %s sobre su fondo translúcido ≥ 4,5:1', (key) => {
    for (const base of [t.background, t.card]) {
      expect(ratio(t[key], over(t[key], badgeAlpha, base))).toBeGreaterThanOrEqual(TEXT)
    }
  })

  test('anillo de foco visible (≥ 3:1) sobre fondo y tarjeta', () => {
    expect(ratio(t.ring, t.background)).toBeGreaterThanOrEqual(UI)
    expect(ratio(t.ring, t.card)).toBeGreaterThanOrEqual(UI)
  })

  test('naranja de marca usable en iconos (≥ 3:1)', () => {
    expect(ratio(t.brand, t.card)).toBeGreaterThanOrEqual(UI)
  })

  test.each(CLASS_COLORS)('color de clase %s distinguible sobre tarjeta (≥ 3:1)', (color) => {
    expect(ratio(t[`class-${color}`], t.card)).toBeGreaterThanOrEqual(UI)
  })
})
