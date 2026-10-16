// Detección para la pantalla «Instalar la app» (PWA). Funciones puras: se prueban sin navegador.

export type InstallPlatform = "ios-safari" | "ios-other" | "android" | "other"

/**
 * Qué instrucciones mostrar según el navegador. iPadOS se presenta como Mac de escritorio,
 * por eso se mira también si la pantalla es táctil.
 */
export function detectInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  const isIos = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  if (isIos) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent) ? "ios-other" : "ios-safari"
  if (/Android/.test(userAgent)) return "android"
  return "other"
}

/** La app se abre instalada (desde el icono) y no en una pestaña del navegador */
export function isStandaloneDisplay(win: Partial<Pick<Window, "matchMedia">> & { navigator: { standalone?: boolean } }) {
  return win.matchMedia?.("(display-mode: standalone)").matches === true || win.navigator.standalone === true
}
