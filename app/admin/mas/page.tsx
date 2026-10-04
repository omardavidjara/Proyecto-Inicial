import type { Metadata } from "next"
import { ComingSoon } from "@/components/coming-soon"

export const metadata: Metadata = { title: "Más opciones" }

export default function MasOpcionesPage() {
  return <ComingSoon title="Más opciones" feature="F2, F3, F4, F10 y F11" wide />
}
