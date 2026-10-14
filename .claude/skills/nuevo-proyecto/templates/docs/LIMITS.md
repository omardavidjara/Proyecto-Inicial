# Límites de los servicios · {{Proyecto}}

> Límites de los planes gratuitos que usamos y cómo diseñamos para no chocar con ellos.
> Cifras comprobadas en la documentación oficial el **{{AAAA-MM-DD}}**. Los proveedores las cambian: si una cifra es decisiva, vuelve a comprobarla y actualiza este documento.
> Punto de partida con las cifras ya conocidas de Vercel, Neon, GitHub y Sentry: `references/limites-proveedores.md` de la skill `stack-next-neon`.

## Cómo se usa este documento (Claude)

1. **Antes de diseñar** algo que consuma recursos (cron, subida de archivos, imágenes, consultas frecuentes, servicios nuevos, ramas de base de datos, workflows), revisa la sección del servicio.
2. Si el diseño **se acerca a un límite** (más del ~50 % del cupo con el uso previsto), no lo implementes tal cual: elige la alternativa de este documento o busca otra gratuita, y explícala en el plan.
3. Si **un límite bloquea**, no te detengas: propone la alternativa gratuita más sencilla y, si implica pagar, crear una cuenta o cambiar la arquitectura, márcalo como [J] y pregunta.
4. Anota cada decisión en [decisiones](#decisiones-tomadas) y, si cambia la arquitectura, también en `docs/ARCHITECTURE.md`.

Uso previsto para dimensionar: **{{usuarios, operaciones al día…}}**. Los riesgos reales van marcados con ⚠️.

---

## {{Servicio}} (plan {{…}})

Fuentes: {{enlaces}}

| Recurso | Límite | Impacto en el proyecto |
|---|---|---|

---

## Decisiones tomadas

| # | Problema | Alternativa recomendada | Estado |
|---|---|---|---|
| D1 | | | |
