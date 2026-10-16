import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Athlos Centro Deportivo",
    short_name: "Athlos",
    description: "Reserva tus clases en Athlos Centro Deportivo.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Android pinta con estos colores la barra de gestos y la pantalla de carga de la app instalada, y el
    // manifest no admite variante clara/oscura: con blanco salía una franja blanca bajo la barra inferior en
    // modo oscuro. El fondo oscuro de la app queda bien en los dos modos (docs/DESIGN.md §5)
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
