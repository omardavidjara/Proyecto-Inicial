"use client"

import { RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function RetryButton() {
  return (
    <Button onClick={() => window.location.reload()}>
      <RotateCw data-icon="inline-start" aria-hidden="true" />
      Reintentar
    </Button>
  )
}
