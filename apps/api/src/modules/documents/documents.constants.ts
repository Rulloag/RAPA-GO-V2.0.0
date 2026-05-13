/**
 * Document types required per role.
 * Used for validation and to populate the required-documents list.
 */
export const ROLE_DOCUMENT_TYPES: Record<string, readonly string[]> = {
  passenger:       ["identity_document"],
  driver:          ["identity_document", "driver_license", "vehicle_registration", "vehicle_insurance"],
  guide:           ["identity_document", "guide_certification"],
  rental_operator: ["identity_document", "business_registration", "vehicle_ownership"],
  admin:           [],
} as const;

export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  identity_document:   "Documento de identidad",
  driver_license:      "Licencia de conducir",
  vehicle_registration: "Registro de vehículo",
  vehicle_insurance:   "Seguro del vehículo",
  guide_certification: "Certificación de guía",
  business_registration: "Registro de empresa",
  vehicle_ownership:   "Propiedad del vehículo",
};

export const DOCUMENT_STATUSES = ["pending", "uploaded", "approved", "rejected"] as const;
export type DocumentStatus = typeof DOCUMENT_STATUSES[number];
