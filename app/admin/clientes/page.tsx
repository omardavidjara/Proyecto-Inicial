import type { Metadata } from "next"
import { ComingSoon } from "@/components/coming-soon"

export const metadata: Metadata = { title: "Clientes" }

export default function ClientesPage() {
  return <ComingSoon title="Clientes" feature="F8 · Gestión de clientes" wide />
}
