// Firma la subida directa de la foto de perfil a Vercel Blob (LIMITS D7: no pasa por el límite de 4,5 MB de las
// funciones). Solo con sesión, solo en la carpeta propia, solo WebP o JPEG pequeños y con límite de subidas
// (Blob Hobby: 2 000 al mes). La URL se guarda después con la Server Action, que vuelve a comprobarla.
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"

import { AVATAR_CONTENT_TYPES, AVATAR_MAX_BYTES, avatarFolder } from "@/lib/avatar"
import { getViewer, isRateLimited, noteAttempt } from "@/lib/dal"

export async function POST(request: Request) {
  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return NextResponse.json({ error: "Petición no válida" }, { status: 400 })
  }
  // Solo firmar: los avisos de "subida terminada" de Blob no se usan (la Server Action guarda la URL)
  if (body?.type !== "blob.generate-client-token") return NextResponse.json({ error: "No admitido" }, { status: 400 })

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const viewer = await getViewer()
        if (!viewer) throw new UploadRejected("Inicia sesión para subir una foto", 401)
        if (!pathname.startsWith(avatarFolder(viewer.userId)) || pathname.includes("..")) {
          throw new UploadRejected("Ruta no permitida", 403)
        }
        if (await isRateLimited("avatar", viewer.userId)) throw new UploadRejected("Demasiadas fotos seguidas. Espera unos minutos.", 429)
        await noteAttempt("avatar", viewer.userId)
        return {
          allowedContentTypes: [...AVATAR_CONTENT_TYPES],
          maximumSizeInBytes: AVATAR_MAX_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 5 * 60_000,
        }
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof UploadRejected) return NextResponse.json({ error: error.message }, { status: error.status })
    throw error
  }
}

class UploadRejected extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}
