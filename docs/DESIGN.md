# Sistema de diseño · Athlos App

> Referencia visual para todas las pantallas. Los valores viven como variables CSS en `app/globals.css` (tokens de shadcn/ui sobre Tailwind v4); este documento explica qué significa cada uno y cuándo usarlo. Si cambias un token, cámbialo en los dos sitios.

## 1. Principios

1. **Móvil primero.** La mayoría de clientes reserva desde el móvil, a menudo con una mano y de pie. Se diseña a 360–430 px de ancho y luego se amplía.
2. **Una acción principal por pantalla.** En el detalle de sesión, el botón grande es "Reservar" (o "Anular"); todo lo demás es secundario.
3. **El estado se entiende sin leer.** Plazas libres, completa, lista de espera o cancelada se distinguen por color **y** por texto o icono (nunca solo por color).
4. **Rápido y sobrio.** Sin animaciones decorativas; transiciones de 150–200 ms solo para dar respuesta al toque. Se respeta `prefers-reduced-motion`.
5. **Admin denso, cliente aireado.** Las pantallas de administrador pueden mostrar más datos por pantalla (tablas, agenda semanal); las del cliente priorizan legibilidad.

## 2. Color

Modo claro y oscuro según el sistema (`prefers-color-scheme`). Todos los pares texto/fondo cumplen **WCAG AA** (4,5:1 para texto normal, 3:1 para texto grande e iconos).

### 2.1 Tokens base

| Token | Uso | Claro | Oscuro |
|---|---|---|---|
| `background` | Fondo de la app | `#ffffff` | `#0b0b0c` |
| `foreground` | Texto principal | `#18181b` (zinc-900) | `#f4f4f5` (zinc-100) |
| `card` | Tarjetas, hojas inferiores | `#ffffff` | `#18181b` |
| `muted` | Fondos secundarios, selector de día | `#f4f4f5` | `#27272a` |
| `muted-foreground` | Texto secundario (horas, metadatos) | `#52525b` (zinc-600) | `#a1a1aa` (zinc-400) |
| `border` / `input` | Bordes y campos | `#e4e4e7` | `#3f3f46` |
| `brand` | Naranja del logo: decoración, ilustraciones, nunca texto pequeño sobre blanco | `#c4713e` | `#c4713e` |
| `primary` | Acción principal, día seleccionado, pestaña activa | `#a05428` (naranja Athlos oscuro) | `#e0915c` |
| `primary-foreground` | Texto sobre `primary` | `#ffffff` | `#0b0b0c` |
| `secondary` | Botones secundarios | `#f4f4f5` | `#27272a` |
| `destructive` | Anular, dar de baja, eliminar | `#b91c1c` | `#f87171` |
| `ring` | Anillo de foco | `#a05428` | `#e0915c` |

El naranja sale del logo de Athlos Centro Deportivo (`#c4713e`, terracota). Sobre blanco solo da 3,6:1, insuficiente para texto, así que la acción principal usa el mismo tono oscurecido: `#a05428` con texto blanco da 5,5:1 (y 4,8:1 sobre su propio fondo al 10 %, en la pestaña activa). En oscuro se aclara a `#e0915c` con texto casi negro (7,9:1).

### 2.1.1 Logo

- Original: `public/logo.png` (círculo recortado, fondo transparente). Fuente: imagen de WhatsApp de 755 px; **para las tiendas (icono de 1024 px) hará falta el original en alta resolución o vectorial**.
- Iconos generados: `app/icon.png` (favicon), `app/apple-icon.png` (iOS, sobre `#18181b`), `public/icons/icon-{192,512}.png` (PWA) y `public/icons/icon-maskable-{192,512}.png` (Android, logo dentro de la zona segura sobre `#18181b`).
- En la app el logo aparece solo en login, registro y cabecera; nunca a menos de 32 px (el texto "Centro deportivo" deja de leerse por debajo de 96 px).

### 2.2 Estados de sesión y reserva

| Estado | Color | Texto / icono obligatorio |
|---|---|---|
| Plazas libres | verde `success` (`#147a3a` / `#4ade80`) | "5 plazas" |
| Últimas plazas (≤ 20 % del aforo) | ámbar `warning` (`#a14a07` / `#fbbf24`) | "2 plazas" |
| Completa | `muted-foreground` | "Completa · lista de espera" |
| Reservada por mí | `primary` (borde izquierdo + insignia) | ✓ "Reservada" |
| En lista de espera | ámbar `warning` | "En espera · nº 3" |
| Anulación tardía | `destructive` | "Anulación tardía" |
| Cancelada por el gimnasio | `muted-foreground`, texto tachado | "Cancelada" |
| Cerrada (ya empezada) | opacidad 60 % | "Cerrada" |

### 2.3 Colores de tipo de clase

El administrador elige el color de cada tipo de clase de una **paleta fija de 8** (no un selector libre), para garantizar contraste en ambos modos. Se usa como franja de 4 px a la izquierda de la tarjeta y como punto en la agenda; el texto nunca va sobre ese color.

| Clave | Claro | Oscuro |
|---|---|---|
| `orange` | `#c4713e` | `#e0915c` |
| `red` | `#dc2626` | `#f87171` |
| `amber` | `#d97706` | `#fbbf24` |
| `green` | `#16a34a` | `#4ade80` |
| `teal` | `#0d9488` | `#2dd4bf` |
| `blue` | `#2563eb` | `#60a5fa` |
| `violet` | `#7c3aed` | `#a78bfa` |
| `pink` | `#db2777` | `#f472b6` |

En base de datos se guarda la **clave** (`class_types.color = 'teal'`), no el hexadecimal.

## 3. Tipografía

- Familia: **Geist Sans** (ya cargada con `next/font`); números tabulares (`tabular-nums`) en horas, aforos y contadores. Geist Mono solo para datos técnicos.
- Tamaño base **16 px**. Los campos de formulario nunca bajan de 16 px (por debajo, iOS hace zoom al enfocarlos).

| Estilo | Clase Tailwind | Uso |
|---|---|---|
| Título de pantalla | `text-xl font-semibold tracking-tight` | Uno por pantalla (`h1`), en la cabecera fija de 56 px |
| Título de sección | `text-lg font-semibold` | "Próximas", "Historial" |
| Cuerpo | `text-base` | Texto general, campos |
| Secundario | `text-sm text-muted-foreground` | Entrenador, duración, metadatos |
| Pequeño | `text-xs font-medium` | Insignias, etiquetas de la barra inferior |
| Hora de sesión | `text-lg font-semibold tabular-nums` | "07:30" en las tarjetas |

Formato de fechas y horas: `es-ES`, 24 h, en la zona horaria del gimnasio. "lun 6 oct", "07:30–08:30", "Hoy", "Mañana".

## 4. Espaciado, forma y elevación

- Escala de 4 px de Tailwind. Márgenes laterales de pantalla: **16 px** (`px-4`); en tablet y escritorio el contenido se centra con `max-w-2xl` (cliente) o `max-w-6xl` (admin).
- Separación entre tarjetas de una lista: 8–12 px (`gap-2`/`gap-3`). Entre secciones: 24 px (`gap-6`).
- Radio: `--radius: 0.75rem` (tarjetas y diálogos `rounded-xl`, botones y campos `rounded-lg`, insignias `rounded-full`).
- Elevación: bordes antes que sombras. Solo la barra inferior, las hojas y los diálogos llevan sombra.

## 5. Interacción táctil y diseño móvil

- **Zonas táctiles de 44 × 44 px como mínimo** (botones `h-11`, filas de lista `min-h-11`, iconos con área ampliada). Separación mínima de 8 px entre objetivos.
- **Navegación inferior** fija en cliente (Calendario · Mis reservas · Avisos · Perfil) y admin en móvil (Hoy · Agenda · Clientes · Incidencias · Más): icono + etiqueta siempre visible, 64 px de alto + `safe-area-inset-bottom`. En pantallas ≥ 1024 px se convierte en barra lateral.
- **Safe areas**: `viewport-fit=cover` y rellenos con `env(safe-area-inset-*)` en cabecera y barra inferior (muesca de iPhone, barra de gestos de Android).
- La acción principal queda al alcance del pulgar: botón ancho en la parte inferior de la pantalla de detalle, por encima de la barra.
- Confirmaciones destructivas (anular, dar de baja) en **diálogo** con el botón destructivo a la derecha y "Volver" como opción por defecto.
- Sin `hover` como única pista: todo lo que tenga hover debe entenderse también al tocar.

## 6. Estados de carga, vacío, error y sin conexión

| Estado | Cómo se ve | Implementación |
|---|---|---|
| **Cargando** | Esqueletos con la forma del contenido final (no spinners a pantalla completa) | `loading.tsx` por ruta + componente `Skeleton` |
| **Acción en curso** | El botón muestra un spinner y se desactiva; el texto cambia ("Reservando…") | `useFormStatus` / `useTransition` |
| **Vacío** | Icono suave + frase que explica + acción si la hay. Ej.: "No tienes reservas próximas" → "Ver calendario" | Componente `EmptyState` |
| **Error de pantalla** | Mensaje en lenguaje claro + botón "Reintentar"; nunca trazas ni códigos técnicos | `error.tsx` por segmento |
| **Error de acción** | Mensaje bajo el botón o aviso breve (toast) con la causa: "La sesión está completa", "No te quedan clases esta semana" | Resultado de la Server Action |
| **Éxito** | Aviso breve (toast) de 3 s: "Reserva confirmada" | Toast |
| **Sin conexión** | Franja superior "Sin conexión · mostrando tus reservas guardadas"; los botones que necesitan red se desactivan | `useOffline` de Next + página `/offline` del service worker |

## 7. Componentes base (shadcn/ui)

Viven en `components/ui/` (generados con la CLI de shadcn y adaptables). Componentes propios de la app en `components/`. El marco de pantalla es `components/app-shell/`: `AppShell` (navegación del rol) y `Page` (cabecera con título, "Volver" y acciones; `wide` para admin).

| Componente | Variantes / notas |
|---|---|
| `Button` | `default` (primaria), `secondary`, `outline`, `ghost`, `destructive`; tamaños con alto mínimo de 44 px |
| `Input`, `Label` | Siempre con etiqueta visible; error debajo en `destructive` con `aria-invalid` |
| `Card` | Tarjeta de sesión, tarjeta de reserva, resumen de tarifa |
| `Dialog` | Confirmaciones y formularios cortos |
| `Table` | Listas de admin en escritorio; en móvil se muestran como lista de tarjetas |
| `Badge` | Estados de sesión/reserva (sección 2.2) |
| `Skeleton` | Estados de carga |

## 8. Iconos

**lucide-react** (el de shadcn), trazo 2 px, 20 px en listas y 24 px en la barra inferior. Los iconos que actúan como botón llevan `aria-label`; los decorativos, `aria-hidden`.

## 9. Accesibilidad

- Contraste AA (sección 2), comprobado en claro y oscuro.
- Foco de teclado siempre visible: anillo de 2 px en `ring` con separación (`focus-visible:ring-2 ring-offset-2`).
- `lang="es"`; títulos jerárquicos (un `h1` por pantalla); regiones `nav`/`main`.
- Formularios: `label` asociado, errores anunciados (`aria-describedby`), `autocomplete` correcto (`email`, `current-password`, `tel`, `name`).
- No bloquear el zoom (`maximum-scale` sin fijar).
- Movimiento reducido: sin transiciones si `prefers-reduced-motion: reduce`.
- Enlace "Saltar al contenido" como primer elemento enfocable en las pantallas con navegación (`#contenido` es el `main`).
- Anillos de foco **opacos** (`ring-ring`, nunca `ring-ring/50`): un anillo al 50 % no llega a 3:1.
- Todo lo que cambia con `hover:` cambia también con `active:` (respuesta al toque).
- Los controles llevan `touch-action: manipulation` (sin retardo de doble toque) y el texto no se reescala al girar (`text-size-adjust`).
- **Comprobación automática**: `__tests__/contrast.test.ts` lee los tokens de `app/globals.css` y exige AA en claro y oscuro (texto 4,5:1; foco, iconos y colores de clase 3:1), incluidas las insignias sobre su fondo translúcido.

## 10. Historial de cambios

- 2026-10-02 · Versión inicial (Fase 2).
