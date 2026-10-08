"use client"

import { RouteError, type RouteErrorProps } from "@/components/route-error"

export default function ZoneError(props: RouteErrorProps) {
  return <RouteError {...props} wide />
}
