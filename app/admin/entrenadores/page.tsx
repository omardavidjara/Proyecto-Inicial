import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Page } from "@/components/app-shell/app-shell"
import { CoachPeriodNav } from "@/components/coach/coach-calendar"
import { CoachViewTabs, coachPeriodHref } from "@/components/coach/taught-summary"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCoachesOverview } from "@/lib/dal"

export const metadata: Metadata = { title: "Entrenadores" }

const BASE = "/admin/entrenadores"

// SPEC F7: cada entrenador con sus clases impartidas, programadas y canceladas en la semana o el mes. Solo consulta
export default async function CoachesPage({ searchParams }: PageProps<"/admin/entrenadores">) {
  await connection() // «impartida» depende de la hora actual
  const { today, view, date, range, coaches } = await getCoachesOverview(await searchParams)

  return (
    <Page title="Entrenadores" backHref="/admin/mas" wide>
      <CoachViewTabs view={view} date={date} base={BASE} />
      <CoachPeriodNav view={view} date={date} today={today} range={range} base={BASE} />
      {coaches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay entrenadores activos. Se marcan con <code>npm run db:set-role</code>.
        </p>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Entrenador</TableHead>
                <TableHead className="text-right">Impartidas</TableHead>
                <TableHead className="text-right">Programadas</TableHead>
                <TableHead className="pr-4 text-right">Canceladas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coaches.map((c) => (
                <TableRow key={c.userId} className="relative h-14 focus-within:bg-muted/50">
                  <TableCell className="pl-4 font-medium">
                    {/* El enlace cubre toda la fila (after:absolute) */}
                    <Link href={coachPeriodHref(view, date, `${BASE}/${c.userId}`)} className="outline-none after:absolute after:inset-0">
                      {c.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.summary.taught}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.summary.scheduled}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{c.summary.cancelled}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Page>
  )
}
