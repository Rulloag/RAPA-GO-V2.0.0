import { generateWhatsAppLink } from "@rapa-go/shared";
import { NotificationsRepository } from "./notifications.repository.js";

const notifRepo = new NotificationsRepository();

export function notifyAsync(data: {
  userId: string;
  type: string;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  expiresAt?: Date;
  waMeUrl?: string;
}): void {
  notifRepo.create(data).catch(() => {});
}

export function notifyGuideNewBooking(p: {
  guideUserId: string;
  guidePhone: string | null;
  serviceTitle: string;
  bookingId: string;
  passengerName: string;
  bookingDate: string;
  expiresAt: Date;
}): void {
  const waMeUrl = p.guidePhone
    ? generateWhatsAppLink(p.guidePhone, `Nueva reserva en Rapa Go: ${p.serviceTitle} para ${p.passengerName} el ${p.bookingDate}. Confirma en la app.`)
    : undefined;

  notifyAsync({
    userId: p.guideUserId,
    type: "service_booking_new",
    title: "Nueva reserva recibida",
    message: `${p.passengerName} reservó "${p.serviceTitle}" para el ${p.bookingDate}`,
    entityType: "service_booking",
    entityId: p.bookingId,
    expiresAt: p.expiresAt,
    ...(waMeUrl ? { waMeUrl } : {}),
  });
}

export function notifyPassengerDriverAssigned(p: {
  passengerUserId: string;
  driverName: string;
  driverPhone: string | null;
  rideId: string;
  origin: string;
  destination: string;
}): void {
  const waMeUrl = p.driverPhone
    ? generateWhatsAppLink(p.driverPhone, `Hola, soy tu conductor en Rapa Go para el viaje de ${p.origin} a ${p.destination}.`)
    : undefined;

  notifyAsync({
    userId: p.passengerUserId,
    type: "ride_driver_assigned",
    title: "Conductor asignado",
    message: `${p.driverName} fue asignado a tu viaje`,
    entityType: "ride_request",
    entityId: p.rideId,
    ...(waMeUrl ? { waMeUrl } : {}),
  });
}

export function notifyDriverRideAssigned(p: {
  driverUserId: string;
  passengerName: string;
  rideId: string;
  origin: string;
  destination: string;
}): void {
  notifyAsync({
    userId: p.driverUserId,
    type: "ride_assigned",
    title: "Nuevo viaje asignado",
    message: `Viaje de ${p.origin} a ${p.destination}`,
    entityType: "ride_request",
    entityId: p.rideId,
  });
}

export function notifyOperatorNewRentalBooking(p: {
  operatorUserId: string;
  operatorPhone: string | null;
  vehicleName: string;
  bookingId: string;
  passengerName: string;
  startDate: string;
  endDate: string;
}): void {
  const waMeUrl = p.operatorPhone
    ? generateWhatsAppLink(p.operatorPhone, `Nueva reserva de arriendo en Rapa Go: ${p.vehicleName} para ${p.passengerName} del ${p.startDate} al ${p.endDate}.`)
    : undefined;

  notifyAsync({
    userId: p.operatorUserId,
    type: "rental_booking_new",
    title: "Nueva reserva de arriendo",
    message: `${p.passengerName} reservó "${p.vehicleName}" del ${p.startDate} al ${p.endDate}`,
    entityType: "rental_booking",
    entityId: p.bookingId,
    ...(waMeUrl ? { waMeUrl } : {}),
  });
}

export function notifyPassengerBookingConfirmed(p: {
  passengerUserId: string;
  serviceTitle: string;
  bookingId: string;
  bookingDate: string;
}): void {
  notifyAsync({
    userId: p.passengerUserId,
    type: "service_booking_confirmed",
    title: "Reserva confirmada",
    message: `Tu reserva para "${p.serviceTitle}" el ${p.bookingDate} fue confirmada`,
    entityType: "service_booking",
    entityId: p.bookingId,
  });
}

export function notifyPassengerRentalConfirmed(p: {
  passengerUserId: string;
  vehicleName: string;
  bookingId: string;
  startDate: string;
}): void {
  notifyAsync({
    userId: p.passengerUserId,
    type: "rental_booking_confirmed",
    title: "Arriendo confirmado",
    message: `Tu arriendo de "${p.vehicleName}" fue confirmado para el ${p.startDate}`,
    entityType: "rental_booking",
    entityId: p.bookingId,
  });
}

export function notifyPassengerDriverEnRoute(p: {
  passengerUserId: string;
  driverName: string;
  rideId: string;
}): void {
  notifyAsync({
    userId: p.passengerUserId,
    type: "ride_driver_en_route",
    title: "Conductor en camino",
    message: `${p.driverName} está en camino hacia ti`,
    entityType: "ride_request",
    entityId: p.rideId,
  });
}

export function notifyPassengerDriverArrived(p: {
  passengerUserId: string;
  driverName: string;
  rideId: string;
}): void {
  notifyAsync({
    userId: p.passengerUserId,
    type: "ride_driver_arrived",
    title: "Conductor ha llegado",
    message: `${p.driverName} está esperándote`,
    entityType: "ride_request",
    entityId: p.rideId,
  });
}

export function notifyPassengerRideCompleted(p: {
  passengerUserId: string;
  rideId: string;
  origin: string;
  destination: string;
}): void {
  notifyAsync({
    userId: p.passengerUserId,
    type: "ride_completed",
    title: "Viaje completado",
    message: `Viaje de ${p.origin} a ${p.destination} completado`,
    entityType: "ride_request",
    entityId: p.rideId,
  });
}

export function notifyGuideCancellation(p: {
  guideUserId: string;
  serviceTitle: string;
  bookingId: string;
  passengerName: string;
}): void {
  notifyAsync({
    userId: p.guideUserId,
    type: "service_booking_cancelled",
    title: "Reserva cancelada",
    message: `${p.passengerName} canceló su reserva para "${p.serviceTitle}"`,
    entityType: "service_booking",
    entityId: p.bookingId,
  });
}

export function notifyAdminNewDocument(p: {
  adminUserId: string;
  driverName: string;
  documentId: string;
}): void {
  notifyAsync({
    userId: p.adminUserId,
    type: "document_pending",
    title: "Documento pendiente de revisión",
    message: `${p.driverName} envió un nuevo documento para revisar`,
    entityType: "driver_document",
    entityId: p.documentId,
  });
}
