// Tipo común de base de datos para las consultas de lib/data: vale para Neon (HTTP o Pool)
// en la app y para PGlite en los tests.
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"

import type * as schema from "@/db/schema"

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
