import type { Metadata } from "next"
import Link from "next/link"
import { Bell, CalendarPlus } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { AnnouncementCards } from "@/components/announcements/announcement-list"
import { InstallLink } from "@/components/pwa/install-link"
import { PlanSummaryTiles } from "@/components/sessions/plan-summary"
import { NextClassHero } from "@/components/sessions/next-class-hero"
import { Button } from "@/components/ui/button"
import { getBookingSettings, getLatestAnnouncements, getMyFirstName, getMyNextBooking, getMyPlanSummary, hasUnreadAnnouncements } from "@/lib/dal"
import { toAnnouncementEntry } from "@/lib/announcements"
import { formatDayLabel, formatStartsIn, toDateKey, toTimeKey } from "@/lib/dates"

export const metadata: Metadata = { title: "Inicio" }

const LATEST_ANNOUNCEMENTS = 3

export default async function ClientHomePage() {
  const [name, next, plan, settings, latest, unread] = await Promise.all([
    getMyFirstName(),
    getMyNextBooking(),
    getMyPlanSummary(),
    getBookingSettings(),
    getLatestAnnouncements(LATEST_ANNOUNCEMENTS),
    hasUnreadAnnouncements(),
  ])
  const { timeZone } = settings
  const now = new Date()
  const today = toDateKey(now, timeZone)

  return (
    <Page
      title={name ? `Hola, ${name}` : "Hola"}
      actions={
        <Link
          href="/avisos"
          aria-label={unread ? "Avisos, hay avisos sin leer" : "Avisos"}
          className="relative -mr-3 flex size-11 items-center justify-center rounded-lg outline-none hover:bg-muted active:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="size-6" aria-hidden="true" />
          {unread && <span aria-hidden="true" className="absolute top-2 right-2 size-2.5 rounded-full bg-primary ring-2 ring-background" />}
        </Link>
      }
    >
      <NextClassHero
        next={
          next && {
            href: `/calendario/${next.sessionId}`,
            dayLabel: formatDayLabel(toDateKey(next.startsAt, timeZone), today),
            start: toTimeKey(next.startsAt, timeZone),
            end: toTimeKey(next.endsAt, timeZone),
            className: next.className,
            color: next.color,
            coachName: next.coachName,
            startsIn: formatStartsIn(next.startsAt, now),
            soon: next.startsAt.getTime() - now.getTime() < 60 * 60_000,
          }
        }
      />

      <PlanSummaryTiles summary={plan} />

      <Button asChild size="lg" className="w-full">
        <Link href="/calendario">
          <CalendarPlus data-icon="inline-start" aria-hidden="true" />
          Reservar clase
        </Link>
      </Button>

      <Link href="/reservas" className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-primary">
        Ver mis reservas
      </Link>

      {latest.length > 0 && (
        <section aria-labelledby="ultimos-avisos" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="ultimos-avisos" className="font-semibold">
              Últimos avisos
            </h2>
            <Link href="/avisos" className="inline-flex min-h-11 items-center text-sm font-medium text-primary">
              Ver todos
            </Link>
          </div>
          <AnnouncementCards items={latest.map((item) => toAnnouncementEntry(item, timeZone))} />
        </section>
      )}

      <InstallLink />
    </Page>
  )
}
