# Revisión de cierre · Fase 2 (Sistema de diseño y PWA)

Fecha: 2026-10-04 · Estado: **cerrada**. Revisión de código, accesibilidad, seguridad, PWA y documentación antes de pasar a la Fase 3.

## 1. Qué se entrega

| Entregable | Dónde |
|---|---|
| Sistema de diseño (color, tipografía, espaciado, estados, accesibilidad) | `docs/DESIGN.md`, `app/globals.css` |
| Logo de Athlos e iconos (favicon, Apple, PWA normal y *maskable*) | `public/logo.png`, `public/icons/`, `app/icon.png`, `app/apple-icon.png` |
| Componentes base de shadcn/ui adaptados (44 px, foco opaco, en español) | `components/ui/` |
| Marco móvil: cabecera fija, navegación inferior (lateral en escritorio), safe areas, "Saltar al contenido" | `components/app-shell/` |
| PWA: manifest, service worker y página sin conexión | `app/manifest.ts`, `public/sw.js`, `app/offline/` |
| Prototipo con datos de ejemplo | Ver §2 |

## 2. Prototipo aprobado

Revisado por el usuario en ordenador y móvil (2026-10-03/04). Cambio pedido en la revisión e incorporado a SPEC y ARCHITECTURE: **pantalla de inicio por rol**.

| Rol | Pantallas |
|---|---|
| Común | Inicio de sesión (`/login`), Sin conexión (`/offline`) |
| Cliente | Inicio (`/inicio`) · Calendario (`/calendario`) · Detalle de sesión con reservar / anular / lista de espera |
| Entrenador | Mi semana (`/entrenador`) → Día (`/entrenador/dia/[date]`) → Asistentes con marcar asistencia |
| Administrador | Hoy (`/admin`): resumen, anulaciones tardías pendientes, sesiones del día |

Las rutas de la navegación que aún no existen muestran "Próximamente" (sin 404). `/` es un índice del prototipo hasta la Fase 3.

## 3. Verificaciones

### Tests y compilación
- `npm run check`: lint, tipos y **90 tests** en verde.
- **Copia limpia** (`git clone` + `npm ci` + `check` + `build`): correcta. Para ello `typecheck` ejecuta `next typegen` antes de `tsc` (sin eso, la CI de la Fase 4 habría fallado: los tipos de rutas no están en el repositorio).

### Lighthouse (móvil, compilación de producción)

| Pantalla | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|---|
| Índice del prototipo | 97 | 100 | 100 | 100 |
| Inicio de sesión | 97 | 100 | 100 | 100 |
| Inicio (cliente) | 99 | 100 | 100 | 100 |
| Calendario | 97 | 100 | 100 | 100 |
| Detalle de sesión | 99 | 100 | 100 | 100 |
| Hoy (admin) | 98 | 100 | 100 | 100 |
| Mi semana | 99 | 100 | 100 | 100 |
| Día (entrenador) | 99 | 100 | 100 | 100 |
| Asistentes | 97 | 100 | 100 | 100 |
| Sin conexión | 99 | 100 | 100 | 100 |
| Próximamente | 96 | 100 | 100 | 100 |

Cifras en un PC local; las definitivas, con la web publicada, irán en `docs/PERF.md` (Fase 7).

### Accesibilidad
- **Contraste AA comprobado por test** (`__tests__/contrast.test.ts`): lee los tokens de `globals.css` y comprueba 52 combinaciones en claro y oscuro, incluidas las insignias sobre fondo translúcido.
- Foco de teclado visible y opaco en todos los controles; "Saltar al contenido"; un `h1` por pantalla; navegación con nombre y `aria-current`.
- Zonas táctiles ≥ 44 px, estados `active:` además de `hover:`, sin retardo de doble toque, zoom permitido, `prefers-reduced-motion` respetado.

### PWA
- Manifest válido (instalable, español, iconos 192/512 normales y *maskable*), `theme-color` claro/oscuro, icono de Apple.
- Service worker probado en Chrome: se registra, controla la página y, **con el servidor apagado**, la navegación muestra "Sin conexión" con "Reintentar".

### Seguridad
- Sin secretos, `.env` ni datos personales reales en el repositorio (nombres de ejemplo ficticios).
- Cabeceras: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`; sin `X-Powered-By`; `sw.js` sin caché y con CSP propia.
- `npm audit --omit=dev`: **0 vulnerabilidades** en producción.

## 4. Problemas encontrados y corregidos en esta revisión

| # | Gravedad | Problema | Corrección |
|---|---|---|---|
| 1 | Alta | Si se enviaba el formulario de acceso antes de cargar el JavaScript, la contraseña iría en la URL (GET) y quedaría en los registros | `method="post"` + test |
| 2 | Media | `typecheck` fallaría en una copia limpia (CI) | `next typegen && tsc --noEmit` |
| 3 | Media | Insignias de plazas y pestaña activa en modo claro por debajo de AA (4,4:1) | Verde, ámbar y naranja principal algo más oscuros (≥ 4,7:1) |
| 4 | Media | Anillos de foco de shadcn al 50 % (≈ 2:1) | Anillos opacos + test que lo vigila |
| 5 | Media | Elementos pasados/cerrados con opacidad 60 %: texto por debajo de AA | Fondo transparente y texto secundario |
| 6 | Baja | La caché estática del service worker crecería sin límite con cada despliegue | Límite de 150 entradas; precarga sin caché HTTP |
| 7 | Baja | Errores 404 en consola por precarga de rutas aún no hechas | Páginas "Próximamente" |
| 8 | Baja | Nombre accesible de los días de "Mi semana" distinto del texto visible; enlace "Más" poco descriptivo | Etiqueta eliminada; "Más" + "opciones" para lectores de pantalla |
| 9 | Baja | Botón de cerrar de los diálogos en inglés y de 36 px | "Cerrar", 44 px |
| 10 | Baja | Cabecera `X-Powered-By` | Desactivada |
| 11 | Baja | CLI de shadcn instalada como dependencia de producción | Movida a desarrollo |

## 5. Pendientes que heredan otras fases

| Pendiente | Fase |
|---|---|
| **Las rutas se abren sin iniciar sesión** (normal en el prototipo). Proteger `(client)`, `admin/` y `entrenador/` por sesión y rol; `/` redirige a `/login` o al inicio de cada rol. Ya está como tarea en el ROADMAP | 3 |
| `npm audit` de desarrollo: 9 avisos altos por `braces` ≤ 3.0.3 dentro de la CLI de shadcn y `eslint-config-next`. **Sin versión corregida publicada**; solo afecta a herramientas locales, no a la app. `npm audit fix --force` bajaría a versiones antiguas: no aplicarlo. Revisar con Dependabot | 4 / 9 |
| La CI debería ejecutar `npm audit --omit=dev` (producción) como bloqueante y el completo como aviso | 4 |
| Sustituir datos de `lib/prototype/`, páginas "Próximamente" y la franja de prototipo por lo real en cada funcionalidad; al final, borrar `lib/prototype/` | 5 |
| Lectura sin conexión de "Mis reservas" (SPEC §6) y franja con `useOffline`; la caché debe borrarse al cerrar sesión | 5 (F5) |
| `robots`: las pantallas privadas no deben indexarse (solo `/login` y `/privacidad`) | 7 |
| Rendimiento: ~29 KB de JS sin usar y *polyfills* heredados en el paquete del framework (no accionable ahora); `logo.png` de 349 KB (Next lo optimiza al servirlo) | 7 |
| CSP completa para toda la web (hoy solo en `sw.js`) | 6 |
| **Logo en alta resolución o vectorial**: el actual sale de una imagen de WhatsApp de 755 px; las tiendas piden 1024 px | 8 |
