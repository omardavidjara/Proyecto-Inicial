import {
  Bell,
  CalendarDays,
  CalendarRange,
  House,
  Menu,
  Ticket,
  TriangleAlert,
  User,
  Users,
} from "lucide-react"
import type { NavItem } from "./bottom-nav"

// docs/SPEC.md §4: navegación de cada rol
export const clientNav: NavItem[] = [
  { href: "/calendario", label: "Calendario", icon: <CalendarDays /> },
  { href: "/reservas", label: "Mis reservas", icon: <Ticket /> },
  { href: "/avisos", label: "Avisos", icon: <Bell /> },
  { href: "/perfil", label: "Perfil", icon: <User /> },
]

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Hoy", icon: <House />, exact: true },
  { href: "/admin/agenda", label: "Agenda", icon: <CalendarRange /> },
  { href: "/admin/clientes", label: "Clientes", icon: <Users /> },
  { href: "/admin/incidencias", label: "Incidencias", icon: <TriangleAlert /> },
  { href: "/admin/mas", label: "Más", icon: <Menu /> },
]
