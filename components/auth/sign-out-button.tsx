import { LogOut } from "lucide-react"
import { signOut } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { PushEndpointField } from "./push-endpoint-field"

/** Cierra la sesión (Server Action): funciona aunque no haya cargado el JavaScript */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut} className={className}>
      <PushEndpointField />
      <Button type="submit" variant="outline" size="lg" className="w-full">
        <LogOut aria-hidden="true" />
        Cerrar sesión
      </Button>
    </form>
  )
}
