import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

const captureException = vi.hoisted(() => vi.fn())
vi.mock('@sentry/nextjs', () => ({ captureException }))

import ClientError from '../app/(client)/error'
import AdminError from '../app/admin/error'
import CoachError from '../app/entrenador/error'

describe('error.tsx de cada zona', () => {
  test.each([
    ['cliente', ClientError],
    ['administración', AdminError],
    ['entrenador', CoachError],
  ])('%s: avisa a Sentry, muestra el error dentro del marco y permite reintentar', (_zone, ZoneError) => {
    const error = new Error('fallo de prueba')
    const retry = vi.fn()
    const { unmount } = render(<ZoneError error={error} retry={retry} />)

    expect(captureException).toHaveBeenCalledWith(error)
    expect(screen.getByRole('heading', { level: 1, name: 'Algo ha fallado' })).toBeTruthy()
    // Nunca el mensaje interno del error
    expect(screen.queryByText('fallo de prueba')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledOnce()
    unmount()
  })
})
