// Lista de avisos (F10): «Ver más», sin duplicados, y abrir la pantalla los da por leídos.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ load: vi.fn(), markSeen: vi.fn() }))
vi.mock('@/app/(client)/avisos/actions', () => ({
  loadAnnouncementsAction: mocks.load,
  markAnnouncementsSeenAction: mocks.markSeen,
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { AnnouncementList, MarkAnnouncementsSeen } from '@/components/announcements/announcement-list'

const entry = (id: string) => ({ id, title: `Aviso ${id}`, body: 'Texto', date: '7 nov 2026' })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.markSeen.mockResolvedValue(undefined)
})

afterEach(cleanup)

test('sin más páginas no ofrece «Ver más»', () => {
  render(<AnnouncementList initial={[entry('1')]} initialCursor={null} />)
  expect(screen.getByText('Aviso 1')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull()
})

test('«Ver más» añade la página siguiente sin repetir avisos', async () => {
  mocks.load.mockResolvedValue({ items: [entry('2'), entry('3')], nextCursor: null })
  render(<AnnouncementList initial={[entry('1'), entry('2')]} initialCursor="cursor" />)
  fireEvent.click(screen.getByRole('button', { name: 'Ver más' }))
  expect(await screen.findByText('Aviso 3')).toBeTruthy()
  expect(mocks.load).toHaveBeenCalledWith('cursor')
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull())
})

test('muestra las acciones de cada aviso', () => {
  render(<AnnouncementList initial={[entry('1')]} initialCursor={null} actions={(item) => <button>{`Quitar ${item.id}`}</button>} />)
  expect(screen.getByRole('button', { name: 'Quitar 1' })).toBeTruthy()
})

test('abrir la pantalla marca los avisos como leídos', () => {
  render(<MarkAnnouncementsSeen />)
  expect(mocks.markSeen).toHaveBeenCalledOnce()
})
