// Resumen de clases impartidas del entrenador (F7): impartidas, programadas y canceladas de un periodo
import { describe, expect, test } from 'vitest'

import { summarizeCoachPeriod, summarizeCoaches } from '@/lib/coach-summary'
import type { AgendaSession } from '@/lib/data/agenda'

const HOUR = 3_600_000
// Miércoles 25 de marzo de 2026, 12:00 en Madrid
const now = new Date('2026-03-25T11:00:00Z')

const session = (startsAt: string, extra: Partial<AgendaSession> = {}): AgendaSession => ({
  id: crypto.randomUUID(),
  className: 'Funcional',
  color: 'teal',
  startsAt: new Date(startsAt),
  endsAt: new Date(new Date(startsAt).getTime() + HOUR),
  capacity: 10,
  booked: 4,
  waitlisted: 0,
  attended: 3,
  coachId: 'laura',
  coachName: 'Laura',
  status: 'scheduled',
  ...extra,
})

describe('summarizeCoachPeriod', () => {
  test('impartida = terminada y no cancelada; la que está en curso aún es programada', () => {
    const monday = session('2026-03-23T08:00:00Z')
    const tuesday = session('2026-03-24T17:00:00Z')
    const running = session('2026-03-25T10:30:00Z')
    const future = session('2026-03-27T08:00:00Z')
    const cancelledPast = session('2026-03-23T09:00:00Z', { status: 'cancelled' })
    const cancelledFuture = session('2026-03-28T09:00:00Z', { status: 'cancelled' })

    const summary = summarizeCoachPeriod([monday, cancelledPast, tuesday, running, future, cancelledFuture], '2026-03-23', '2026-03-29', now)
    expect(summary).toMatchObject({ taught: 2, scheduled: 2, cancelled: 2 })
    // De la más reciente a la más antigua
    expect(summary.taughtSessions.map((s) => s.id)).toEqual([tuesday.id, monday.id])
  })

  test('solo cuenta los días del periodo, en la hora de Madrid', () => {
    // 00:30 del 1 de marzo en Madrid es el 28 de febrero en UTC: cuenta para marzo
    const firstOfMonth = session('2026-02-28T23:30:00Z')
    const february = session('2026-02-27T08:00:00Z')
    const april = session('2026-04-01T08:00:00Z')

    const summary = summarizeCoachPeriod([february, firstOfMonth, april], '2026-03-01', '2026-03-31', now)
    expect(summary).toMatchObject({ taught: 1, scheduled: 0, cancelled: 0 })
    expect(summary.taughtSessions[0].id).toBe(firstOfMonth.id)
  })
})

describe('summarizeCoaches', () => {
  test('el resumen de cada entrenador en su orden; sin clases, ceros; las demás sesiones no cuentan', () => {
    const coaches = [
      { userId: 'laura', fullName: 'Laura' },
      { userId: 'pablo', fullName: 'Pablo' },
      { userId: 'eva', fullName: 'Eva' },
    ]
    const rows = summarizeCoaches(
      coaches,
      [
        session('2026-03-23T08:00:00Z'),
        session('2026-03-27T08:00:00Z'),
        session('2026-03-24T08:00:00Z', { coachId: 'pablo', coachName: 'Pablo', status: 'cancelled' }),
        session('2026-03-24T09:00:00Z', { coachId: null, coachName: null }),
        session('2026-03-24T10:00:00Z', { coachId: 'antiguo', coachName: 'Antiguo' }),
      ],
      '2026-03-23',
      '2026-03-29',
      now,
    )
    expect(rows.map((r) => [r.fullName, r.summary.taught, r.summary.scheduled, r.summary.cancelled])).toEqual([
      ['Laura', 1, 1, 0],
      ['Pablo', 0, 0, 1],
      ['Eva', 0, 0, 0],
    ])
  })
})
