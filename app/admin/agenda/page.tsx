import type { Metadata } from "next"
import { ComingSoon } from "@/components/coming-soon"

export const metadata: Metadata = { title: "Agenda" }

export default function AgendaPage() {
  return <ComingSoon title="Agenda" feature="F6 · Agenda del administrador" wide />
}
