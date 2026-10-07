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
- 2026-10-07 · En marcha: *bucket* de R2 con jurisdicción UE, secretos de GitHub y primera copia
  (`daily/athlos-2026-10-07T1208Z.dump.age`, 61 KB). Restauración probada (ver la tabla del final).
- Si una ejecución falla, el paso que falla deja una anotación con la causa (sin datos sensibles).
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
3. Descifra y restaura (sin `age` ni Postgres instalados: descifrar con el paquete npm `age-encryption`
   y usar `pg_restore` de los binarios portátiles de EnterpriseDB, `postgresql-18.x-1-windows-x64-binaries.zip`):
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
| 2026-10-07 | ✅ Copia del 2026-10-07 12:08 UTC restaurada con `pg_restore` 18.6 en una rama de prueba de Neon en 14 s, sin errores. Las 22 tablas (`public`, `neon_auth`, `drizzle`) con el mismo número de filas que producción; un perfil borrado antes en la rama volvió con la restauración (los datos venían de la copia); restricciones, extensiones y ajustes presentes. Archivo descifrado borrado al terminar |
