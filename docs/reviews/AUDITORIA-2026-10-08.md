# Auditoría intermedia · 2026-10-08 (entre la Fase 4 y la Fase 5)

Revisión de errores, seguridad y funcionalidades incompletas pedida por el usuario. Todo lo corregido pasó por PR
con la CI en verde y se comprobó en https://athlosapp.vercel.app.

## 1. Problemas encontrados y corregidos

| # | Gravedad | Problema | Corrección | PR |
|---|---|---|---|---|
| 1 | Alta | El `matcher` de `proxy.ts` tenía `"\."` en un string de JS (se queda en `.`): el proxy solo corría en `/`, la sesión de Neon Auth no se renovaba y cada página consultaba Neon Auth por red pasados 5 min | Punto escapado con doble barra; test con `unstable_doesMiddlewareMatch` | #5 |
| 2 | Media | Neon Auth no recibe la IP del cliente cuando el login pasa por la Server Action (el SDK no reenvía `x-forwarded-for`): su límite de intentos no distingue personas | Límite propio (tabla `login_attempts`, migración 0003 aplicada en producción): 5 fallos por correo o 20 por IP en 15 min; claves HMAC; borrado a las 24 h; si la base de datos falla, deja pasar y avisa a Sentry | #12 |
| 3 | Media | `/api/auth/*` reenviaba cualquier ruta a Neon Auth (registro, cambio de correo…) | Solo `POST sign-in/social` y `GET get-session` (`lib/auth-gateway.ts`). Además, «Sign-up with Email» **apagado en la consola de Neon** (el navegador ve la URL de Neon Auth) | #6 |
| 4 | Alta | `next` 16.3.6 con 6 avisos altos (SSRF en la optimización de imágenes, envenenamiento de caché…); la CI bloqueaba todas las PR | `next` y `eslint-config-next` 16.4.0 | #10 |
| 5 | Media | Sin `error.tsx` por zona (pendiente de la Fase 4) | `components/route-error.tsx` + `error.tsx` en cliente, admin y entrenador, con aviso a Sentry | #7 |
| 6 | Baja | Sin `robots` (pendiente de la Fase 2) | `app/robots.ts` y `noindex` por defecto salvo `/login`, `/privacidad` y `/aviso-legal` (`lib/seo.ts`) | #8 |
| 7 | Baja | Sin CSP fuera de `/sw.js` (pendiente de las Fases 2 y 6) | CSP base sin tocar scripts: `frame-ancestors`, `base-uri`, `form-action`, `object-src` | #9 |
| 8 | Baja | Ramas de Neon de PR de Dependabot huérfanas: el workflow de limpieza no tenía `NEON_API_KEY` en los secretos de Dependabot | Secreto añadido en Dependabot, clave nueva «github-limpieza-ramas» (la anterior revocada), 3 ramas borradas a mano | #17 |

Dependabot: fusionadas #11 (React 19.3 y menores), #2 (jsdom 30), #14 (`@types/node` 24.19) y #15 (ESLint 10).
Cerradas sin fusionar: #3 (`@types/node` 26: la app corre en Node 24; regla `ignore` en #13) y #16 (TypeScript 7:
`typescript-eslint` solo admite hasta 6.0 y el lint falla). Cuando Dependabot proponga otra 7.x, mirar si la CI pasa.

## 2. Pendientes

| Pendiente | Dónde | Fase |
|---|---|---|
| **Google con credenciales propias** (la lista de producción de Neon lo exige; las «Shared keys» son de desarrollo). En curso: ROADMAP Fase 7 | Google Cloud + Neon | 7 |
| **Apagar «Allow Localhost»** en Neon Auth (lista de producción de Neon). Hoy el desarrollo local usa la base de datos de producción: antes hay que separar desarrollo y producción | Neon | 7 |
| Al construir el registro (F1): volver a encender «Sign-up with Email» con «Verify at Sign-up», añadir la ruta a `lib/auth-gateway.ts` solo si la pide el navegador y aplicar el límite de intentos | ROADMAP F1 | 5 |
| CSP de scripts con nonce desde el proxy (obliga a render dinámico en las páginas hoy estáticas) | `proxy.ts` | 6 |
| Decidir si se acorta `sessionDataTtl` (5 min de sesión válida tras cerrar sesión con cookies robadas) | `lib/auth.ts` | 6 |
| Las claves de API de Neon son personales (acceso a toda la cuenta); con más proyectos, cambiar a una limitada al proyecto | Neon | 9 |
| El login no funciona en las *previews* de Vercel sin añadir su dirección a los dominios de confianza de Neon Auth (ya anotado en la Fase 3) | Neon | — |
