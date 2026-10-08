import { describe, expect, test, vi } from 'vitest'

vi.mock('next/font/google', () => ({ Geist: () => ({ variable: '' }), Geist_Mono: () => ({ variable: '' }) }))
vi.mock('@/lib/dal', () => ({ getSessionUser: vi.fn(async () => null) }))
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { social: vi.fn() } } }))
vi.mock('../app/(auth)/actions', () => ({ signInWithEmail: vi.fn(), signOut: vi.fn() }))

import { metadata as rootMetadata } from '../app/layout'
import { metadata as loginMetadata } from '../app/(auth)/login/page'
import { metadata as legalNoticeMetadata } from '../app/aviso-legal/page'
import { metadata as privacyMetadata } from '../app/privacidad/page'
import robots from '../app/robots'
import { INDEXABLE_PATHS } from '@/lib/seo'

describe('buscadores: solo las páginas públicas (pendiente de la Fase 2)', () => {
  test('robots.txt deja rastrear login y textos legales y nada más', () => {
    expect(robots().rules).toEqual({ userAgent: '*', allow: ['/login', '/privacidad', '/aviso-legal'], disallow: '/' })
  })

  test('por defecto, ninguna página se indexa', () => {
    expect(rootMetadata.robots).toEqual({ index: false, follow: false })
  })

  test.each([
    ['/login', loginMetadata],
    ['/privacidad', privacyMetadata],
    ['/aviso-legal', legalNoticeMetadata],
  ])('%s se puede indexar', (path, metadata) => {
    expect(INDEXABLE_PATHS).toContain(path)
    expect(metadata.robots).toEqual({ index: true, follow: true })
  })
})
