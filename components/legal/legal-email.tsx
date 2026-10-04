import { LEGAL, isLegalComplete } from "@/lib/legal"

/** Correo de privacidad: enlace mailto solo cuando ya es un correo real (no el marcador del borrador) */
export function LegalEmail() {
  if (!isLegalComplete) return <>{LEGAL.privacyEmail}</>
  return (
    <a href={`mailto:${LEGAL.privacyEmail}`} className="font-medium text-primary underline-offset-4 hover:underline">
      {LEGAL.privacyEmail}
    </a>
  )
}
