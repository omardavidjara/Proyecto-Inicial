# Copias de seguridad · Athlos App

Decisión: LIMITS D5. Neon Free solo permite restaurar las últimas 6 h, así que cada día
`.github/workflows/db-backup.yml` hace un `pg_dump` completo (incluido `neon_auth`), lo **cifra con
[age](https://age-encryption.org)** y lo sube a **Cloudflare R2** (plan gratuito: 10 GB, sin coste de salida).

El cifrado usa una **clave pública** guardada en GitHub; la **clave privada solo la tiene el responsable**,
fuera del repositorio y de GitHub. Sin ella, las copias no se pueden leer (ni restaurar: no la pierdas).

## Estado

- 2026-10-05 · Claves creadas. Pública (va en GitHub, no es secreta):
  `age1mmljcpglweashwpugya6d7e4ydsj6e6hzf6q3et772j9y945sf7s8fhd7w`.
  La privada se generó en el PC del responsable (`Documentsthlos-backup.key`): pasarla a un gestor de
  contraseñas o USB. Si se pierde, generar otro par y cambiar `BACKUP_AGE_PUBLIC_KEY`; las copias anteriores
  quedarán ilegibles.
- Pendiente: *bucket* de R2, secretos de GitHub, primera ejecución y prueba de restauración.
- El workflow solo se ejecuta (programado o a mano) cuando está en la rama por defecto (`main`).

## Puesta en marcha (una vez)

1. **Claves de cifrado** (hecho el 2026-10-05, ver Estado; `age` está en winget —`winget install FiloSottile.age`—, Homebrew y apt):
   ```bash
   age-keygen -o athlos-backup.key   # muestra la clave pública: "age1…"
   ```
   Guarda `athlos-backup.key` en un gestor de contraseñas o un USB. **Nunca** en el repositorio.
2. **Cloudflare R2**: crea el *bucket* `athlos-backups` con **jurisdicción UE** (*European Union*; `/privacidad` dice que las copias están en la UE) y un token de API de R2
   con permiso *Object Read & Write* solo sobre ese *bucket*. Añade una regla de ciclo de vida que borre
   los objetos de `daily/` a los **30 días**.
3. **GitHub** → Settings → Secrets and variables → Actions:
   - Secretos: `DATABASE_URL_UNPOOLED` (la de producción), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
   - Variables: `R2_ACCOUNT_ID`, `R2_BUCKET` (`athlos-backups`), `BACKUP_AGE_PUBLIC_KEY` (`age1…`)
4. Actions → *Copia de seguridad* → *Run workflow* y comprueba que aparece el archivo en R2.
5. **Prueba una restauración** (abajo) en una rama de Neon. Anotar aquí la fecha de la última prueba.

## Restaurar

1. Descarga el archivo `.dump.age` desde el panel de R2.
2. Crea una **rama nueva** en Neon (nunca restaurar encima de producción a ciegas) y copia su URL directa.
3. Descifra y restaura:
   ```bash
   age --decrypt -i athlos-backup.key athlos-AAAA-MM-DDTHHMMZ.dump.age > copia.dump
   pg_restore --no-owner --no-acl --clean --if-exists -d "postgresql://…rama-nueva…" copia.dump
   ```
   `pg_restore` debe ser de la versión 18 (como Neon). Borra `copia.dump` al terminar: contiene datos personales.
4. Comprueba los datos en la rama y, si son correctos, promuévela a principal en la consola de Neon.

## Coste

Un volcado diario despierta la base de datos unos minutos: ≈ 0,5 CU-h/mes de las 100 incluidas.

## Pruebas de restauración

| Fecha | Resultado |
|---|---|
| — | Pendiente (tras la puesta en marcha) |
