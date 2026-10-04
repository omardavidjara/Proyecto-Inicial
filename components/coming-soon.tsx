import { Construction } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { EmptyState } from "@/components/empty-state"

/**
 * PROTOTIPO: pantalla aún no construida. Evita 404 en la navegación del prototipo.
 * Cada página que la usa se sustituye por la real en su funcionalidad de la Fase 5.
 */
export function ComingSoon({ title, feature, wide }: { title: string; feature: string; wide?: boolean }) {
  return (
    <Page title={title} wide={wide}>
      <EmptyState icon={<Construction />} title="Próximamente" description={`Esta pantalla llega con ${feature} (Fase 5).`} />
    </Page>
  )
}
