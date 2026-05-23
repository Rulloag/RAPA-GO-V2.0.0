import { db } from "../../db/client.js";
import { rideRequests, users, driverStatuses, userDocuments, serviceBookings, rentalBookings } from "../../db/schema/index.js";
import { sql, eq, and, gte, lte, inArray, count } from "drizzle-orm";

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export interface RideStats {
  total: number;
  completed: number;
  cancelled: number;
  pending: number;
  inProgress: number;
}

export interface WeekRideStats {
  total: number;
  completed: number;
  cancelled: number;
}

export interface TopDriver {
  driverId: string;
  name: string;
  trips: number;
  revenue: number;
}

export interface OperationalStats {
  activeDrivers: number;
  busyDrivers: number;
  unavailableDrivers: number;
  pendingDocuments: number;
  pendingOfflineBookings: number;
  pendingServiceBookings: number;
  pendingRentalBookings: number;
}

export interface ActivityItem {
  type: "ride" | "booking" | "document";
  description: string;
  userName: string;
  timestamp: string;
  status?: string;
}

export async function getTodayRideStats(): Promise<RideStats> {
  const { start, end } = todayRange();
  const rows = await db
    .select({
      total:      sql<number>`count(*)::int`,
      completed:  sql<number>`count(*) filter (where ${rideRequests.status} = 'completed')::int`,
      cancelled:  sql<number>`count(*) filter (where ${rideRequests.status} = 'cancelled')::int`,
      pending:    sql<number>`count(*) filter (where ${rideRequests.status} = 'requested')::int`,
      inProgress: sql<number>`count(*) filter (where ${rideRequests.status} in ('accepted','driver_en_route','driver_arrived','in_progress'))::int`,
    })
    .from(rideRequests)
    .where(and(gte(rideRequests.requestedAt, start), lte(rideRequests.requestedAt, end)));

  const row = rows[0];
  return {
    total:      row?.total      ?? 0,
    completed:  row?.completed  ?? 0,
    cancelled:  row?.cancelled  ?? 0,
    pending:    row?.pending    ?? 0,
    inProgress: row?.inProgress ?? 0,
  };
}

export async function getTodayRevenue(): Promise<number> {
  const { start, end } = todayRange();
  const rows = await db
    .select({ revenue: sql<number>`coalesce(sum(${rideRequests.estimatedFareClp}), 0)::int` })
    .from(rideRequests)
    .where(and(
      eq(rideRequests.status, "completed"),
      gte(rideRequests.completedAt, start),
      lte(rideRequests.completedAt, end),
    ));
  return rows[0]?.revenue ?? 0;
}

export async function getTodayNewUsers(): Promise<number> {
  const { start, end } = todayRange();
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(and(gte(users.createdAt, start), lte(users.createdAt, end)));
  return rows[0]?.total ?? 0;
}

export async function getWeekRideStats(): Promise<WeekRideStats> {
  const { start, end } = weekRange();
  const rows = await db
    .select({
      total:     sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${rideRequests.status} = 'completed')::int`,
      cancelled: sql<number>`count(*) filter (where ${rideRequests.status} = 'cancelled')::int`,
    })
    .from(rideRequests)
    .where(and(gte(rideRequests.requestedAt, start), lte(rideRequests.requestedAt, end)));

  const row = rows[0];
  return {
    total:     row?.total     ?? 0,
    completed: row?.completed ?? 0,
    cancelled: row?.cancelled ?? 0,
  };
}

export async function getWeekRevenue(): Promise<number> {
  const { start, end } = weekRange();
  const rows = await db
    .select({ revenue: sql<number>`coalesce(sum(${rideRequests.estimatedFareClp}), 0)::int` })
    .from(rideRequests)
    .where(and(
      eq(rideRequests.status, "completed"),
      gte(rideRequests.completedAt, start),
      lte(rideRequests.completedAt, end),
    ));
  return rows[0]?.revenue ?? 0;
}

export async function getTopDriversThisWeek(): Promise<TopDriver[]> {
  const { start, end } = weekRange();
  const rows = await db
    .select({
      driverId: rideRequests.driverUserId,
      name:     users.name,
      trips:    sql<number>`count(*)::int`,
      revenue:  sql<number>`coalesce(sum(${rideRequests.estimatedFareClp}), 0)::int`,
    })
    .from(rideRequests)
    .innerJoin(users, eq(rideRequests.driverUserId, users.id))
    .where(and(
      eq(rideRequests.status, "completed"),
      gte(rideRequests.completedAt, start),
      lte(rideRequests.completedAt, end),
    ))
    .groupBy(rideRequests.driverUserId, users.name)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  return rows
    .filter((r): r is typeof r & { driverId: string } => r.driverId !== null)
    .map((r) => ({
      driverId: r.driverId,
      name:     r.name,
      trips:    r.trips,
      revenue:  r.revenue,
    }));
}

export async function getOperationalStats(): Promise<OperationalStats> {
  const driverRows = await db
    .select({
      availability: driverStatuses.availability,
      total: sql<number>`count(*)::int`,
    })
    .from(driverStatuses)
    .groupBy(driverStatuses.availability);

  let activeDrivers = 0;
  let busyDrivers = 0;
  let unavailableDrivers = 0;
  for (const row of driverRows) {
    if (row.availability === "available") activeDrivers = row.total;
    else if (row.availability === "busy") busyDrivers = row.total;
    else unavailableDrivers += row.total;
  }

  let pendingDocuments = 0;
  try {
    const docRows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(userDocuments)
      .where(eq(userDocuments.status, "pending"));
    pendingDocuments = docRows[0]?.total ?? 0;
  } catch {
    pendingDocuments = 0;
  }

  const offlineRows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(rideRequests)
    .where(and(eq(rideRequests.isOfflineBooking, true), eq(rideRequests.status, "requested")));
  const pendingOfflineBookings = offlineRows[0]?.total ?? 0;

  let pendingServiceBookings = 0;
  try {
    const svcRows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(serviceBookings)
      .where(eq(serviceBookings.status, "pending"));
    pendingServiceBookings = svcRows[0]?.total ?? 0;
  } catch {
    pendingServiceBookings = 0;
  }

  let pendingRentalBookings = 0;
  try {
    const rentalRows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(rentalBookings)
      .where(eq(rentalBookings.status, "pending"));
    pendingRentalBookings = rentalRows[0]?.total ?? 0;
  } catch {
    pendingRentalBookings = 0;
  }

  return {
    activeDrivers,
    busyDrivers,
    unavailableDrivers,
    pendingDocuments,
    pendingOfflineBookings,
    pendingServiceBookings,
    pendingRentalBookings,
  };
}

export async function getRecentActivity(limit: number): Promise<ActivityItem[]> {
  const rows = await db
    .select({
      id:              rideRequests.id,
      originText:      rideRequests.originText,
      destinationText: rideRequests.destinationText,
      status:          rideRequests.status,
      requestedAt:     rideRequests.requestedAt,
      completedAt:     rideRequests.completedAt,
      userName:        users.name,
    })
    .from(rideRequests)
    .innerJoin(users, eq(rideRequests.passengerUserId, users.id))
    .orderBy(sql`${rideRequests.requestedAt} desc`)
    .limit(limit);

  return rows.map((r) => {
    const isCompleted = r.status === "completed";
    const description = isCompleted
      ? `Viaje completado: ${r.originText} → ${r.destinationText}`
      : `Nuevo viaje solicitado: ${r.originText} → ${r.destinationText}`;
    const timestamp = (isCompleted && r.completedAt ? r.completedAt : r.requestedAt).toISOString();
    return {
      type: "ride" as const,
      description,
      userName: r.userName,
      timestamp,
      status: r.status,
    };
  });
}

export interface AlertItem {
  type: "warning" | "critical";
  message: string;
  action?: string;
}

export function generateAlerts(ops: OperationalStats): AlertItem[] {
  const alerts: AlertItem[] = [];

  if (ops.activeDrivers === 0) {
    alerts.push({ type: "critical", message: "No hay conductores disponibles en este momento.", action: "Revisar conductores" });
  } else if (ops.activeDrivers < 2) {
    alerts.push({ type: "warning", message: `Solo ${ops.activeDrivers} conductor disponible.`, action: "Revisar conductores" });
  }

  if (ops.pendingDocuments > 0) {
    alerts.push({ type: "warning", message: `${ops.pendingDocuments} documento(s) pendiente(s) de revisión.`, action: "Revisar documentos" });
  }

  if (ops.pendingOfflineBookings > 5) {
    alerts.push({ type: "warning", message: `${ops.pendingOfflineBookings} reservas offline sin sincronizar.`, action: "Gestionar offline" });
  }

  if (ops.pendingServiceBookings > 10) {
    alerts.push({ type: "warning", message: `${ops.pendingServiceBookings} reservas de servicios pendientes.` });
  }

  if (ops.pendingRentalBookings > 10) {
    alerts.push({ type: "warning", message: `${ops.pendingRentalBookings} reservas de arriendo pendientes.` });
  }

  return alerts;
}
