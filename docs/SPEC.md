# Especificación · Athlos App

> Nombre provisional. Estado: **aprobado** por el usuario el 2026-10-02 (cierre de la Fase 1). Cualquier cambio posterior se anota aquí y en `docs/ARCHITECTURE.md`.

## 1. Qué es

App web y móvil para **reservar y gestionar las clases y sesiones de un gimnasio de entrenamiento funcional**. Sustituye la tabla en papel / Excel con la que hoy se organizan las clases.

- **Clientes**: ven el calendario y reservan, cambian o anulan sus clases desde el móvil.
- **Administradores**: tienen organizadas las sesiones del día, la semana y el mes, gestionan altas y bajas de clientes y abren incidencias.
- **Entrenadores**: ven sus clases y la lista de asistentes.

Referencia de funcionamiento: **Wodbuster**.

Alcance: **un solo gimnasio** (sin multi-gimnasio), aunque el diseño no debe impedir ampliarlo en el futuro. Idioma: español. Zona horaria: la del gimnasio (por defecto `Europe/Madrid`).

## 2. Usuarios y roles

| Rol | Quién es | Qué ve y hace |
|---|---|---|
| **Desarrollador** | El propietario técnico (Omar) | Superadministrador: todo lo del administrador + crear/quitar administradores y entrenadores + ajustes técnicos. |
| **Administrador** | Gerencia / recepción del gimnasio | Gestiona clases, horario, sesiones, clientes, tarifas, incidencias y avisos. Puede cambiar a la **vista cliente** (y reservar como un cliente más). |
| **Entrenador** | Coach del gimnasio | Ve las sesiones que imparte y su **lista de asistentes**; marca asistencia en sus sesiones; crea sesiones individuales para sus clientes y abre incidencias. No gestiona clientes, tarifas ni el horario. |
| **Cliente** | Socio del gimnasio | Ve el calendario, reserva / cambia / anula sus clases, ve su tarifa y clases restantes, recibe avisos. Solo ve sus propios datos. |

**Entrenadores**: hay dos casos.
- **Entrenador que no es administrador**: tiene el rol *Entrenador* y solo ve lo descrito arriba.
- **Administrador (o desarrollador) que también entrena**: conserva su rol y tiene además la **marca de entrenador**, que le da la sección "Mis clases" y le permite impartir sesiones.

Un cliente que pasa a ser entrenador cambia su rol a *Entrenador*.

Cada usuario ve solo lo suyo. Un cliente nunca ve datos de otros clientes (en una clase puede ver cuántas plazas quedan, no quién va).

## 3. Funcionalidades

Orden = prioridad de implementación en la Fase 5 (cada una es una rama).

### F1. Registro, alta y perfil
- El cliente se registra (correo + contraseña o Google) y queda **pendiente de aprobación**.
- Mientras está pendiente, solo ve una pantalla "Tu alta está pendiente de aprobación".
- El administrador aprueba (y le asigna tarifa) o rechaza la solicitud. Rechazar deja la cuenta **de baja** (no se borra, para no permitir registros repetidos sin control).
- Perfil: nombre, teléfono, foto (cámara o galería). El cliente edita su perfil.
- **Baja**: el administrador da de baja a un cliente → no puede reservar; se anulan sus reservas futuras (sin descontar) y se liberan sus plazas; sus datos históricos se conservan. Puede reactivarse.
- **Eliminar mi cuenta**: cualquier usuario puede pedir desde su perfil que se elimine su cuenta. Se borra el acceso y se **anonimizan** sus datos personales (nombre, teléfono, foto); el historial de reservas queda sin datos personales para las estadísticas. Es obligatorio para publicar en la App Store y lo exige el RGPD.

### F2. Tipos de clase
- El administrador crea tipos de clase: nombre, modalidad (**grupal** o **individual**), duración, aforo por defecto (individual = 1), color, activo/inactivo.

### F3. Horario y sesiones
- **Plantilla semanal**: franjas que se repiten (día de la semana, hora, tipo de clase, entrenador, aforo).
- A partir de la plantilla se generan las **sesiones** concretas con 4 semanas de antelación.
- Cambiar la plantilla afecta a las sesiones futuras que aún no tienen cambios manuales ni reservas; las demás se ajustan desde la agenda.
- El administrador puede crear sesiones sueltas, moverlas, cambiar entrenador/aforo o **cancelarlas** (p. ej. festivos). Cancelar una sesión anula sus reservas y avisa a los afectados.

### F4. Tarifas
- El administrador define tarifas: nombre y límite (**N clases por semana**, **N clases por mes** o **ilimitada**).
- Cada cliente activo tiene una tarifa vigente (con historial de cambios).
- El cobro se hace **fuera de la app** por ahora.

### F5. Calendario y reservas (cliente)
- Calendario por días con las sesiones, plazas libres y estado de la reserva propia.
- **Reservar**: solo si la sesión está abierta, hay plaza, el cliente tiene una **tarifa vigente** y le quedan clases en el periodo.
- **Modificar**: cambiar una reserva a otra sesión (= anular + reservar, en una sola acción).
- **Anular**: libera la plaza.
- "Mis reservas": próximas e historial, y clases restantes del periodo.

Reglas (configurables por el administrador; los periodos de las tarifas se cuentan en la zona horaria del gimnasio):
| Regla | Valor por defecto |
|---|---|
| Apertura de reservas | 7 días antes de la sesión |
| Anulación sin penalización | hasta 2 horas antes |
| Anulación tardía (menos de 2 h) | Se permite y queda **marcada como tardía**. El administrador decide si se descuenta la clase de la tarifa o no. Hasta que decida, no se descuenta. La plaza se libera igualmente |
| Falta sin avisar | la clase **cuenta** como consumida en la tarifa |
| Lista de espera | Sí. Si se libera plaza (anulación o aumento de aforo), entra automáticamente el primero de la lista cuya tarifa lo permita y se le notifica. Al empezar la sesión, la lista de espera caduca |
| Cierre de reservas | al empezar la sesión |

### F6. Agenda del administrador
- Vistas **día / semana / mes** con todas las sesiones, ocupación (p. ej. 8/12) y lista de espera.
- Detalle de sesión: asistentes, lista de espera, anulaciones tardías, añadir o quitar un cliente a mano (saltándose límites si hace falta), marcar asistencia.
- **Anulaciones tardías pendientes**: lista con las anulaciones tardías sin decidir; por cada una, "Descontar clase" o "No descontar".

### F7. Entrenadores
- "Mis clases": sesiones que imparte hoy y próximas.
- Lista de asistentes de cada sesión y marcar asistencia / falta.
- Crear una **sesión individual** que imparte él mismo y apuntar en ella a un cliente.
- Abrir incidencias.

### F8. Gestión de clientes
- Lista con búsqueda y filtros (pendientes, activos, de baja).
- Ficha de cliente: datos, tarifa, reservas, asistencia, incidencias asociadas.
- Altas, bajas, reactivaciones y cambio de tarifa.

### F9. Incidencias
- La abre un administrador (o entrenador). Título, descripción, prioridad, y opcionalmente asociada a un **cliente** o a una **sesión**.
- Estados: **abierta → en curso → cerrada**.
- Solo las ven administradores (y el entrenador que la abrió).

### F10. Avisos y notificaciones
- El administrador publica **avisos generales** del gimnasio (se ven en la app y llegan como push).
- Notificaciones push automáticas:
  - Recordatorio de clase (por defecto 2 h antes)
  - Plaza conseguida desde la lista de espera
  - Sesión cancelada por el gimnasio
  - Alta aprobada

### F11. Gestión del equipo (solo desarrollador)
- Cambiar el rol de un usuario (cliente, entrenador, administrador) y poner o quitar la marca de entrenador a un administrador.
- Ajustes técnicos del gimnasio: nombre y zona horaria. (Las **reglas de reserva** las ajusta el administrador.)

## 4. Pantallas

**Comunes**: Inicio de sesión · Registro · Alta pendiente · Perfil.

**Cliente** (navegación inferior: Calendario · Mis reservas · Avisos · Perfil)
- Calendario (selector de día + lista de sesiones)
- Detalle de sesión (reservar / anular / lista de espera)
- Mis reservas (próximas, historial, clases restantes)
- Avisos

**Entrenador**
- Mis clases · Detalle de sesión con asistentes

**Administrador** (navegación: Hoy · Agenda · Clientes · Incidencias · Más)
- Hoy (sesiones del día con ocupación y anulaciones tardías pendientes)
- Mis clases (si también es entrenador)
- Agenda (día / semana / mes) · Detalle de sesión
- Horario (plantilla semanal) · Tipos de clase
- Clientes · Ficha de cliente · Altas pendientes
- Tarifas
- Incidencias · Detalle de incidencia
- Avisos
- Anulaciones tardías pendientes
- Ajustes (reglas de reserva)
- Cambiar a vista cliente

**Desarrollador**: lo anterior + Equipo (roles) + Ajustes técnicos.

## 5. Datos que se guardan

- **Usuarios** (Neon Auth) + perfil de la app: nombre, teléfono, foto, rol, estado (pendiente / activo / baja).
- **Tipos de clase**, **plantilla semanal** y **sesiones**.
- **Reservas**: estado (confirmada, en lista de espera, anulada, anulación tardía y si se descuenta) y asistencia (pendiente, asistió, faltó).
- **Tarifas** y su asignación a cada cliente (con historial).
- **Incidencias**.
- **Avisos**.
- **Dispositivos** para notificaciones push.
- **Ajustes del gimnasio** (reglas de reserva, zona horaria).

## 6. Móvil (alcance de la Fase 8)

| Necesidad | Decisión |
|---|---|
| Notificaciones push | **Sí** (ver F10) |
| Cámara / galería | **Sí**, para la foto de perfil |
| Uso sin conexión | **Sí, lectura**: ver mis próximas reservas sin conexión. Reservar requiere conexión |
| Entrada con QR en recepción | **Más adelante** (fuera del MVP) |
| Inicio de sesión | Correo + contraseña y Google; deep link para volver a la app tras el login |
| Requisitos de las tiendas | Política de privacidad publicada y **eliminación de cuenta** desde la app (F1) |

## 7. Fuera del alcance (por ahora)

- Cobros y pagos dentro de la app.
- Varios gimnasios.
- Check-in con QR.
- Registro de marcas / resultados de entrenamientos (WOD, RM).
- Chat entre usuarios.

## 8. Decisiones tomadas en la revisión

1. **Sesiones individuales**: ambas vías. El cliente puede reservar huecos individuales publicados y el administrador/entrenador puede crear una sesión directamente para un cliente. Una sesión individual es una sesión de aforo 1.
2. **Anulación tardía**: se marca como tardía y el administrador decide si se descuenta la clase.
3. **Incidencias**: un entrenador puede abrirlas.
4. **Tarifas mensuales**: cuentan por **mes natural** (las semanales, de lunes a domingo).
5. **Horario**: plantilla semanal + sesiones sueltas.
6. **Administradores entrenadores**: un administrador puede ser también entrenador; también hay entrenadores que no son administradores.

## 9. Historial de cambios

- 2026-10-02 · Versión inicial aprobada. Revisión final: entrenadores con y sin rol de administrador, sesiones individuales creadas por el entrenador, rechazo de alta = baja, eliminación de cuenta (App Store / RGPD), caducidad de la lista de espera, reglas de reserva para el administrador y ajustes técnicos para el desarrollador.
