// Historial de «Mis reservas» (F5): «Ver más» añade la página siguiente sin duplicados y desaparece al final.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import type { HistoryEntry } from '@/lib/booking-history'

const mocks = vi.hoisted(() => ({ loadHistory: vi.fn(), toastError: vi.fn() }))
vi.mock('@/app/(client)/reservas/actions', () => ({ loadHistoryAction: mocks.loadHistory }))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))

import { BookingHistory } from '@/components/sessions/booking-history'

const entry = (id: string, label = 'Realizada'): HistoryEntry => ({
  id,
  sessionId: `s-${id}`,
  day: 'Ayer',
  time: '09:00',
  className: `Clase ${id}`,
  color: 'teal',
  status: { label, variant: 'secondary' },
  struck: false,
})

afterEach(cleanup)

test('carga la página siguiente con el cursor y se oculta al terminar', async () => {
  mocks.loadHistory.mockResolvedValue({ items: [entry('b'), entry('c', 'Anulada')], nextCursor: null })
  render(<BookingHistory initial={[entry('a'), entry('b')]} initialCursor="cursor-1" />)
  fireEvent.click(screen.getByRole('button', { name: 'Ver más' }))
  await waitFor(() => expect(screen.getByText('Clase c')).toBeTruthy())
  expect(mocks.loadHistory).toHaveBeenCalledWith('cursor-1')
  expect(screen.getAllByRole('link')).toHaveLength(3)
  expect(screen.getByText('Anulada')).toBeTruthy()
  expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('/calendario/s-a')
  expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull()
})

test('si falla, avisa y deja el botón para reintentar', async () => {
  mocks.loadHistory.mockRejectedValue(new Error('red'))
  render(<BookingHistory initial={[entry('a')]} initialCursor="cursor-1" />)
  fireEvent.click(screen.getByRole('button', { name: 'Ver más' }))
  await waitFor(() => expect(mocks.toastError).toHaveBeenCalled())
  expect(screen.getByRole('button', { name: 'Ver más' })).toBeTruthy()
})
