// Fotos de perfil en Vercel Blob (SPEC F1, LIMITS D7). El navegador reduce la foto y la sube directamente a Blob con
// un token que firma app/api/avatar/upload solo para quien tiene sesión y solo en su carpeta.

/** Límites de la foto ya reducida en el navegador (512 px, WebP o JPEG) */
export const AVATAR_SIZE = 512
export const AVATAR_MAX_BYTES = 300_000
export const AVATAR_CONTENT_TYPES = ["image/webp", "image/jpeg"] as const

/** Carpeta de cada usuario: nadie puede subir ni guardar una foto fuera de la suya */
export const avatarFolder = (userId: string) => `avatars/${userId}/`

/**
 * Dominio público del almacén de Blob, sacado del token (vercel_blob_rw_<id del almacén>_<secreto>).
 * Sin token (tests, local sin Blob) no hay almacén: ninguna URL es válida.
 */
export function blobStoreHost(token: string | undefined) {
  const storeId = token?.match(/^vercel_blob_rw_([a-z0-9]+)_/i)?.[1]
  return storeId ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : null
}

/** ¿Es una foto de nuestro almacén y de la carpeta de este usuario? (lo que llega del navegador no se fía) */
export function isOwnAvatarUrl(value: unknown, userId: string, token: string | undefined) {
  const host = blobStoreHost(token)
  if (!host || typeof value !== "string") return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.host === host && url.pathname.startsWith(`/${avatarFolder(userId)}`) && !url.search
  } catch {
    return false
  }
}
