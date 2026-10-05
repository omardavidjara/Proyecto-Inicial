# Athlos App (mi-app)

Reserva y gestión de clases y sesiones de Athlos Centro Deportivo, un gimnasio de entrenamiento funcional.
Aplicación web y móvil: Next.js + Neon (Postgres + Neon Auth), publicada en Vercel y empaquetada para móvil con Capacitor.

> Estado: prototipo navegable con datos de ejemplo (Fase 2 cerrada). Los datos reales y el inicio de sesión llegan en la Fase 3.

## Desarrollo

```bash
npm install
npm run dev                  # http://localhost:3000
npm run dev -- -H 0.0.0.0    # también desde un móvil en la misma Wi-Fi: http://<IP-del-PC>:3000
npm run check                # lint + tipos + tests
npm run build                # compilación de producción
```

El service worker (modo sin conexión) solo se registra en producción: `npm run build && npm start`.

## Estructura

```
app/                 Rutas (App Router): (auth), (client), admin, entrenador, offline
components/ui/       Componentes de shadcn/ui adaptados al sistema de diseño
components/          Componentes propios (marco de pantalla, sesiones, estados)
lib/                 Utilidades (fechas en la zona del gimnasio, plazas), datos del titular (legal.ts) y datos del prototipo
public/              Logo, iconos de la PWA y service worker (sw.js)
__tests__/           Tests (Vitest), incluido el contraste de colores
docs/                Documentación del proyecto
```

## Documentación

- Hoja de ruta: [docs/ROADMAP.md](docs/ROADMAP.md)
- Especificación: [docs/SPEC.md](docs/SPEC.md)
- Arquitectura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Sistema de diseño: [docs/DESIGN.md](docs/DESIGN.md)
- Límites de los servicios: [docs/LIMITS.md](docs/LIMITS.md)
- Copias de seguridad: [docs/BACKUPS.md](docs/BACKUPS.md)
- Revisiones de cierre de fase: [docs/reviews/](docs/reviews/)

## Textos legales

Política de privacidad (`/privacidad`, RGPD y LOPDGDD) y aviso legal (`/aviso-legal`, LSSI), públicos y enlazados desde el inicio de sesión, el registro y el perfil. Los datos del titular se rellenan en `lib/legal.ts`; mientras falten, las páginas se marcan como borrador.
