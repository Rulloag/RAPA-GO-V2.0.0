import {
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
} from "@ionic/react";
import { globeOutline, shieldCheckmarkOutline } from "ionicons/icons";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

export type RapaGoLanguage = "es" | "en";

export const RAPAGO_LANGUAGE_STORAGE_KEY = "rapago_language";
export const RAPAGO_LANGUAGE_EVENT = "rapago:language-changed";

const LANGUAGE_STORAGE_KEYS = [
  RAPAGO_LANGUAGE_STORAGE_KEY,
  "rapago_lang",
  "rapago_profile_language_v1",
  "rapago_ui_language",
  "rapago_ui_language_v1",
  "rapago_selected_language",
  "rapago_app_language",
] as const;

function normalizeLanguage(value: unknown): RapaGoLanguage | null {
  const raw = String(value ?? "").toLowerCase().trim();
  if (raw === "en" || raw === "english" || raw === "us") return "en";
  if (raw === "es" || raw === "spanish" || raw === "cl") return "es";
  return null;
}

export function getRapaGoLanguage(): RapaGoLanguage {
  try {
    for (const key of LANGUAGE_STORAGE_KEYS) {
      const stored = normalizeLanguage(localStorage.getItem(key));
      if (stored) return stored;
    }
  } catch {
    // Mantiene español por defecto.
  }

  return "es";
}

export function setRapaGoLanguage(language: RapaGoLanguage): void {
  try {
    for (const key of LANGUAGE_STORAGE_KEYS) {
      localStorage.setItem(key, language);
    }
    sessionStorage.setItem(RAPAGO_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // No bloquea el cambio visual si storage falla.
  }

  applyRapaGoDocumentLanguage(language);

  window.dispatchEvent(
    new CustomEvent(RAPAGO_LANGUAGE_EVENT, {
      detail: { language },
    }),
  );

  try {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: RAPAGO_LANGUAGE_STORAGE_KEY,
        newValue: language,
      }),
    );
  } catch {
    // Algunos navegadores bloquean StorageEvent manual.
  }
}

function applyRapaGoDocumentLanguage(language: RapaGoLanguage): void {
  try {
    document.documentElement.lang = language === "en" ? "en" : "es-CL";
    document.documentElement.dir = "ltr";
    document.documentElement.dataset.rapagoLanguage = language;
  } catch {
    // No bloquea.
  }
}

function normalizeTextKey(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

const ES_TO_EN: Record<string, string> = {
  "Inicio": "Home",
  "inicio": "Home",
  "Mi Perfil": "My Profile",
  "Perfil": "Profile",
  "Viajes": "Trips",
  "viajes": "Trips",
  "Mis Viajes": "My Trips",
  "Servicios": "Services",
  "servicios": "Services",
  "Reservas": "Bookings",
  "reservas": "Bookings",
  "Mis Reservas": "My Bookings",
  "Eventos": "Events",
  "eventos": "Events",
  "Billetera": "Wallet",
  "billetera": "Wallet",
  "Ganancias": "Earnings",
  "Solicitudes": "Requests",
  "Solicitud": "Request",
  "Solicitar": "Request",
  "Solicitar Viaje": "Request Ride",
  "Solicitar viaje": "Request ride",
  "Solicitar ahora": "Request now",
  "Pedir viaje": "Request ride",
  "Viaje": "Ride",
  "Tours": "Tours",
  "Arriendo": "Rentals",
  "Vehículos": "Vehicles",
  "Vehículo": "Vehicle",
  "Reserva vehículo": "Book vehicle",
  "Arriendo en Rapa Nui": "Rentals in Rapa Nui",
  "Solicitar o agendar": "Request or schedule",
  "Servicios Rapa Go": "Rapa Go Services",
  "Servicios principales": "Main services",
  "Turismo local": "Local tourism",
  "Guías y tours pronto": "Guides and tours soon",
  "Próximamente": "Coming soon",
  "Cultura y panoramas": "Culture and activities",
  "Próximamente en Rapa Go": "Coming soon in Rapa Go",
  "Turismo": "Tourism",
  "Guías locales": "Local guides",
  "Estamos preparando perfiles de guías, rutas y experiencias turísticas aprobadas para Rapa Nui.": "We are preparing guide profiles, routes and approved tourism experiences for Rapa Nui.",
  "Actividades culturales": "Cultural activities",
  "Los eventos quedarán disponibles cuando el administrador publique experiencias y entradas oficiales.": "Events will be available when the administrator publishes official experiences and tickets.",
  "Saldo a favor": "Credit balance",
  "Si pagas de más o queda una diferencia, el administrador podrá revisarlo y dejarlo como saldo para próximos viajes si corresponde.": "If you overpay or there is a difference, the administrator can review it and leave it as credit for future rides if applicable.",
  "Guías locales próximamente": "Local guides coming soon",
  "Estamos preparando perfiles, rutas turísticas y experiencias aprobadas para Rapa Nui.": "We are preparing profiles, tourist routes and approved experiences for Rapa Nui.",
  "Saldo para próximos viajes": "Credit for future rides",
  "Si un pasajero paga de más o existe una diferencia, el administrador podrá revisar el caso y confirmar si ese monto queda como saldo para usar en viajes futuros.": "If a passenger overpays or there is a difference, the administrator can review the case and confirm whether that amount remains as credit for future rides.",
  "Cultura": "Culture",
  "Con guías locales": "With local guides",
  "Noticias de Rapa Nui": "Rapa Nui News",
  "Noticias Rapa Go": "Rapa Go News",
  "Noticias": "News",
  "Viajes, tours y experiencias locales": "Rides, tours and local experiences",
  "¿A dónde vamos hoy?": "Where are we going today?",
  "Datos de la cuenta": "Account details",
  "Datos personales": "Personal details",
  "Editar perfil": "Edit profile",
  "Nombre": "Name",
  "Teléfono": "Phone",
  "Celular": "Mobile phone",
  "Correo electrónico": "Email",
  "Email": "Email",
  "Nacionalidad": "Nationality",
  "No informada": "Not provided",
  "Tipo de pasajero": "Passenger type",
  "URL de avatar (opcional)": "Avatar URL (optional)",
  "URL opcional": "Optional URL",
  "Tu nombre completo": "Your full name",
  "Este dato se toma automáticamente desde el registro y se usa para calcular tarifas.": "This information is taken automatically from registration and is used to calculate fares.",
  "Carga de imágenes disponible en una versión futura.": "Image upload available in a future version.",
  "✓ Cambios guardados correctamente.": "✓ Changes saved successfully.",
  "Invita y Gana": "Invite and Earn",
  "Comparte tu código. Cuando alguien complete su primer viaje, recibirás un beneficio en tu billetera.": "Share your code. When someone completes their first ride, you will receive a benefit in your wallet.",
  "Generar mi código": "Generate my code",
  "Tu código:": "Your code:",
  "Copiar código": "Copy code",
  "Compartir link": "Share link",
  "¡Copiado!": "Copied!",
  "Has invitado a": "You have invited",
  "Has ganado": "You have earned",
  "Completa tu teléfono para solicitar viajes.": "Complete your phone number to request rides.",
  "Debe completar al menos un campo: nombre o avatar.": "At least one field (name or avatarUrl) must be provided.",
  "Debes completar al menos un campo: nombre o avatar.": "At least one field (name or avatarUrl) must be provided.",
  "Rol": "Role",
  "Pasajero / Conductor": "Passenger / Driver",
  "Estado": "Status",
  "Activa": "Active",
  "Activo": "Active",
  "Verificado": "Verified",
  "Verificación": "Verification",
  "Cuenta verificada": "Verified account",
  "No verificada": "Not verified",
  "Pendiente": "Pending",
  "Aprobado": "Approved",
  "Rechazado": "Rejected",
  "Aceptado": "Accepted",
  "Completado": "Completed",
  "Cancelado": "Cancelled",
  "Cuenta protegida": "Protected account",
  "Tus datos se muestran de forma segura. Nunca compartas códigos, contraseñas ni documentos por chat externo.": "Your data is shown securely. Never share codes, passwords or documents through external chat.",
  "Modo conductor": "Driver mode",
  "Conductor aprobado": "Approved driver",
  "Ver solicitudes y aceptar viajes.": "View requests and accept rides.",
  "Entrar": "Enter",
  "Cambiar a conductor": "Switch to driver",
  "Cambiar a modo pasajero": "Switch to passenger mode",
  "Idioma": "Language",
  "Idiomas": "Languages",
  "Selecciona idioma": "Select language",
  "Español": "Spanish",
  "Inglés": "English",
  "Guardar cambios": "Save changes",
  "Cambios guardados": "Changes saved",
  "Cerrar sesión": "Log out",
  "Volver": "Back",
  "Continuar": "Continue",
  "Cancelar": "Cancel",
  "Aceptar": "Accept",
  "Rechazar": "Reject",
  "Confirmar": "Confirm",
  "Eliminar": "Delete",
  "Quitar": "Remove",
  "Cambiar foto": "Change photo",
  "Adjuntar foto": "Attach photo",
  "Foto de perfil": "Profile photo",
  "Foto del vehículo": "Vehicle photo",
  "Sin foto": "No photo",
  "Vehículo propio": "Own vehicle",
  "Vehículo opcional": "Optional vehicle",
  "Agregar vehículo opcional": "Add optional vehicle",
  "Vehículos del conductor": "Driver vehicles",
  "Vehículo activo": "Active vehicle",
  "Usar este": "Use this one",
  "Editar abajo": "Edit below",
  "Marca": "Brand",
  "Modelo": "Model",
  "Año": "Year",
  "Patente": "License plate",
  "Color": "Color",
  "Licencia de conducir": "Driver license",
  "Número de licencia": "License number",
  "Fecha de vencimiento": "Expiration date",
  "Biografía": "Bio",
  "Sobre ti": "About you",
  "Origen": "Pickup",
  "Destino": "Destination",
  "Mi ubicación": "My location",
  "¿Dónde te recogemos?": "Where should we pick you up?",
  "¿A dónde vas?": "Where are you going?",
  "Punto de recogida": "Pickup point",
  "Destino final": "Final destination",
  "Efectivo": "Cash",
  "Tarjeta": "Card",
  "ProntoPaga": "ProntoPaga",
  "Pago": "Payment",
  "Forma de pago": "Payment method",
  "Precio": "Price",
  "Precio del viaje": "Ride price",
  "Tarifa": "Fare",
  "Tarifa estimada": "Estimated fare",
  "Solo ida": "One way",
  "Ida y vuelta": "Round trip",
  "Agendar viaje": "Schedule ride",
  "Agendado": "Scheduled",
  "Reserva": "Booking",
  "Reserva aceptada": "Booking accepted",
  "Reserva asignada": "Assigned booking",
  "Reservas asignadas": "Assigned bookings",
  "Reservas aceptadas": "Accepted bookings",
  "Ver en Mis Viajes": "View in My Trips",
  "Ver en solicitudes": "View in requests",
  "Ver en Reservas": "View in Bookings",
  "Ya tienes un viaje o reserva activa": "You already have an active ride or booking",
  "Recogida": "Pickup",
  "Llegué al punto": "Arrived at pickup",
  "Iniciar viaje": "Start ride",
  "Finalizar viaje": "Finish ride",
  "Comenzar ruta": "Start route",
  "Conductor asignado": "Driver assigned",
  "Conductor en camino": "Driver on the way",
  "Conductor llegó": "Driver arrived",
  "En curso": "In progress",
  "En viaje": "On trip",
  "Buscando conductor": "Looking for driver",
  "Nueva solicitud de viaje": "New ride request",
  "Aceptar viaje": "Accept ride",
  "Rechazar viaje": "Reject ride",
  "No hay solicitudes disponibles.": "No requests available.",
  "No tienes viajes todavía.": "You do not have trips yet.",
  "No tienes reservas asignadas por ahora.": "You do not have assigned bookings right now.",
  "No tienes reservas de servicios turísticos.": "You do not have tourism service bookings.",
  "Disponible": "Available",
  "No disponible": "Unavailable",
  "Estado del conductor": "Driver status",
  "Panel de conductor Rapa Go": "Rapa Go driver panel",
  "Accesos rápidos": "Quick access",
  "Mis viajes": "My trips",
  "Historial y navegación": "History and navigation",
  "Resumen de ingresos": "Earnings summary",
  "Datos personales y vehículo": "Personal and vehicle details",
  "Revisa tus solicitudes": "Check your requests",
  "Estás no disponible": "You are unavailable",
  "Ver": "View",
  "Cambiar": "Change",
  "Modo sin internet": "Offline mode",
  "Modo conexión baja": "Low connection mode",
  "Revisando conexión": "Checking connection",
  "Conexión estable.": "Stable connection.",
  "Documentos Legales": "Legal Documents",
  "Nueva versión": "New version",
  "Documento rechazado": "Document rejected",
  "Validación pendiente": "Validation pending",
  "Residencia Rapa Nui aprobada": "Rapa Nui residence approved",
  "Turista chileno": "Chilean tourist",
  "Turista extranjero": "Foreign tourist",
  "Residente Rapa Nui": "Rapa Nui resident",
  "Volver a adjuntar documento": "Upload document again",
  "Collar de flores": "Flower lei",
  "Collar de flores Rapa Nui": "Rapa Nui flower lei",
  "Aeropuerto": "Airport",
  "Hospital": "Hospital",
  "Centro": "Downtown",
  "Ahora": "Now",
  "Hoy": "Today",
  "Mañana": "Tomorrow",
  "Todos": "All",
  "Activos": "Active",
  "Completados": "Completed",
  "Cancelados": "Cancelled",
  "Cargando": "Loading",
  "Error al cargar reservas.": "Error loading bookings.",
  "Error al cancelar.": "Error cancelling.",
  "Elegir destino desde el aeropuerto": "Choose airport destination",
  "Elegir destino en el mapa": "Choose destination on map",
  "CUÁNDO VIAJAS": "WHEN ARE YOU TRAVELING",
  "CUANDO VIAJAS": "WHEN ARE YOU TRAVELING",
  "Cuándo viajas": "When are you traveling",
  "AHORA": "NOW",
  "AGENDAR": "SCHEDULE",
  "TIPO DE VIAJE OPCIONAL": "OPTIONAL TRIP TYPE",
  "Tipo de viaje opcional": "Optional trip type",
  "Viaje normal. Las promociones ida y vuelta están abajo.": "Normal ride. Round-trip promotions are below.",
  "Viaje normal. Las promociones ida y vuelta estan abajo.": "Normal ride. Round-trip promotions are below.",
  "Estándar": "Standard",
  "Estandar": "Standard",
  "Viaje normal urbano": "Normal urban ride",
  "Vehículo XL": "XL vehicle",
  "Vehiculo XL": "XL vehicle",
  "Más espacio y comodidad": "More space and comfort",
  "Mas espacio y comodidad": "More space and comfort",
  "Extra maletas": "Extra luggage",
  "Ideal si llevas equipaje": "Ideal if you carry luggage",
  "AGENDA TU RECOGIDA PARA AEROPUERTO": "SCHEDULE YOUR AIRPORT PICKUP",
  "Agenda tu recogida para aeropuerto": "Schedule your airport pickup",
  "Al agendar, el origen queda automático en Aeropuerto Internacional Mataveri de Rapa Nui. El pasajero elige el destino final. La reserva queda congelada para conductores y se libera 1 min antes.": "When scheduled, the origin is set automatically to Rapa Nui Mataveri International Airport. The passenger chooses the final destination. The booking stays frozen for drivers and is released 1 minute before.",
  "NÚMERO DE VUELO OPCIONAL": "OPTIONAL FLIGHT NUMBER",
  "Número de vuelo opcional": "Optional flight number",
  "RECIBIMIENTO OPCIONAL": "OPTIONAL WELCOME",
  "Recibimiento opcional": "Optional welcome",
  "Solo recogida": "Pickup only",
  "El conductor te espera y te lleva directo.": "The driver waits for you and takes you directly.",
  "Bienvenida Rapa Nui al llegar · +$800 CLP": "Rapa Nui welcome on arrival · +$800 CLP",
  "Recogida programada desde Mataveri. Tú eliges el destino, la hora y el recibimiento. Preparamos tu viaje y te avisaremos cuando tu RapaGo esté listo para ir por ti.": "Scheduled pickup from Mataveri. You choose the destination, time and welcome. We prepare your ride and notify you when your RapaGo is ready to pick you up.",
  "Recogida programada desde Mataveri": "Scheduled pickup from Mataveri",
  "Tú eliges el destino, la hora y el recibimiento. Preparamos tu viaje y te avisaremos cuando tu RapaGo esté listo para ir por ti.": "You choose the destination, time and welcome. We prepare your ride and notify you when your RapaGo is ready to pick you up.",
  "Tu eliges el destino, la hora y el recibimiento. Preparamos tu viaje y te avisaremos cuando tu RapaGo este listo para ir por ti.": "You choose the destination, time and welcome. We prepare your ride and notify you when your RapaGo is ready to pick you up.",
  "PROMOCIONES IDA Y VUELTA": "ROUND-TRIP PROMOTIONS",
  "Promociones ida y vuelta": "Round-trip promotions",
  "OFERTAS DESTACADAS": "FEATURED OFFERS",
  "Ofertas destacadas": "Featured offers",
  "Ida y vuelta con precio cerrado": "Round trip with fixed price",
  "Promociones disponibles para Rapa Nui resident.": "Promotions available for Rapa Nui resident.",
  "Promociones disponibles para Residente Rapa Nui.": "Promotions available for Rapa Nui resident.",
  "Promociones disponibles para residente Rapa Nui.": "Promotions available for Rapa Nui resident.",
  "El destino se completa solo y tú eliges el punto de recogida.": "The destination is filled automatically and you choose the pickup point.",
  "El destino se completa solo y tu eliges el punto de recogida.": "The destination is filled automatically and you choose the pickup point.",
  "Tarifa fija": "Fixed fare",
  "Escapada a Anakena": "Anakena getaway",
  "Anakena - Ida y vuelta": "Anakena - Round trip",
  "Especial para Rapa Nui resident": "Special for Rapa Nui resident",
  "Especial para Residente Rapa Nui": "Special for Rapa Nui resident",
  "Especial para residente Rapa Nui": "Special for Rapa Nui resident",
  "Destino automático": "Automatic destination",
  "Destino automatico": "Automatic destination",
  "Recogida a selección": "Pickup selected",
  "Recogida a seleccion": "Pickup selected",
  "Toca para elegir esta promo": "Tap to choose this promo",
  "Subida a Terevaka": "Terevaka climb",
  "Terevaka - Ida y vuelta": "Terevaka - Round trip",
  "NOTAS OPCIONAL": "OPTIONAL NOTES",
  "Notas opcional": "Optional notes",
  "Notas opcionales": "Optional notes",
  "NOTAS OPCIONALES": "OPTIONAL NOTES",
  "Selecciona una opción": "Select an option",
  "Selecciona una opcion": "Select an option",
  "Elegir destino": "Choose destination",
  "Elegir en el mapa": "Choose on map",
  "Confirmar destino": "Confirm destination",
  "Confirmar viaje": "Confirm ride",
  "Solicitar Rapa Go": "Request Rapa Go",
  "Agendar Rapa Go": "Schedule Rapa Go",
  "Fecha y hora": "Date and time",
  "Hora": "Time",
  "Fecha": "Date",
  "Número de pasajeros": "Number of passengers",
  "Numero de pasajeros": "Number of passengers",
};

const EN_TO_ES_AUTO: Record<string, string> = Object.entries(ES_TO_EN).reduce(
  (acc, [es, en]) => {
    acc[en] = es;
    return acc;
  },
  {} as Record<string, string>,
);

const EN_TO_ES_EXTRA: Record<string, string> = {
  "At least one field (name or avatarUrl) must be provided.": "Debes completar al menos un campo: nombre o avatar.",
  "At least one field (name or avatarUrl) must be provided": "Debes completar al menos un campo: nombre o avatar.",
  "At least one field (name or avatar) must be provided.": "Debes completar al menos un campo: nombre o avatar.",
  "At least one field (name or avatar) must be provided": "Debes completar al menos un campo: nombre o avatar.",
  "Failed to update profile.": "No se pudo actualizar el perfil.",
  "Failed to load profile.": "No se pudo cargar el perfil.",
  "Saving...": "Guardando...",
  "saving.": "Guardando.",
  "Save changes": "Guardar cambios",
  "Avatar URL (optional)": "URL de avatar (opcional)",
  "Passenger type": "Tipo de pasajero",
  "Not provided": "No informada",
  "Invite and Earn": "Invita y Gana",
  "Generate my code": "Generar mi código",
  "Copy code": "Copiar código",
  "Share link": "Compartir link",
  "Copied!": "¡Copiado!",
  "VEHICLE": "Vehículo",
  "WHEN ARE YOU TRAVELING": "CUÁNDO VIAJAS",
  "NOW": "AHORA",
  "SCHEDULE": "AGENDAR",
  "OPTIONAL TRIP TYPE": "TIPO DE VIAJE OPCIONAL",
  "SCHEDULE YOUR AIRPORT PICKUP": "AGENDA TU RECOGIDA PARA AEROPUERTO",
  "OPTIONAL FLIGHT NUMBER": "NÚMERO DE VUELO OPCIONAL",
  "OPTIONAL WELCOME": "RECIBIMIENTO OPCIONAL",
  "ROUND-TRIP PROMOTIONS": "PROMOCIONES IDA Y VUELTA",
  "FEATURED OFFERS": "OFERTAS DESTACADAS",
  "OPTIONAL NOTES": "NOTAS OPCIONALES",
};

const EN_TO_ES: Record<string, string> = {
  ...EN_TO_ES_AUTO,
  ...EN_TO_ES_EXTRA,
};

function translateDynamicText(text: string, language: RapaGoLanguage): string | null {
  const trimmed = normalizeTextKey(text);
  if (!trimmed) return null;

  if (language === "en") {

    // Traduce textos compuestos que mezclan título + descripción en el mismo nodo.
    if (trimmed.includes("Recogida programada desde Mataveri.")) {
      return trimmed
        .replace("Recogida programada desde Mataveri.", "Scheduled pickup from Mataveri.")
        .replace("Tú eliges el destino, la hora y el recibimiento. Preparamos tu viaje y te avisaremos cuando tu RapaGo esté listo para ir por ti.", "You choose the destination, time and welcome. We prepare your ride and notify you when your RapaGo is ready to pick you up.")
        .replace("Tu eliges el destino, la hora y el recibimiento. Preparamos tu viaje y te avisaremos cuando tu RapaGo este listo para ir por ti.", "You choose the destination, time and welcome. We prepare your ride and notify you when your RapaGo is ready to pick you up.");
    }

    if (trimmed.includes("Bienvenida Rapa Nui al llegar")) {
      return trimmed.replace("Bienvenida Rapa Nui al llegar", "Rapa Nui welcome on arrival");
    }

    if (trimmed.includes("Especial para Rapa Nui resident")) {
      return trimmed.replace("Especial para Rapa Nui resident", "Special for Rapa Nui resident");
    }

    if (trimmed.includes("Especial para Residente Rapa Nui")) {
      return trimmed.replace("Especial para Residente Rapa Nui", "Special for Rapa Nui resident");
    }

    if (trimmed.includes("Promociones disponibles para")) {
      return trimmed
        .replace("Promociones disponibles para", "Promotions available for")
        .replace("Residente Rapa Nui", "Rapa Nui resident")
        .replace("residente Rapa Nui", "Rapa Nui resident");
    }
    let match = trimmed.match(/^Hola,\s*(.+?)\s*👋$/i);
    if (match?.[1]) return `Hi, ${match[1]} 👋`;

    match = trimmed.match(/^Miembro desde\s+(.+)$/i);
    if (match?.[1]) return `Member since ${match[1]}`;

    match = trimmed.match(/^Reserva\s+#(.+)$/i);
    if (match?.[1]) return `Booking #${match[1]}`;

    match = trimmed.match(/^Fecha:\s*(.+)$/i);
    if (match?.[1]) return `Date: ${match[1]}`;

    match = trimmed.match(/^Recogida:\s*(.+)$/i);
    if (match?.[1]) return `Pickup: ${match[1]}`;

    match = trimmed.match(/^Precio:\s*(.+)$/i);
    if (match?.[1]) return `Price: ${match[1]}`;

    match = trimmed.match(/^Pago:\s*(.+)$/i);
    if (match?.[1]) return `Payment: ${match[1]}`;

    match = trimmed.match(/^Vehículo:\s*(.+)$/i);
    if (match?.[1]) return `Vehicle: ${match[1]}`;

    match = trimmed.match(/^(.+)\s+persona(?:s)?$/i);
    if (match?.[1]) return `${match[1]} people`;
  }

  if (language === "es") {
    let match = trimmed.match(/^Hi,\s*(.+?)\s*👋$/i);
    if (match?.[1]) return `Hola, ${match[1]} 👋`;

    match = trimmed.match(/^Member since\s+(.+)$/i);
    if (match?.[1]) return `Miembro desde ${match[1]}`;

    match = trimmed.match(/^Booking\s+#(.+)$/i);
    if (match?.[1]) return `Reserva #${match[1]}`;

    match = trimmed.match(/^Date:\s*(.+)$/i);
    if (match?.[1]) return `Fecha: ${match[1]}`;

    match = trimmed.match(/^Pickup:\s*(.+)$/i);
    if (match?.[1]) return `Recogida: ${match[1]}`;

    match = trimmed.match(/^Price:\s*(.+)$/i);
    if (match?.[1]) return `Precio: ${match[1]}`;

    match = trimmed.match(/^Payment:\s*(.+)$/i);
    if (match?.[1]) return `Pago: ${match[1]}`;

    match = trimmed.match(/^Vehicle:\s*(.+)$/i);
    if (match?.[1]) return `Vehículo: ${match[1]}`;
  }

  return null;
}

export function rapaGoTranslateText(text: string, language = getRapaGoLanguage()): string {
  const original = String(text ?? "");
  const key = normalizeTextKey(original);
  if (!key) return original;

  const exact = language === "en" ? ES_TO_EN[key] : EN_TO_ES[key];
  const dynamic = translateDynamicText(original, language);
  const translated = exact ?? dynamic;

  if (!translated || translated === key) return original;

  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

export function useRapaGoLanguage(): {
  language: RapaGoLanguage;
  setLanguage: (language: RapaGoLanguage) => void;
  t: (text: string) => string;
  isEnglish: boolean;
} {
  const [language, setLanguageState] = useState<RapaGoLanguage>(() => getRapaGoLanguage());

  useEffect(() => {
    const refresh = () => setLanguageState(getRapaGoLanguage());

    window.addEventListener(RAPAGO_LANGUAGE_EVENT, refresh as EventListener);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener(RAPAGO_LANGUAGE_EVENT, refresh as EventListener);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return useMemo(
    () => ({
      language,
      setLanguage: setRapaGoLanguage,
      t: (text: string) => rapaGoTranslateText(text, language),
      isEnglish: language === "en",
    }),
    [language],
  );
}

function shouldSkipNode(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) return true;

  const tag = parent.tagName.toLowerCase();
  if (["script", "style", "noscript", "code", "pre", "svg", "path", "canvas"].includes(tag)) return true;

  if (parent.closest("[data-rapago-no-translate='true']")) return true;
  if (parent.closest("input, textarea")) return true;

  return false;
}

function shouldSkipTextValue(value: string): boolean {
  const text = normalizeTextKey(value);
  if (!text) return true;
  if (text.length > 240) return true;
  if (/^[\d\s.,:$#%+-]+$/.test(text)) return true;
  if (/https?:\/\//i.test(text)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return true;
  return false;
}

function translateTextNode(node: Text, language: RapaGoLanguage): void {
  if (shouldSkipNode(node)) return;
  const value = node.nodeValue ?? "";
  if (shouldSkipTextValue(value)) return;
  const translated = rapaGoTranslateText(value, language);
  if (translated !== value) node.nodeValue = translated;
}

function translateElementAttributes(element: Element, language: RapaGoLanguage): void {
  if (element.closest("[data-rapago-no-translate='true']")) return;

  const attrs = ["placeholder", "aria-label", "title"];
  for (const attr of attrs) {
    const value = element.getAttribute(attr);
    if (!value || shouldSkipTextValue(value)) continue;
    const translated = rapaGoTranslateText(value, language);
    if (translated !== value) element.setAttribute(attr, translated);
  }
}

function walkAndTranslate(root: ParentNode, language: RapaGoLanguage): void {
  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode = textWalker.nextNode();

  while (textNode) {
    translateTextNode(textNode as Text, language);
    textNode = textWalker.nextNode();
  }

  if (root instanceof Element) translateElementAttributes(root, language);

  const elements = root.querySelectorAll?.("[placeholder], [aria-label], [title]");
  elements?.forEach((element) => translateElementAttributes(element, language));
}

let runtimeStarted = false;
let runtimeObserver: MutationObserver | null = null;
let applyTimer: number | undefined;
let applying = false;


function forceTranslateIonicTabs(language: RapaGoLanguage): void {
  try {
    const tabLabels = document.querySelectorAll(
      "ion-tab-button ion-label, ion-tabs ion-label, ion-tab-bar ion-label, [role='tab'] ion-label",
    );

    tabLabels.forEach((label) => {
      const current = normalizeTextKey(label.textContent ?? "");
      if (!current) return;

      const translated = rapaGoTranslateText(current, language);
      if (translated && translated !== current) {
        label.textContent = translated;
      }
    });

    const tabButtons = document.querySelectorAll("ion-tab-button, [role='tab']");
    tabButtons.forEach((button) => {
      const aria = button.getAttribute("aria-label");
      if (aria) {
        const translated = rapaGoTranslateText(aria, language);
        if (translated !== aria) button.setAttribute("aria-label", translated);
      }
    });
  } catch {
    // No bloquea la app.
  }
}

function forceTranslateKnownButtons(language: RapaGoLanguage): void {
  try {
    const selectors = [
      "ion-button",
      "button",
      "ion-title",
      "ion-card-title",
      "ion-label",
      "ion-chip",
      "ion-badge",
    ];

    document.querySelectorAll(selectors.join(",")).forEach((element) => {
      if (element.closest("[data-rapago-no-translate='true']")) return;
      const childElementCount = element.children.length;
      const current = normalizeTextKey(element.textContent ?? "");
      if (!current || current.length > 160) return;

      const translated = rapaGoTranslateText(current, language);
      if (translated !== current && childElementCount === 0) {
        element.textContent = translated;
      }
    });
  } catch {
    // No bloquea.
  }
}

export function applyRapaGoTranslationsNow(language = getRapaGoLanguage()): void {
  if (typeof document === "undefined") return;

  applyRapaGoDocumentLanguage(language);

  if (!document.body || applying) return;

  applying = true;
  try {
    walkAndTranslate(document.body, language);
    forceTranslateIonicTabs(language);
    forceTranslateKnownButtons(language);
  } finally {
    applying = false;
  }
}

function scheduleApplyTranslations(language = getRapaGoLanguage()): void {
  window.clearTimeout(applyTimer);
  applyTimer = window.setTimeout(() => applyRapaGoTranslationsNow(language), 40);
}

export function startRapaGoLanguageRuntime(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  applyRapaGoTranslationsNow(getRapaGoLanguage());

  if (runtimeStarted) return;
  runtimeStarted = true;

  runtimeObserver = new MutationObserver((mutations) => {
    if (applying) return;

    const shouldApply = mutations.some((mutation) => {
      if (mutation.type === "characterData") return true;
      if (mutation.type === "attributes") return true;
      return mutation.addedNodes.length > 0;
    });

    if (shouldApply) scheduleApplyTranslations();
  });

  const startObserver = () => {
    if (!document.body || !runtimeObserver) return;
    runtimeObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "aria-label", "title"],
    });
  };

  if (document.body) startObserver();
  else window.setTimeout(startObserver, 80);

  window.addEventListener(RAPAGO_LANGUAGE_EVENT, () => scheduleApplyTranslations());
  window.addEventListener("storage", () => scheduleApplyTranslations());
  window.addEventListener("focus", () => scheduleApplyTranslations());
}

export function RapaGoLanguageRuntime(): null {
  useEffect(() => {
    startRapaGoLanguageRuntime();
    scheduleApplyTranslations();
  }, []);

  return null;
}

export function RapaGoLanguageToolbarButton(): JSX.Element {
  const { language, setLanguage } = useRapaGoLanguage();
  const nextLanguage: RapaGoLanguage =
    language === "es" ? "en" : "es";

  return (
    <IonButton
      type="button"
      aria-label={
        language === "es"
          ? "Cambiar aplicación a inglés"
          : "Switch app to Spanish"
      }
      title={
        language === "es"
          ? "Cambiar a English"
          : "Cambiar a Español"
      }
      onClick={() => setLanguage(nextLanguage)}
      style={
        {
          "--border-radius": "999px",
          "--background": "rgba(255,255,255,.16)",
          "--color": "#ffffff",
          fontWeight: 950,
          minWidth: 72,
        } as CSSProperties
      }
    >
      <IonIcon icon={globeOutline} slot="start" />
      {language === "es" ? "EN" : "ES"}
    </IonButton>
  );
}

export function RapaGoLanguageCard(): JSX.Element {
  const { language, setLanguage } = useRapaGoLanguage();

  const optionStyle = (active: boolean): CSSProperties => ({
    minHeight: 60,
    borderRadius: 18,
    border: active ? "2px solid #22c55e" : "1.5px solid rgba(17,17,17,.35)",
    background: active
      ? "linear-gradient(135deg,#22c55e,#2dd36f)"
      : "linear-gradient(135deg,#fff,#f6f2ec)",
    color: active ? "#07140b" : "#111827",
    fontWeight: 950,
    fontSize: ".95rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: active ? "0 14px 28px rgba(34,197,94,.22)" : "0 10px 22px rgba(0,0,0,.08)",
  });

  return (
    <IonCard
      style={{
        margin: "0 0 16px",
        borderRadius: 24,
        background: "rgba(246,242,236,.98)",
        color: "#111",
        border: "1px solid rgba(210,164,58,.30)",
        boxShadow: "0 16px 36px rgba(0,0,0,.18)",
      }}
    >
      <IonCardContent style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              background: "linear-gradient(135deg,#d2a43a,#f4d37a)",
              color: "#111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IonIcon icon={globeOutline} style={{ fontSize: 25 }} />
          </div>
          <div>
            <div style={{ fontWeight: 950, fontSize: "1.05rem" }}>
              {language === "en" ? "App language" : "Idioma de la app"}
            </div>
            <div style={{ marginTop: 3, color: "#4b5563", fontSize: ".80rem", fontWeight: 850, lineHeight: 1.35 }}>
              {language === "en"
                ? "This changes the visible text across RAPA GO."
                : "Esto cambia los textos visibles de toda RAPA GO."}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button type="button" onClick={() => setLanguage("es")} style={optionStyle(language === "es")}>
            <span>CL</span> Español
          </button>
          <button type="button" onClick={() => setLanguage("en")} style={optionStyle(language === "en")}>
            <span>US</span> English
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#166534",
            fontSize: ".78rem",
            fontWeight: 900,
            lineHeight: 1.35,
          }}
        >
          <IonIcon icon={shieldCheckmarkOutline} />
          {language === "en"
            ? "Saved securely on this device. It does not expose user data."
            : "Guardado de forma segura en este dispositivo. No expone datos del usuario."}
        </div>
      </IonCardContent>
    </IonCard>
  );
}

export default RapaGoLanguageRuntime;
