// Configuración de drizzle-kit (generar y aplicar migraciones; ARCHITECTURE §7).
// Las migraciones usan la conexión directa (sin pooling): DATABASE_URL_UNPOOLED.
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  // Solo `public`: el esquema `neon_auth` lo gestiona Neon Auth y drizzle-kit no debe tocarlo
  schemaFilter: ["public"],
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? "" },
  strict: true,
  verbose: true,
});
