import { redirect } from "next/navigation"
import { getViewer } from "@/lib/dal"
import { homePathFor } from "@/lib/roles"

// "/" no tiene pantalla: lleva a /login sin sesión o al inicio de cada rol (ARCHITECTURE §5)
export default async function Home() {
  redirect(homePathFor(await getViewer()))
}
