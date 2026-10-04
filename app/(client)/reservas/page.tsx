import type { Metadata } from "next"
import { ComingSoon } from "@/components/coming-soon"

export const metadata: Metadata = { title: "Mis reservas" }

export default function MisReservasPage() {
  return <ComingSoon title="Mis reservas" feature="F5 · Calendario y reservas" />
}
