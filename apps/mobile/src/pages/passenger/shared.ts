// Shared lookup tables used across multiple passenger pages

export const RIDE_STATUS_LABEL: Record<string, string> = {
  requested:       "Solicitado",
  accepted:        "Conductor asignado",
  driver_en_route: "Conductor en camino",
  driver_arrived:  "Conductor llegó",
  in_progress:     "En curso",
  completed:       "Completado",
  cancelled:       "Cancelado",
};

export const RIDE_STATUS_COLOR: Record<string, string> = {
  requested:       "warning",
  accepted:        "primary",
  driver_en_route: "tertiary",
  driver_arrived:  "secondary",
  in_progress:     "success",
  completed:       "medium",
  cancelled:       "danger",
};

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending:   "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const BOOKING_STATUS_COLOR: Record<string, string> = {
  pending:   "warning",
  confirmed: "success",
  completed: "medium",
  cancelled: "danger",
};

export const SERVICE_TYPE_LABEL: Record<string, string> = {
  tour:     "Tour",
  transfer: "Traslado",
  workshop: "Taller",
  custom:   "Personalizado",
};

export const VEHICLE_TYPE_LABEL: Record<string, string> = {
  car:        "Auto",
  suv:        "SUV",
  van:        "Van",
  motorcycle: "Moto",
  bicycle:    "Bicicleta",
  quad:       "Quad",
};

export const RENTAL_STATUS_COLOR: Record<string, string> = {
  pending:   "warning",
  confirmed: "success",
  active:    "primary",
  completed: "medium",
  cancelled: "danger",
};

export const RENTAL_STATUS_LABEL: Record<string, string> = {
  pending:   "Pendiente",
  confirmed: "Confirmada",
  active:    "Activa",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const LANG_LABEL: Record<string, string> = {
  es:      "🇨🇱 ES",
  en:      "🇺🇸 EN",
  rapa_nui: "🗿 RP",
};

export const FREQUENT_DESTINATIONS = ["Aeropuerto", "Anakena", "Tongariki", "Ahu Akivi", "Orongo", "Rano Raraku"];
