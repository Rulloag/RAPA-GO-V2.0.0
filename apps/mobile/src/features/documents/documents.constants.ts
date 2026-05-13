export const ROLE_REQUIRED_DOCS: Record<string, readonly string[]> = {
  passenger:       ["identity_document"],
  driver:          ["identity_document", "driver_license", "vehicle_registration", "vehicle_insurance"],
  guide:           ["identity_document", "guide_certification"],
  rental_operator: ["identity_document", "business_registration", "vehicle_ownership"],
  admin:           [],
};

export const DOCUMENT_LABEL: Record<string, string> = {
  identity_document:    "Documento de identidad",
  driver_license:       "Licencia de conducir",
  vehicle_registration: "Registro de vehículo",
  vehicle_insurance:    "Seguro del vehículo",
  guide_certification:  "Certificación de guía",
  business_registration: "Registro de empresa",
  vehicle_ownership:    "Propiedad del vehículo",
};

export const STATUS_COLOR: Record<string, string> = {
  pending:  "medium",
  uploaded: "warning",
  approved: "success",
  rejected: "danger",
};

export const STATUS_LABEL: Record<string, string> = {
  pending:  "Pendiente",
  uploaded: "Enviado",
  approved: "Aprobado",
  rejected: "Rechazado",
};
