// Base de datos de prueba: Postgres real en memoria (PGlite, WASM) con las migraciones de drizzle/.
// Así los tests comprueban restricciones e índices sin conectarse a Neon ni gastar cómputo.
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/db/schema";

export async function createTestDb() {
  const client = new PGlite({ extensions: { btree_gist, pg_trgm } });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db, client, close: () => client.close() };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>["db"];
