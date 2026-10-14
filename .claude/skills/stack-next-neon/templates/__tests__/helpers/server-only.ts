// Sustituto de `server-only` en los tests (vitest.config.mts): el paquete real lanza un error fuera
// de los Server Components de Next. En la app sigue protegiendo: el build falla si el cliente lo importa.
export {}
