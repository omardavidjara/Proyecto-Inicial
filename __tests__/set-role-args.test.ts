// Argumentos del script `npm run db:set-role`: la marca de entrenador de un administrador (--coach / --no-coach)
import { describe, expect, test } from 'vitest'

import { parseSetRoleArgs } from '../scripts/set-role-args.mts'

describe('db:set-role', () => {
  test('entrenador siempre imparte clases y cliente nunca', () => {
    expect(parseSetRoleArgs(['Ana@Example.test', 'coach'])).toEqual({ ok: true, email: 'ana@example.test', role: 'coach', coachFlag: 'true' })
    expect(parseSetRoleArgs(['ana@example.test', 'client'])).toMatchObject({ ok: true, coachFlag: 'false' })
  })

  test('administrador o desarrollador: conserva su marca, o la cambia con --coach / --no-coach', () => {
    expect(parseSetRoleArgs(['ana@example.test', 'admin'])).toMatchObject({ ok: true, coachFlag: null })
    expect(parseSetRoleArgs(['ana@example.test', 'admin', '--coach'])).toMatchObject({ ok: true, role: 'admin', coachFlag: 'true' })
    expect(parseSetRoleArgs(['ana@example.test', 'developer', '--no-coach'])).toMatchObject({ ok: true, coachFlag: 'false' })
  })

  test('combinaciones imposibles y argumentos que no valen', () => {
    expect(parseSetRoleArgs(['ana@example.test', 'coach', '--no-coach'])).toMatchObject({ ok: false })
    expect(parseSetRoleArgs(['ana@example.test', 'client', '--coach'])).toMatchObject({ ok: false })
    expect(parseSetRoleArgs(['ana@example.test', 'admin', '--coach', '--no-coach'])).toMatchObject({ ok: false })
    expect(parseSetRoleArgs(['ana@example.test', 'admin', '--entrenador'])).toMatchObject({ ok: false })
    expect(parseSetRoleArgs(['no-es-correo', 'admin'])).toMatchObject({ ok: false, error: expect.stringContaining('Uso:') })
  })
})
