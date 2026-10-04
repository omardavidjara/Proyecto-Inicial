import Link from "next/link"
import { cn } from "@/lib/utils"
import { formatDayNumber, formatWeekdayShort, formatDayLong } from "@/lib/dates"

/** Selector de día horizontal: cada día es un enlace a ?fecha=AAAA-MM-DD */
export function DayPicker({ days, selected, hrefFor }: {
  days: string[]
  selected: string
  hrefFor: (day: string) => string
}) {
  return (
    <nav aria-label="Elegir día" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {days.map((day) => {
          const active = day === selected
          return (
            <li key={day} className="flex-1">
              <Link
                href={hrefFor(day)}
                aria-current={active ? "date" : undefined}
                aria-label={formatDayLong(day)}
                className={cn(
                  "flex h-16 min-w-12 flex-col items-center justify-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70 active:bg-muted/50"
                )}
              >
                <span className={cn("text-xs capitalize", !active && "text-muted-foreground")}>
                  {formatWeekdayShort(day)}
                </span>
                <span className="text-lg font-semibold tabular-nums">{formatDayNumber(day)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
