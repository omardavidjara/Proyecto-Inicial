// Cliente de Drizzle. Solo servidor: `server-only` hace fallar el build si un componente de
// cliente lo importa (ARCHITECTURE §10). Las consultas pasan por lib/dal.ts, nunca directas.
import "server-only";

import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

// Se crean al primer uso: así `next build` no exige DATABASE_URL si una página no consulta.
let httpDb: ReturnType<typeof createHttpDb> | undefined;
let poolDb: ReturnType<typeof createPoolDb> | undefined;

function databaseUrl() {
  const url = process.env.DATABASE_URL; // URL con pooling (LIMITS: "Cómo no gastar cómputo")
  if (!url) throw new Error("Falta DATABASE_URL (ver .env.example)");
  return url;
}

function createHttpDb() {
  return drizzleHttp({ client: neon(databaseUrl()), schema });
}

function createPoolDb() {
  return drizzlePool({ client: new Pool({ connectionString: databaseUrl() }), schema });
}

/** Lecturas y escrituras sueltas: driver HTTP (una petición por consulta, sin conexión abierta). */
export function getDb() {
  httpDb ??= createHttpDb();
  return httpDb;
}

/**
 * Transacciones interactivas (`SELECT … FOR UPDATE` al reservar, ARCHITECTURE §4):
 * necesitan el Pool por WebSocket; el driver HTTP no las admite.
 */
export function getTxDb() {
  poolDb ??= createPoolDb();
  return poolDb;
}
