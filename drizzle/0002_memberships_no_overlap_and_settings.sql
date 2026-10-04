-- Lo que drizzle-kit no sabe expresar en db/schema.ts.

-- Un cliente no puede tener dos tarifas que se solapen (ARCHITECTURE §3, memberships).
-- ends_on null = sin fecha de fin; '[]' = ambos extremos incluidos.
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_no_overlap"
  EXCLUDE USING gist ("user_id" WITH =, daterange("starts_on", "ends_on", '[]') WITH &&);--> statement-breakpoint

-- La fila única de ajustes (id = 1). El nombre lo cambia después el desarrollador.
INSERT INTO "gym_settings" ("id", "name") VALUES (1, 'Athlos Centro Deportivo')
  ON CONFLICT ("id") DO NOTHING;
