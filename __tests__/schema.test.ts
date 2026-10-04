// @vitest-environment node
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  bookings,
  classTypes,
  gymSettings,
  memberships,
  notifications,
  plans,
  profiles,
  sessions,
} from "@/db/schema";

import { createTestDb, type TestDb } from "./helpers/test-db";

let db: TestDb;
let close: () => Promise<void>;

/** Postgres envuelve el error: el código SQLSTATE puede venir en el error o en su causa. */
async function pgErrorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    return e.code ?? e.cause?.code;
  }
  return undefined;
}

const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const EXCLUSION_VIOLATION = "23P01";
const FK_VIOLATION = "23503";

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await db.insert(profiles).values([
    { userId: "user-ana", fullName: "Ana Prueba" },
    { userId: "user-coach", fullName: "Carlos Prueba", role: "coach", isCoach: true },
  ]);
}, 60_000);

afterAll(async () => {
  await close();
});

async function newSession() {
  const [type] = await db
    .insert(classTypes)
    .values({ name: "Funcional", durationMinutes: 60, defaultCapacity: 10, color: "orange" })
    .returning();
  const [session] = await db
    .insert(sessions)
    .values({
      classTypeId: type.id,
      startsAt: new Date("2026-11-02T08:00:00Z"),
      endsAt: new Date("2026-11-02T09:00:00Z"),
      capacity: 10,
    })
    .returning();
  return session;
}

describe("migraciones", () => {
  test("crean la fila única de ajustes con los valores por defecto", async () => {
    const rows = await db.select().from(gymSettings);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 1,
      timezone: "Europe/Madrid",
      bookingWindowDays: 7,
      cancelDeadlineMinutes: 120,
    });
    expect(await pgErrorCode(db.insert(gymSettings).values({ id: 2, name: "Otro" }))).toBe(
      CHECK_VIOLATION,
    );
  });

  test("un perfil nuevo es cliente pendiente", async () => {
    const [ana] = await db.select().from(profiles).limit(1);
    expect(ana).toMatchObject({ role: "client", status: "pending", isCoach: false });
  });
});

describe("restricciones de profiles", () => {
  test("un entrenador siempre tiene is_coach y un cliente nunca", async () => {
    expect(
      await pgErrorCode(
        db.insert(profiles).values({ userId: "x1", fullName: "X", role: "coach", isCoach: false }),
      ),
    ).toBe(CHECK_VIOLATION);
    expect(
      await pgErrorCode(
        db.insert(profiles).values({ userId: "x2", fullName: "X", role: "client", isCoach: true }),
      ),
    ).toBe(CHECK_VIOLATION);
    // Un admin puede impartir clases
    await db
      .insert(profiles)
      .values({ userId: "user-admin", fullName: "Admin", role: "admin", isCoach: true });
  });
});

describe("restricciones de bookings", () => {
  test("un cliente no puede tener dos reservas vivas en la misma sesión", async () => {
    const session = await newSession();
    const booking = { sessionId: session.id, userId: "user-ana", createdBy: "user-ana" };
    await db.insert(bookings).values({ ...booking, status: "confirmed" });
    expect(
      await pgErrorCode(
        db.insert(bookings).values({ ...booking, status: "waitlisted", waitlistedAt: new Date() }),
      ),
    ).toBe(UNIQUE_VIOLATION);
    // Las anuladas no cuentan: puede volver a reservar tras anular
    await db.insert(bookings).values({ ...booking, status: "cancelled", cancelledAt: new Date() });
  });

  test("la lista de espera exige waitlisted_at y la decisión de anulación tardía solo en late_cancelled", async () => {
    const session = await newSession();
    const booking = { sessionId: session.id, userId: "user-ana", createdBy: "user-ana" };
    expect(await pgErrorCode(db.insert(bookings).values({ ...booking, status: "waitlisted" }))).toBe(
      CHECK_VIOLATION,
    );
    expect(
      await pgErrorCode(
        db.insert(bookings).values({ ...booking, status: "cancelled", lateCancelCharged: true }),
      ),
    ).toBe(CHECK_VIOLATION);
  });

  test("las reservas exigen un perfil existente", async () => {
    const session = await newSession();
    expect(
      await pgErrorCode(
        db
          .insert(bookings)
          .values({ sessionId: session.id, userId: "nadie", createdBy: "nadie", status: "confirmed" }),
      ),
    ).toBe(FK_VIOLATION);
  });
});

describe("restricciones de memberships y plans", () => {
  test("un cliente no puede tener dos tarifas solapadas", async () => {
    const [plan] = await db
      .insert(plans)
      .values({ name: "8 clases/mes", period: "month", classesPerPeriod: 8 })
      .returning();
    await db
      .insert(memberships)
      .values({ userId: "user-ana", planId: plan.id, startsOn: "2026-10-01", endsOn: "2026-10-31" });
    expect(
      await pgErrorCode(
        db
          .insert(memberships)
          .values({ userId: "user-ana", planId: plan.id, startsOn: "2026-10-31" }),
      ),
    ).toBe(EXCLUSION_VIOLATION);
    // Consecutiva sin solape: correcta; y otro cliente puede tener las mismas fechas
    await db.insert(memberships).values({ userId: "user-ana", planId: plan.id, startsOn: "2026-11-01" });
    await db
      .insert(memberships)
      .values({ userId: "user-coach", planId: plan.id, startsOn: "2026-10-01" });
  });

  test("las tarifas ilimitadas no tienen cupo y las demás sí", async () => {
    expect(
      await pgErrorCode(
        db.insert(plans).values({ name: "Mala", period: "unlimited", classesPerPeriod: 4 }),
      ),
    ).toBe(CHECK_VIOLATION);
    expect(await pgErrorCode(db.insert(plans).values({ name: "Mala", period: "week" }))).toBe(
      CHECK_VIOLATION,
    );
  });
});

describe("restricciones de sessions y notifications", () => {
  test("una sesión termina después de empezar", async () => {
    const session = await newSession();
    expect(
      await pgErrorCode(
        db.insert(sessions).values({
          classTypeId: session.classTypeId,
          startsAt: new Date("2026-11-02T09:00:00Z"),
          endsAt: new Date("2026-11-02T09:00:00Z"),
          capacity: 5,
        }),
      ),
    ).toBe(CHECK_VIOLATION);
  });

  test("la misma notificación no se registra dos veces, ni siquiera sin ref_id", async () => {
    await db.insert(notifications).values({ userId: "user-ana", kind: "account_approved" });
    expect(
      await pgErrorCode(
        db.insert(notifications).values({ userId: "user-ana", kind: "account_approved" }),
      ),
    ).toBe(UNIQUE_VIOLATION);
  });
});
