// Reduce la foto en el navegador antes de subirla (LIMITS D7: Blob Hobby, < 200 KB por foto).
import { AVATAR_MAX_BYTES, AVATAR_SIZE } from "@/lib/avatar"

/** Recorte cuadrado centrado del lado menor: lo que se ve en el círculo del avatar */
export function centerSquare(width: number, height: number) {
  const side = Math.min(width, height)
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

/**
 * Foto cuadrada de AVATAR_SIZE px en WebP (o JPEG si el navegador no genera WebP), bajando la calidad hasta
 * caber en AVATAR_MAX_BYTES. Respeta la orientación de la cámara (createImageBitmap con imageOrientation).
 */
export async function resizeAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  const { sx, sy, side } = centerSquare(bitmap.width, bitmap.height)
  const size = Math.min(AVATAR_SIZE, side)
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext("2d")
  if (!context) throw new Error("El navegador no puede procesar la imagen")
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
  bitmap.close()

  for (const quality of [0.82, 0.7, 0.55]) {
    const webp = await toBlob(canvas, "image/webp", quality)
    const blob = webp?.type === "image/webp" ? webp : await toBlob(canvas, "image/jpeg", quality)
    if (blob && blob.size <= AVATAR_MAX_BYTES) return blob
  }
  throw new Error("La foto es demasiado grande incluso reducida")
}
