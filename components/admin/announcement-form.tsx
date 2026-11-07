"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { deleteAnnouncementAction, publishAnnouncementAction, type AnnouncementFormState } from "@/app/admin/avisos/actions"
import { AnnouncementList } from "@/components/announcements/announcement-list"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AnnouncementEntry } from "@/lib/announcements"
import { ANNOUNCEMENT_BODY_MAX, ANNOUNCEMENT_TITLE_MAX } from "@/lib/validation/announcements"

const initialState: AnnouncementFormState = {}

/** Botón «Nuevo aviso» con el formulario en un diálogo. Se cierra al publicar */
export function AnnouncementDialog() {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)

  function onOpenChange(next: boolean) {
    setOpen(next)
    // Al volver a abrir, el formulario empieza de cero (sin errores ni texto a medias)
    if (next) setFormKey((k) => k + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" aria-hidden="true" />
          Nuevo aviso
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo aviso</DialogTitle>
          <DialogDescription>
            Lo verán todas las cuentas activas y llegará como notificación a quien tenga los avisos activados. Una vez
            enviado no se puede cambiar.
          </DialogDescription>
        </DialogHeader>
        <AnnouncementForm key={formKey} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function AnnouncementForm({ onSaved }: { onSaved: () => void }) {
  const [state, formAction, pending] = useActionState(publishAnnouncementAction, initialState)
  const errors = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.saved) {
      toast.success("Aviso publicado")
      onSaved()
    }
  }, [state, onSaved])

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={ANNOUNCEMENT_TITLE_MAX}
          autoComplete="off"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "title-error" : undefined}
        />
        <FieldError id="title-error" message={errors.title} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="body">Texto</Label>
        <textarea
          id="body"
          name="body"
          required
          rows={5}
          maxLength={ANNOUNCEMENT_BODY_MAX}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? "body-error" : undefined}
          className="min-h-28 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />
        <FieldError id="body-error" message={errors.body} />
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : null}
          {pending ? "Publicando…" : "Publicar"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  ) : null
}

/** La lista de avisos con «Eliminar» en cada uno */
export function AdminAnnouncementList({ initial, initialCursor }: { initial: AnnouncementEntry[]; initialCursor: string | null }) {
  return (
    <AnnouncementList
      initial={initial}
      initialCursor={initialCursor}
      actions={(item) => <DeleteAnnouncement announcement={item} />}
    />
  )
}

function DeleteAnnouncement({ announcement }: { announcement: AnnouncementEntry }) {
  const [pending, startTransition] = useTransition()

  function remove() {
    startTransition(async () => {
      const result = await deleteAnnouncementAction(announcement.id)
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending} aria-label={`Eliminar ${announcement.title}`}>
          <Trash2 aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar este aviso?</DialogTitle>
          <DialogDescription>
            Desaparecerá de la app. Las notificaciones ya enviadas seguirán en los móviles que las recibieron.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Volver</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={remove}>
              Eliminar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
