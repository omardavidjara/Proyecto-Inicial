"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ProtoAttendee } from "@/lib/prototype/data"

type Attendance = ProtoAttendee["attendance"]

/** PROTOTIPO: marcar asistencia (F7). En la Fase 5 cada cambio será una Server Action. */
export function AttendanceList({ attendees, canMark }: { attendees: ProtoAttendee[]; canMark: boolean }) {
  const [marks, setMarks] = useState<Record<string, Attendance>>(() =>
    Object.fromEntries(attendees.map((a) => [a.id, a.attendance]))
  )

  function mark(attendee: ProtoAttendee, value: Attendance) {
    const next = marks[attendee.id] === value ? "pending" : value
    setMarks((current) => ({ ...current, [attendee.id]: next }))
    if (next !== "pending") toast.success(`${attendee.name}: ${next === "attended" ? "asistió" : "faltó"}`)
  }

  const attended = Object.values(marks).filter((m) => m === "attended").length

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {canMark ? `${attended} de ${attendees.length} marcados como presentes` : "Podrás marcar la asistencia cuando empiece la clase"}
      </p>
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {attendees.map((a) => (
          <li key={a.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
              {a.name.charAt(0)}
            </span>
            <span className="flex-1 font-medium">{a.name}</span>
            {canMark && (
              <div className="flex gap-1" role="group" aria-label={`Asistencia de ${a.name}`}>
                <MarkButton active={marks[a.id] === "attended"} tone="success" label="Asistió" onClick={() => mark(a, "attended")}>
                  <Check />
                </MarkButton>
                <MarkButton active={marks[a.id] === "no_show"} tone="destructive" label="Faltó" onClick={() => mark(a, "no_show")}>
                  <X />
                </MarkButton>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MarkButton({ active, tone, label, onClick, children }: {
  active: boolean
  tone: "success" | "destructive"
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-11 items-center justify-center rounded-lg border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5",
        !active && "text-muted-foreground hover:bg-muted active:bg-muted/70",
        active && tone === "success" && "border-success bg-success/15 text-success",
        active && tone === "destructive" && "border-destructive bg-destructive/15 text-destructive"
      )}
    >
      {children}
    </button>
  )
}
