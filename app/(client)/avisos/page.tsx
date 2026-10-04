import type { Metadata } from "next"
import { ComingSoon } from "@/components/coming-soon"

export const metadata: Metadata = { title: "Avisos" }

export default function AvisosPage() {
  return <ComingSoon title="Avisos" feature="F10 · Avisos y notificaciones" />
}
