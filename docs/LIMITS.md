# Límites de los servicios · Athlos App

> Límites de los planes gratuitos que usamos y cómo diseñamos para no chocar con ellos.
> Cifras comprobadas en la documentación oficial el **2026-10-02**. Los proveedores las cambian: si una cifra es decisiva, vuelve a comprobarla en el enlace de su sección y actualiza este documento.

## Cómo se usa este documento (Claude)

1. **Antes de diseñar** algo que consuma recursos (cron, subida de archivos, imágenes, consultas frecuentes, nuevos servicios, ramas de Neon, workflows), revisa la sección del servicio.
2. Si el diseño **se acerca a un límite** (más del ~50 % del cupo con el uso previsto), no lo implementes tal cual: elige la alternativa de este documento o busca otra que siga siendo gratuita, y explícala en el plan de la tarea.
3. Si **un límite bloquea** el avance, no te detengas: propone la alternativa gratuita más sencilla y, si implica pagar, crear una cuenta nueva o cambiar la arquitectura, márcalo como [J] y pregunta.
4. Anota cada decisión en la tabla de [decisiones](#decisiones-tomadas) y, si cambia la arquitectura, también en `docs/ARCHITECTURE.md`.

Uso previsto para dimensionar: **un gimnasio**, del orden de 100–300 clientes, 10–40 sesiones al día, pocas personas de administración. Con este uso, casi todos los cupos sobran; los riesgos reales son los marcados con ⚠️.

---

## Vercel (plan Hobby)

Fuentes: [Limits](https://vercel.com/docs/limits) · [Fair use](https://vercel.com/docs/limits/fair-use-guidelines) · [Functions](https://vercel.com/docs/functions/limitations) · [Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing) · [Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing)

| Recurso | Límite Hobby | Impacto en el proyecto |
|---|---|---|
| ⚠️ **Uso comercial** | **Prohibido**: Hobby es solo para uso personal no comercial. Cuenta como comercial cualquier despliegue del que alguien obtenga beneficio (incluido cobrar por desarrollarlo o alojarlo) | La app de un gimnasio real en producción es uso comercial. Desarrollo y pruebas en Hobby: sí. Producción con el gimnasio: ver decisión D1 |
| ⚠️ **Cron** | Como mucho **1 vez al día** y con precisión de ±59 min (un cron a la 1:00 se ejecuta entre 1:00 y 1:59). Una expresión más frecuente **hace fallar el despliegue** | `generate-sessions` cabe. `reminders` cada 15 min no: ver D2 |
| ⚠️ **Región de las funciones** | Una sola región; por defecto `iad1` (EE. UU. este) | Neon estará en Europa: con la región por defecto cada consulta cruza el Atlántico. Fijar `fra1` (ver D3) |
| Duración de una función | 300 s por defecto y máximo | Ningún proceso debe tardar tanto: trabajos largos, por lotes |
| Memoria | 2 GB / 1 vCPU | Sobra |
| Cuerpo de petición/respuesta | **4,5 MB** máx. (error 413) | Las fotos no pasan por una Server Action: subida directa del cliente a Blob (ver Blob) |
| Invocaciones | 1 000 000 / mes | Sobra. No hacer *polling* desde el navegador |
| CPU activa | 4 h / mes | Sobra si no se hace trabajo pesado en el servidor (nada de procesar imágenes en funciones) |
| Memoria aprovisionada | 360 GB-h / mes | Sobra |
| Transferencia (Fast Data Transfer) | 100 GB / mes | Sobra |
| Fast Origin Transfer | 10 GB / mes | Sobra; cachear lo estático |
| Optimización de imágenes | 5 000 transformaciones, 300 000 lecturas y 100 000 escrituras de caché / mes | Avatares ya redimensionados al subirlos; pocos tamaños en `sizes` |
| Despliegues | 100 / día, 100 / hora, 60 cada 5 min; **1 build a la vez**; 45 min por build | Hacer push al cerrar tarea, no en cada commit. Saltar builds de cambios solo de `docs/` (ver D6) |
| Logs de ejecución | Se guardan **1 hora** | Para investigar errores pasados hace falta Sentry (Fase 4) |
| Variables de entorno | 64 KB en total | Sobra |
| Repositorio | Hobby **no puede conectar repos de organizaciones de GitHub** | Mantener el repo en la cuenta personal |

### Vercel Blob (fotos de perfil)

| Recurso | Incluido Hobby |
|---|---|
| Almacenamiento | 1 GB / mes |
| Operaciones simples (lecturas con *cache miss*, `head()`) | 10 000 / mes |
| Operaciones avanzadas (`put()`, `copy()`, `list()`, y **navegar el almacén en el panel de Vercel**) | **2 000 / mes** |
| Transferencia | 10 GB / mes |
| Ritmo | 1 200 simples/min, 900 avanzadas/min |

⚠️ Si se supera un cupo de Blob en Hobby, **Blob queda bloqueado 30 días** (no se cobra, se corta). Reglas:
- Redimensionar y comprimir la foto **en el cliente** antes de subirla (p. ej. 512×512, WebP/JPEG ~80 %, < 200 KB).
- Subida directa del cliente (*client upload*) con token generado en el servidor tras verificar la sesión: no pasa por el límite de 4,5 MB ni gasta transferencia de la función.
- Una sola `put()` por cambio de foto; borrar la anterior con `del()` (gratis). Nunca `list()` en código de producción.
- Alternativa si se queda corto: **Cloudflare R2** (plan gratuito con 10 GB y sin coste de salida; verificar condiciones al decidir).

---

## Neon (plan Free)

Fuentes: [Pricing](https://neon.com/pricing) · [Planes](https://neon.com/docs/introduction/plans)

| Recurso | Límite Free | Impacto en el proyecto |
|---|---|---|
| ⚠️ **Cómputo** | **100 CU-h / proyecto / mes**. Al agotarse, la base de datos **se suspende hasta el mes siguiente** | El riesgo principal. Ver "Cómo no gastar cómputo" |
| Suspensión automática | Tras **5 min** sin actividad; no se puede desactivar | Primera consulta tras la suspensión: arranque en frío (unos cientos de ms). Aceptable |
| Autoescalado | Hasta 2 CU | Fijar máx. **1 CU** (mín. 0,25) para acotar el gasto |
| Almacenamiento | 1 GB / proyecto (20 GB en total). Al llenarse, fallan las escrituras que lo aumentan | Sobra para datos de texto. Nada de imágenes ni archivos en la base de datos |
| Transferencia de salida | 5 GB / proyecto / mes | Seleccionar solo columnas necesarias y paginar (ya previsto en ARCHITECTURE §9) |
| ⚠️ **Ramas** | **10 por proyecto** | La integración de Vercel crea una rama por *preview*: hay que borrarlas al cerrar la PR (ver D4) |
| Restauración (PITR) | Solo **6 h** de historial; 1 instantánea manual | No sirve como copia de seguridad: ver D5 |
| Monitorización | 1 día de datos | — |
| Neon Auth | Hasta 60 000 usuarios activos al mes | Sobra |

### Cómo no gastar cómputo

Cada CU-h = 1 CU durante 1 hora. A 0,25 CU, 100 CU-h dan ~400 h de base de datos despierta al mes (de ~730). Cualquier cosa que la despierte con frecuencia la mantiene encendida al menos 5 min más:

- **Cron**: uno cada 15 min las 24 h la mantendría despierta ~1/3 del tiempo solo por el cron (~60 CU-h/mes a 0,25 CU). Los trabajos periódicos se ejecutan **solo en horario del gimnasio** y con la menor frecuencia útil (ver D2).
- **Monitores de disponibilidad** (Sentry Uptime, etc.): apuntar a una ruta que **no toque la base de datos** (p. ej. `/api/health` sin consultas).
- **Nada de *polling*** desde el navegador ni `refresh` periódicos. Revalidar al mutar (`revalidatePath`).
- Cachear con `use cache` lo que cambia poco (tipos de clase, tarifas, ajustes) para no consultar en cada visita.
- Conexiones: en Vercel siempre la URL **con pooling** (`DATABASE_URL`); la directa solo para migraciones.
- Revisar el consumo en la consola de Neon al cerrar cada fase de la Fase 5 y anotarlo aquí si supera el 50 %.

Plan B si el cómputo no alcanza: plan **Launch** de pago por uso (~0,106 $/CU-h), que a este volumen serían pocos euros al mes.

---

## GitHub (cuenta Free, repositorio **público**)

Fuentes: [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) · [Eventos (schedule)](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) · [Ramas protegidas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

El repositorio `omardavidjara/Proyecto-Inicial` es **público**. Ventajas: Actions gratis e ilimitado en runners estándar y protección de ramas disponible. Consecuencias:

| Tema | Regla |
|---|---|
| ⚠️ **Todo es visible** | Código, historial, issues, PR y **logs de Actions** son públicos. Nunca secretos, `.env*`, volcados de la base de datos ni datos personales reales (semillas y tests con datos inventados). Nunca `echo` de secretos en workflows |
| ⚠️ **Artefactos de Actions** | Los puede descargar cualquier usuario con sesión en GitHub: nunca subir copias de la base de datos sin cifrar |
| Minutos de Actions | Ilimitados (repo público, runners estándar). Si el repo pasa a privado: 2 000 min/mes, y Windows/macOS gastan más |
| Caché de Actions | 10 GB por repositorio |
| Artefactos / Packages | 500 MB |
| ⚠️ **Workflows programados** | Mínimo cada 5 min; **pueden retrasarse** en horas de carga (sobre todo en punto) e incluso **descartarse**; en repos públicos **se desactivan solos tras 60 días sin actividad** | No usarlos como único programador para algo crítico (ver D2). Programar en minutos "raros" (p. ej. `7,37`), no en `:00` |
| Protección de ramas | Disponible en repos públicos. **Si el repo pasa a privado, GitHub Free la pierde** (requiere Pro) |

Si se decide hacer el repo privado (recomendable cuando haya clientes reales): repasar CI (minutos) y protección de rama antes de cambiarlo.

---

## Sentry (plan Developer, Fase 4)

Fuente: [Pricing](https://sentry.io/pricing/)

| Recurso | Límite |
|---|---|
| Errores | 5 000 / mes |
| Trazas (spans) | 5 M / mes |
| Session Replay | 50 / mes |
| Usuarios | 1 |
| Retención | 30 días |
| Monitores | 1 de disponibilidad, 1 de cron |

Reglas: `tracesSampleRate` bajo (0,1) en producción; Replay desactivado o solo en errores; filtrar errores ruidosos (extensiones del navegador, cancelaciones de red). Usar el **monitor de cron** para el programador de recordatorios (D2) y el de disponibilidad sobre `/api/health` (sin base de datos).

---

## App móvil y tiendas (Fase 8)

| Servicio | Coste / límite | Nota |
|---|---|---|
| Google Play Console | Pago único | Android se compila en Windows con Android Studio |
| Apple Developer | Cuota anual | Necesario también para las notificaciones push en iOS (APNs) |
| Compilar iOS | Requiere macOS | Sin Mac: servicio en la nube (Codemagic, Appflow…) con minutos de macOS limitados en su plan gratuito: comprobar cupo al llegar a la Fase 8 |
| Push | Web Push y FCM gratuitos | — |

---

## Decisiones tomadas

| # | Problema | Alternativa recomendada | Estado |
|---|---|---|---|
| D1 | Vercel Hobby no permite uso comercial | Desarrollar y probar en Hobby. **Antes de abrir la app al gimnasio real** (Fase 7): pasar a Vercel Pro, o mover el alojamiento a un proveedor cuyo plan gratuito permita uso comercial (comprobar condiciones y compatibilidad con Next 16 en ese momento) | [J] pendiente, Fase 7 |
| D2 | Recordatorios cada 15 min (Vercel Hobby: cron diario) | Programador externo gratuito (p. ej. **cron-job.org**) que llama a `/api/cron/reminders` con `CRON_SECRET`, **solo en horario del gimnasio** (p. ej. cada 15 min de 6:00 a 22:00), y un workflow de GitHub Actions como respaldo. La ruta debe ser **idempotente** y trabajar por ventana ("sesiones que empiezan en las próximas N horas sin recordatorio enviado", gracias al único `(user_id, kind, ref_id)` de `notifications`), así un retraso o una ejecución doble no pierden ni duplican avisos. Monitor de cron de Sentry para detectar si deja de ejecutarse | [J] confirmar en Fase 3 |
| D3 | Funciones en EE. UU. y base de datos en Europa | Proyecto de Neon en **AWS Frankfurt (`aws-eu-central-1`)** y región de funciones de Vercel **`fra1`** (`vercel.json` → `"regions": ["fra1"]`) | Hecho (2026-10-04): Neon en `aws-eu-central-1` y `vercel.json` con `fra1` |
| D4 | Neon Free: 10 ramas | Integración de Neon en Vercel con borrado automático de ramas al cerrar la PR; si no lo hace sola, workflow que borre la rama al cerrar la PR. Revisar ramas huérfanas al cerrar cada funcionalidad | Workflow `neon-branch-cleanup.yml` hecho (2026-10-04); falta `NEON_API_KEY` y `NEON_PROJECT_ID` en GitHub |
| D5 | Neon Free: solo 6 h de restauración | Copia diaria con `pg_dump` desde GitHub Actions, **cifrada** antes de guardarse (el repo es público) y guardada fuera del repo (p. ej. R2 o almacenamiento privado). Probar una restauración una vez | [J] decidir destino en Fase 3 |
| D6 | Vercel: 1 build a la vez y 100 despliegues/día | *Ignored Build Step* en Vercel para no construir cambios que solo tocan `docs/` o `*.md`; push al cerrar tarea | Hecho: `scripts/vercel-ignore-build.sh` (2026-10-04) |
| D7 | Blob: 2 000 subidas/mes y bloqueo de 30 días | Redimensionar en el cliente, una `put()` por cambio, sin `list()`; R2 como alternativa | Aplicar en F1 (Fase 5) |
