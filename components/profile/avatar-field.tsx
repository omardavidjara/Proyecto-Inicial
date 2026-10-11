"use client"

import { useRef, useTransition } from "react"
import Image from "next/image"
import { Camera, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { upload } from "@vercel/blob/client"
import { deleteAvatar, updateAvatar } from "@/app/(cuenta)/perfil/actions"
import { Button } from "@/components/ui/button"
import { avatarFolder } from "@/lib/avatar"
import { resizeAvatar } from "@/lib/image-resize"

/** Foto de perfil (opcional): cámara o galería del móvil, reducida en el navegador y subida directa a Blob */
export function AvatarField({ userId, avatarUrl, name }: { userId: string; avatarUrl: string | null; name: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()

  function onFile(file: File | undefined) {
    if (!file) return
    startTransition(async () => {
      try {
        const photo = await resizeAvatar(file)
        const extension = photo.type === "image/webp" ? "webp" : "jpg"
        const blob = await upload(`${avatarFolder(userId)}foto.${extension}`, photo, {
          access: "public",
          handleUploadUrl: "/api/avatar/upload",
          contentType: photo.type,
        })
        const { ok } = await updateAvatar(blob.url)
        if (ok) toast.success("Foto actualizada")
        else toast.error("No se ha podido guardar la foto. Inténtalo de nuevo.")
      } catch (error) {
        const message = error instanceof Error && /Demasiadas fotos/.test(error.message) ? error.message : null
        toast.error(message ?? "No se ha podido subir la foto. Prueba con otra imagen.")
      } finally {
        if (input.current) input.current.value = ""
      }
    })
  }

  function onRemove() {
    startTransition(async () => {
      await deleteAvatar()
      toast.success("Foto quitada")
    })
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-semibold text-muted-foreground">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="Tu foto de perfil" fill sizes="80px" unoptimized className="object-cover" />
        ) : (
          <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "?"}</span>
        )}
        {pending ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          id="avatar"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => onFile(event.target.files?.[0])}
          disabled={pending}
        />
        <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={pending}>
          <Camera data-icon="inline-start" aria-hidden="true" />
          {avatarUrl ? "Cambiar foto" : "Añadir foto"}
        </Button>
        {avatarUrl ? (
          <Button type="button" variant="ghost" onClick={onRemove} disabled={pending}>
            <Trash2 data-icon="inline-start" aria-hidden="true" />
            Quitar foto
          </Button>
        ) : null}
      </div>
    </div>
  )
}
