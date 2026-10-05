"use client"

// Neon Auth en el navegador: solo para lo que exige redirigir desde el cliente (Google).
// Habla con nuestra pasarela /api/auth, nunca directamente con Neon.
import { createAuthClient } from "@neondatabase/auth/next"

export const authClient = createAuthClient()
