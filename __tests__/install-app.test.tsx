import { afterEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InstallGuide } from '@/components/pwa/install-guide'
import { InstallLink } from '@/components/pwa/install-link'
import { detectInstallPlatform } from '@/lib/install'
import { isPublicPath } from '@/lib/roles'

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
}

function setDevice({ userAgent, standalone = false, touchPoints = 0 }: { userAgent: string; standalone?: boolean; touchPoints?: number }) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  // jsdom no define maxTouchPoints
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touchPoints, configurable: true })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: standalone && query === '(display-mode: standalone)',
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('detectInstallPlatform', () => {
  test('distingue iPhone con Safari, iPhone con otro navegador, iPad, Android y escritorio', () => {
    expect(detectInstallPlatform(UA.iphoneSafari)).toBe('ios-safari')
    expect(detectInstallPlatform(UA.iphoneChrome)).toBe('ios-other')
    expect(detectInstallPlatform(UA.ipad, 5)).toBe('ios-safari')
    expect(detectInstallPlatform(UA.ipad, 0)).toBe('other')
    expect(detectInstallPlatform(UA.android)).toBe('android')
    expect(detectInstallPlatform(UA.desktop)).toBe('other')
  })
})

test('/instalar se abre sin sesión', () => {
  expect(isPublicPath('/instalar')).toBe(true)
})

describe('InstallGuide', () => {
  test('en iPhone con Safari muestra los pasos de «Añadir a pantalla de inicio» y el aviso de las push', () => {
    setDevice({ userAgent: UA.iphoneSafari })
    const { container } = render(<InstallGuide />)
    expect(screen.getByRole('heading', { name: 'En iPhone o iPad' })).toBeTruthy()
    expect(container.textContent).toContain('Añadir a pantalla de inicio')
    expect(container.textContent).toContain('iOS 16.4')
    expect(screen.queryByText('Ábrela en Safari')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Instalar' })).toBeNull()
  })

  test('en iPhone con otro navegador pide abrirla en Safari', () => {
    setDevice({ userAgent: UA.iphoneChrome })
    render(<InstallGuide />)
    expect(screen.getByText('Ábrela en Safari')).toBeTruthy()
  })

  test('en Android sin oferta del navegador muestra los pasos del menú', () => {
    setDevice({ userAgent: UA.android })
    const { container } = render(<InstallGuide />)
    expect(screen.getByRole('heading', { name: 'En Android' })).toBeTruthy()
    expect(container.textContent).toContain('Instalar aplicación')
    expect(screen.queryByRole('button', { name: 'Instalar' })).toBeNull()
  })

  test('en Android con beforeinstallprompt muestra el botón y lanza la instalación', async () => {
    setDevice({ userAgent: UA.android })
    render(<InstallGuide />)
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    act(() => {
      window.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Instalar' }))
    })
    expect(event.prompt).toHaveBeenCalledOnce()
    expect(screen.getByText('Ya tienes la app instalada')).toBeTruthy()
  })

  test('abierta ya instalada solo dice que está instalada', () => {
    setDevice({ userAgent: UA.iphoneSafari, standalone: true })
    render(<InstallGuide />)
    expect(screen.getByText('Ya tienes la app instalada')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'En iPhone o iPad' })).toBeNull()
  })
})

describe('InstallLink', () => {
  test('en el navegador enlaza a /instalar', () => {
    setDevice({ userAgent: UA.android })
    render(<InstallLink />)
    expect(screen.getByRole('link').getAttribute('href')).toBe('/instalar')
  })

  test('no aparece si la app ya se abre instalada', () => {
    setDevice({ userAgent: UA.android, standalone: true })
    render(<InstallLink />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
