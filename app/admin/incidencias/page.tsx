import type { Metadata } from "next"
import { ComingSoon } from "@/components/coming-soon"

export const metadata: Metadata = { title: "Incidencias" }

export default function IncidenciasPage() {
  return <ComingSoon title="Incidencias" feature="F9 · Incidencias" wide />
}
