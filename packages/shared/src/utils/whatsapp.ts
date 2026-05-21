export function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!/^\d{10,}$/.test(cleaned)) {
    cleaned = `56${cleaned}`;
  }
  return cleaned;
}

export function generateWhatsAppLink(phone: string, message: string): string {
  const number  = formatPhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${encoded}`;
}

export const WA_MESSAGES = {
  passengerToAdmin: (params: { origin: string; destination: string; name: string }) =>
    `Hola, necesito un viaje en Rapa Go. Mi ubicación: ${params.origin}. Destino: ${params.destination}. Nombre: ${params.name}.`,

  adminToDriver: (params: { driverName: string; origin: string; destination: string; passengerName: string; passengerPhone: string }) =>
    `Hola ${params.driverName}, tienes un nuevo viaje asignado. Origen: ${params.origin}. Destino: ${params.destination}. Pasajero: ${params.passengerName}. Tel: ${params.passengerPhone}.`,

  driverToPassenger: (params: { passengerName: string; driverName: string; origin: string }) =>
    `Hola ${params.passengerName}, soy ${params.driverName}, su conductor de Rapa Go. Voy en camino a ${params.origin}.`,

  passengerToDriver: (params: { driverName: string; passengerName: string; origin: string }) =>
    `Hola ${params.driverName}, soy ${params.passengerName}. Estoy esperando en ${params.origin}.`,

  adminToOfflinePassenger: (params: { passengerName: string }) =>
    `Hola ${params.passengerName}, confirmamos su reserva telefónica con Rapa Go. Le avisaremos cuando su conductor esté en camino.`,
} as const;
