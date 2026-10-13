import type { Metadata } from "next"
import Link from "next/link"
import { CalendarClock } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { ScheduleSlotActions, ScheduleSlotDialog } from "@/components/admin/schedule-slot-form"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ScheduleSlotRow } from "@/lib/data/schedule"
import { getScheduleForAdmin } from "@/lib/dal"
import { CLASS_COLOR_BG } from "@/lib/sessions"
import { cn } from "@/lib/utils"
import { WEEKDAYS } from "@/lib/validation/schedule"

export const metadata: Metadata = { title: "Horario" }

// SPEC F3: plantilla semanal. Cada franja crea sus sesiones de las próximas 4 semanas (y el cron, cada día)
export default async function HorarioPage() {
  const { slots, classTypes, coaches } = await getScheduleForAdmin()
  const options = { classTypes, coaches }
  const canCreate = classTypes.some((t) => t.isActive)
  const days = WEEKDAYS.map((name, weekday) => ({ name, slots: slots.filter((s) => s.weekday === weekday) })).filter(
    (day) => day.slots.length > 0,
  )

  return (
    <Page title="Horario" backHref="/admin/mas" wide actions={canCreate ? <ScheduleSlotDialog {...options} /> : null}>
      {!canCreate && slots.length === 0 ? (
        <EmptyState
          icon={<CalendarClock />}
          title="Primero, los tipos de clase"
          description="Para montar el horario necesitas al menos un tipo de clase activo."
          action={
            <Button asChild variant="outline">
              <Link href="/admin/tipos-clase">Ir a tipos de clase</Link>
            </Button>
          }
        />
      ) : days.length === 0 ? (
        <EmptyState
          icon={<CalendarClock />}
          title="El horario está vacío"
          description="Añade las clases que se repiten cada semana. Las sesiones se crean solas con 4 semanas de antelación."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.name} aria-labelledby={`dia-${day.name}`} className="flex flex-col gap-2">
              <h2 id={`dia-${day.name}`} className="text-sm font-semibold text-muted-foreground">
                {day.name}
              </h2>
              <ul className="grid gap-2 lg:grid-cols-2">
                {day.slots.map((slot) => (
                  <li
                    key={slot.id}
                    className="relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 pl-5 sm:flex-row sm:items-center"
                  >
                    <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", CLASS_COLOR_BG[slot.color])} />
                    <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", !slot.isActive && "opacity-60")}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium tabular-nums">{timeRange(slot)}</span>
                        <span className="truncate font-medium">{slot.className}</span>
                        {slot.isActive ? null : <Badge variant="outline">Inactiva</Badge>}
                        {slot.classTypeActive ? null : <Badge variant="outline">Tipo inactivo</Badge>}
                      </span>
                      <span className="text-sm text-muted-foreground">{summary(slot)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ScheduleSlotDialog slot={slot} {...options} />
                      <ScheduleSlotActions slot={slot} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  )
}

/** "09:00 – 10:00" */
function timeRange(slot: ScheduleSlotRow) {
  const [h, m] = slot.startTime.split(":").map(Number)
  const end = (h * 60 + m + slot.durationMinutes) % (24 * 60)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${slot.startTime} – ${pad(Math.floor(end / 60))}:${pad(end % 60)}`
}

function summary(slot: ScheduleSlotRow) {
  const places = slot.kind === "individual" ? "Individual" : `${slot.capacity} plazas`
  return `${places} · ${slot.coachName ?? "Sin entrenador"}`
}
