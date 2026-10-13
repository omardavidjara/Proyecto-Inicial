import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

import { PlanSummaryBar, PlanSummaryTiles } from '@/components/sessions/plan-summary'

afterEach(cleanup)

const weekly = { planName: '3 a la semana', period: 'week' as const, classesPerPeriod: 3, remaining: 1 }

describe('tarifa del cliente', () => {
  test('«Inicio»: clases que quedan, tarifa y cambio programado', () => {
    render(<PlanSummaryTiles summary={{ current: weekly, next: { planName: 'Bono 8', startsOn: '2026-11-01' } }} />)
    expect(screen.getByText('Te quedan esta semana')).toBeDefined()
    expect(screen.getByText('1').parentElement?.textContent).toBe('1 de 3')
    expect(screen.getByText('3 a la semana')).toBeDefined()
    expect(screen.getByText('Desde el 1 nov 2026: Bono 8')).toBeDefined()
  })

  test('«Inicio»: ilimitada y sin tarifa', () => {
    const { unmount } = render(
      <PlanSummaryTiles summary={{ current: { planName: 'Libre', period: 'unlimited', classesPerPeriod: null, remaining: null }, next: null }} />,
    )
    expect(screen.getByText('Ilimitadas')).toBeDefined()
    unmount()
    render(<PlanSummaryTiles summary={{ current: null, next: null }} />)
    expect(screen.getByText('Aún no tienes tarifa')).toBeDefined()
    expect(screen.getByText(/Pide en recepción/)).toBeDefined()
  })

  test('«Calendario»: franja con lo que queda, enlazada a mis reservas', () => {
    const { unmount } = render(<PlanSummaryBar summary={{ current: { ...weekly, period: 'month', remaining: 5 }, next: null }} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/reservas')
    expect(link.textContent).toBe('Tarifa 3 a la semanaTe quedan 5 este mes')
    unmount()
    render(<PlanSummaryBar summary={{ current: null, next: null }} />)
    expect(screen.getByRole('link').textContent).toBe('Sin tarifaNo puedes reservar')
  })
})
