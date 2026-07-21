import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useRef, useState, useCallback, type CSSProperties, type ChangeEvent } from "react";
import { useHistory } from "react-router-dom";
import {
  arrowBackOutline,
  cameraOutline,
  carOutline,
  checkmarkCircleOutline,
  copyOutline,
  enterOutline,
  exitOutline,
  giftOutline,
  languageOutline,
  keyOutline,
  linkOutline,
  lockClosedOutline,
  logoFacebook,
  mailOutline,
  personOutline,
  saveOutline,
  shareSocialOutline,
  shieldCheckmarkOutline,
  sparklesOutline,
  trashOutline,
} from "ionicons/icons";
import { ModulePlaceholderPage } from "../../../components/ModulePlaceholderPage";
import { AccountDeletionCard } from "../../../components/accountDeletion/AccountDeletionCard.js";
import { ROUTE_METADATA } from "../../../navigation/routeConfig";
import { ROUTES } from "../../../navigation/routes";
import { authService, useAuth } from "../../../features/auth";
import { profileService, type ProfileData } from "../../../features/profile/profile.service";
import { ROLE_HOME } from "../../../navigation/RouteGuard";
import { documentsService } from "../../../features/documents/documents.service";
import { bankAccountService, type BankAccountData } from "../../../features/bankAccount/bankAccount.service";
import {
  ROLE_REQUIRED_DOCS,
  DOCUMENT_LABEL,
  STATUS_COLOR as DOC_STATUS_COLOR,
  STATUS_LABEL as DOC_STATUS_LABEL,
} from "../../../features/documents/documents.constants";
import { referralsService, type ReferralSummary } from "../../../features/referrals/referrals.service.js";

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

const ROLE_LABEL: Record<string, string> = {
  passenger:       "Pasajero",
  driver:          "Conductor",
  guide:           "Guía Turístico",
  rental_operator: "Operador de Arriendo",
  admin:           "Administrador",
};

const STATUS_LABEL: Record<string, string> = {
  pending:   "Pendiente de verificación",
  active:    "Activa",
  suspended: "Suspendida",
  banned:    "Bloqueada",
};

type PassengerFareType = "resident" | "chilean" | "foreigner";

const PASSENGER_FARE_LABEL: Record<PassengerFareType, string> = {
  resident: "Residente Rapa Nui",
  chilean: "Turista chileno",
  foreigner: "Turista extranjero",
};

const PASSENGER_FARE_DESCRIPTION: Record<PassengerFareType, string> = {
  resident: "Tarifa residente validada con documentación.",
  chilean: "Persona chilena que visita la isla y no acredita residencia.",
  foreigner: "Persona extranjera visitante.",
};


type ProfileLanguage = "es" | "en";

const RAPAGO_PROFILE_LANGUAGE_KEY = "rapago_profile_language_v1";

const ROLE_LABEL_BY_LANGUAGE: Record<ProfileLanguage, Record<string, string>> = {
  es: {
    passenger: "Pasajero",
    driver: "Conductor",
    guide: "Guía Turístico",
    rental_operator: "Operador de Arriendo",
    admin: "Administrador",
  },
  en: {
    passenger: "Passenger",
    driver: "Driver",
    guide: "Tour Guide",
    rental_operator: "Rental Operator",
    admin: "Administrator",
  },
};

const STATUS_LABEL_BY_LANGUAGE: Record<ProfileLanguage, Record<string, string>> = {
  es: STATUS_LABEL,
  en: {
    pending: "Pending verification",
    active: "Active",
    suspended: "Suspended",
    banned: "Blocked",
  },
};

const PASSENGER_FARE_LABEL_BY_LANGUAGE: Record<ProfileLanguage, Record<PassengerFareType, string>> = {
  es: PASSENGER_FARE_LABEL,
  en: {
    resident: "Rapa Nui resident",
    chilean: "Chilean tourist",
    foreigner: "Foreign tourist",
  },
};

const PASSENGER_FARE_DESCRIPTION_BY_LANGUAGE: Record<ProfileLanguage, Record<PassengerFareType, string>> = {
  es: PASSENGER_FARE_DESCRIPTION,
  en: {
    resident: "Resident fare validated with documentation.",
    chilean: "Chilean visitor who does not have verified island residency.",
    foreigner: "Foreign visitor.",
  },
};

const PROFILE_TEXT: Record<ProfileLanguage, Record<string, string>> = {
  es: {
    home: "Inicio",
    profile: "Mi Perfil",
    hello: "Perfil Rapa Go",
    accountData: "Datos de la cuenta",
    accountSubtitle: "Información segura usada para tarifas, viajes y validaciones.",
    email: "Email",
    nationality: "Nacionalidad",
    role: "Rol",
    status: "Estado",
    verified: "Verificado",
    yes: "Sí",
    no: "No",
    memberSince: "Miembro desde",
    languageTitle: "Idioma de la app",
    languageSubtitle: "Cambia entre español e inglés para navegar Rapa Go.",
    spanish: "Español",
    english: "English",
    securityTitle: "Cuenta protegida",
    securitySubtitle: "Tus datos se muestran de forma segura. Nunca compartas códigos, contraseñas ni documentos por chat externo.",
    driverApproved: "Conductor aprobado",
    driverMode: "Modo conductor",
    driverModeSubtitle: "Ver solicitudes, reservas y aceptar viajes.",
    switchDriver: "Cambiar a conductor",
    enterDriver: "Entrar",
    editProfile: "Editar perfil",
    editSubtitle: "Actualiza solo datos necesarios. Sanitizamos texto, teléfono y enlaces antes de guardar.",
    name: "Nombre",
    namePlaceholder: "Tu nombre completo",
    phone: "Teléfono",
    phonePlaceholder: "+56 9 1234 5678",
    avatarUrl: "Foto de perfil (opcional)",
    avatarPlaceholder: "Adjuntar foto",
    avatarHelper: "Opcional. Si no agregas foto, Rapa Go mostrará tus iniciales.",
    avatarChange: "Cambiar foto",
    avatarAttach: "Adjuntar foto",
    avatarRemove: "Quitar foto",
    avatarSelected: "Foto cargada correctamente.",
    fareHelper: "Se toma desde el registro y se usa para calcular tarifas.",
    save: "Guardar cambios",
    saving: "Guardando...",
    noChanges: "No hay cambios para guardar.",
    saved: "Cambios guardados correctamente.",
    completePhone: "Completa tu teléfono para solicitar viajes.",
    inviteTitle: "Invita y Gana",
    inviteSubtitle: "Comparte tu código. Cuando alguien complete su primer viaje, recibirás un beneficio en tu billetera.",
    yourCode: "Tu código",
    invited: "Has invitado a",
    people: "persona(s)",
    earned: "Has ganado",
    copyCode: "Copiar código",
    copied: "¡Copiado!",
    shareLink: "Compartir link",
    shareTitle: "RAPA GO",
    shareText: "Usa mi código para tu primer viaje",
    generateCode: "Generar mi código",
    logout: "Cerrar sesión",
    invalidAvatar: "Selecciona una imagen válida en JPG, PNG o WebP.",
    invalidName: "El nombre es opcional. Puedes guardar el perfil sin foto.",
    safeBadge: "Protegido",
    verifiedBadge: "Verificación",
    activeBadge: "Cuenta activa",
  },
  en: {
    home: "Home",
    profile: "My Profile",
    hello: "Rapa Go Profile",
    accountData: "Account details",
    accountSubtitle: "Secure information used for fares, rides, and validations.",
    email: "Email",
    nationality: "Passenger type",
    role: "Role",
    status: "Status",
    verified: "Verified",
    yes: "Yes",
    no: "No",
    memberSince: "Member since",
    languageTitle: "App language",
    languageSubtitle: "Switch between Spanish and English inside Rapa Go.",
    spanish: "Español",
    english: "English",
    securityTitle: "Protected account",
    securitySubtitle: "Your data is displayed safely. Never share codes, passwords, or documents through external chats.",
    driverApproved: "Approved driver",
    driverMode: "Driver mode",
    driverModeSubtitle: "View requests, reservations, and accept rides.",
    switchDriver: "Switch to driver",
    enterDriver: "Enter",
    editProfile: "Edit profile",
    editSubtitle: "Update only the necessary data. Text, phone, and links are sanitized before saving.",
    name: "Name",
    namePlaceholder: "Your full name",
    phone: "Phone",
    phonePlaceholder: "+56 9 1234 5678",
    avatarUrl: "Profile photo (optional)",
    avatarPlaceholder: "Attach photo",
    avatarHelper: "Optional. If you do not add a photo, Rapa Go will show your initials.",
    avatarChange: "Change photo",
    avatarAttach: "Attach photo",
    avatarRemove: "Remove photo",
    avatarSelected: "Photo loaded successfully.",
    fareHelper: "Taken from registration and used to calculate fares.",
    save: "Save changes",
    saving: "Saving...",
    noChanges: "No changes to save.",
    saved: "Changes saved successfully.",
    completePhone: "Complete your phone number to request rides.",
    inviteTitle: "Invite and Earn",
    inviteSubtitle: "Share your code. When someone completes their first ride, you receive a wallet benefit.",
    yourCode: "Your code",
    invited: "You have invited",
    people: "person(s)",
    earned: "You have earned",
    copyCode: "Copy code",
    copied: "Copied!",
    shareLink: "Share link",
    shareTitle: "RAPA GO",
    shareText: "Use my code for your first ride",
    generateCode: "Generate my code",
    logout: "Log out",
    invalidAvatar: "Select a valid JPG, PNG, or WebP image.",
    invalidName: "Name is optional. You can save the profile without a photo.",
    safeBadge: "Protected",
    verifiedBadge: "Verification",
    activeBadge: "Active account",
  },
};

function normalizeProfileLanguage(value: unknown): ProfileLanguage {
  return String(value ?? "").toLowerCase().startsWith("en") ? "en" : "es";
}

function readInitialProfileLanguage(): ProfileLanguage {
  try {
    return normalizeProfileLanguage(
      localStorage.getItem(RAPAGO_PROFILE_LANGUAGE_KEY) ??
        localStorage.getItem("rapago_language") ??
        localStorage.getItem("rapago_app_language"),
    );
  } catch {
    return "es";
  }
}

function persistProfileLanguage(value: ProfileLanguage): void {
  try {
    localStorage.setItem(RAPAGO_PROFILE_LANGUAGE_KEY, value);
    localStorage.setItem("rapago_language", value);
    localStorage.setItem("rapago_app_language", value);
    window.dispatchEvent(new CustomEvent("rapago:language-changed", { detail: { language: value } }));
  } catch {
    // No bloquea la app si el navegador no permite storage.
  }
}

function sanitizeProfileText(value: unknown, maxLength = 120): string {
  return String(value ?? "")
    .replace(/[<>`{}$\\]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeProfilePhone(value: unknown): string {
  return String(value ?? "")
    .replace(/[^+\d\s()\-.]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
}

const RAPAGO_PASSENGER_PROFILE_PHOTO_KEY = "rapago_passenger_profile_photo_data_url_v1";

function getPassengerProfileOwnerKey(source?: unknown): string {
  if (!source || typeof source !== "object") return "passenger-global";
  const data = source as Record<string, unknown>;
  const candidates = [data.email, data.userEmail, data.id, data.userId, data.name, data.fullName];

  for (const value of candidates) {
    const text = String(value ?? "").trim().toLowerCase();
    if (text) return text;
  }

  return "passenger-global";
}

function getPassengerPhotoStorageKey(source?: unknown): string {
  return `${RAPAGO_PASSENGER_PROFILE_PHOTO_KEY}__${encodeURIComponent(getPassengerProfileOwnerKey(source))}`;
}

function readStoredPassengerProfilePhoto(source?: unknown): string {
  try {
    const scoped = localStorage.getItem(getPassengerPhotoStorageKey(source));
    const legacy = localStorage.getItem(RAPAGO_PASSENGER_PROFILE_PHOTO_KEY);
    const value = scoped || legacy || "";
    return getSafePassengerProfilePhotoSource(value);
  } catch {
    return "";
  }
}

function persistStoredPassengerProfilePhoto(value: string, source?: unknown): void {
  try {
    const clean = getSafePassengerProfilePhotoSource(value);
    const scopedKey = getPassengerPhotoStorageKey(source);

    if (clean) {
      localStorage.setItem(scopedKey, clean);
      localStorage.setItem(RAPAGO_PASSENGER_PROFILE_PHOTO_KEY, clean);
    } else {
      localStorage.removeItem(scopedKey);
      localStorage.removeItem(RAPAGO_PASSENGER_PROFILE_PHOTO_KEY);
    }

    window.dispatchEvent(new CustomEvent("rapago:passenger-profile-photo-updated", {
      detail: { ownerKey: getPassengerProfileOwnerKey(source), hasPhoto: Boolean(clean) },
    }));
  } catch {
    // No bloquea el perfil si localStorage no está disponible.
  }
}

function getSafePassengerProfilePhotoSource(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^data:image\/(png|jpe?g|webp);base64,/i.test(raw)) return raw;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    return url.toString().slice(0, 800);
  } catch {
    return "";
  }
}

function resizePassengerProfilePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error(PROFILE_TEXT.es.invalidAvatar));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la foto."));
    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error("No se pudo procesar la foto."));
      img.onload = () => {
        const maxSide = 420;
        const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * ratio));
        const height = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo preparar la foto."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.58));
      };

      img.src = String(reader.result ?? "");
    };

    reader.readAsDataURL(file);
  });
}

function rapagoProfileCard(extra?: CSSProperties): CSSProperties {
  return {
    margin: "0 0 14px",
    borderRadius: "24px",
    overflow: "hidden",
    background: "rgba(246,242,236,.97)",
    color: "#111111",
    border: "1px solid rgba(210,164,58,.32)",
    boxShadow: "0 18px 40px rgba(0,0,0,.22)",
    ...extra,
  };
}

function rapagoInputStyle(): CSSProperties {
  return {
    "--background": "#ffffff",
    "--color": "#080808",
    "--placeholder-color": "#6f6f6f",
    "--placeholder-opacity": "1",
    "--highlight-color-focused": "#d2a43a",
    "--border-color": "rgba(210,164,58,.55)",
    "--border-radius": "18px",
    "--padding-start": "14px",
    "--inner-padding-end": "14px",
    marginTop: "10px",
    border: "1.5px solid rgba(210,164,58,.55)",
    borderRadius: "18px",
    overflow: "hidden",
    fontWeight: 900,
  } as CSSProperties;
}

function rapagoLabelStyle(): CSSProperties {
  return {
    color: "#111111",
    fontWeight: 950,
    fontSize: ".78rem",
  };
}

function rapagoFieldStyle(): CSSProperties {
  return {
    color: "#111111",
    fontWeight: 950,
    fontSize: ".95rem",
    "--color": "#111111",
    "--placeholder-color": "#6f6f6f",
    "--placeholder-opacity": "1",
  } as CSSProperties;
}

function normalizeTextForFare(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizePassengerFareType(...values: unknown[]): PassengerFareType | null {
  const normalizedValues = values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => normalizeTextForFare(value));

  for (const text of normalizedValues) {
    if (!text) continue;

    // Turista chileno debe detectarse antes que la palabra genérica "turista",
    // para evitar que se tome como extranjero.
    if (
      text.includes("turista chileno") ||
      text.includes("turista_chileno") ||
      text.includes("visitor_chilean") ||
      text.includes("chilean_tourist") ||
      text.includes("chilean_non_resident") ||
      text.includes("chileno_no_residente") ||
      text.includes("chilean no resident") ||
      text.includes("chileno no residente") ||
      text.includes("chilean-non-resident") ||
      text.includes("chileno-no-residente") ||
      text.includes("no residente") ||
      text.includes("no_residente") ||
      text.includes("non resident") ||
      text.includes("non_resident") ||
      text.includes("nonresident") ||
      text.includes("visitante_chileno") ||
      text.includes("chilena") ||
      text.includes("chileno") ||
      text.includes("chilean")
    ) {
      return "chilean";
    }

    if (
      text.includes("turista extranjero") ||
      text.includes("turista_extranjero") ||
      text.includes("foreign_tourist") ||
      text.includes("visitor_foreign") ||
      text.includes("foreigner") ||
      text.includes("foreign") ||
      text.includes("extranjera") ||
      text.includes("extranjero")
    ) {
      return "foreigner";
    }

    if (
      text === "rapanui" ||
      text === "rapanui normal" ||
      text === "rapa nui normal"
    ) {
      // Categoría legada eliminada: se mantiene como Turista chileno.
      return "chilean";
    }

    if (
      text.includes("residente rapa nui") ||
      text.includes("residente_rapa_nui") ||
      text.includes("resident_rapa_nui") ||
      text === "resident" ||
      text === "residente" ||
      text === "true" ||
      text === "1"
    ) {
      return "resident";
    }

    // Solo si no dice chileno ni extranjero, "turista" queda como extranjero por seguridad tarifaria.
    if (text.includes("turista") || text.includes("tourist") || text.includes("visitor")) {
      return "foreigner";
    }
  }

  return null;
}

function getPassengerFareTypeLabel(
  value: PassengerFareType | null | undefined,
  language: ProfileLanguage = "es",
): string {
  if (!value) return language === "en" ? "Not provided" : "No informada";
  return PASSENGER_FARE_LABEL_BY_LANGUAGE[language][value] ?? PASSENGER_FARE_LABEL[value];
}

function getPassengerFareTypeDescription(
  value: PassengerFareType | null | undefined,
  language: ProfileLanguage = "es",
): string {
  if (!value) {
    return language === "en"
      ? "This information will be taken from registration."
      : "Este dato se tomará desde el registro.";
  }

  return (
    PASSENGER_FARE_DESCRIPTION_BY_LANGUAGE[language][value] ??
    PASSENGER_FARE_DESCRIPTION[value]
  );
}

function getProfileRoleLabel(role: NormalizedRole, language: ProfileLanguage): string {
  return ROLE_LABEL_BY_LANGUAGE[language][role] ?? ROLE_LABEL[role] ?? role;
}

function getProfileStatusLabel(status: string, language: ProfileLanguage): string {
  return STATUS_LABEL_BY_LANGUAGE[language][status] ?? STATUS_LABEL[status] ?? status;
}

function translateProfileErrorMessage(
  error: unknown,
  language: ProfileLanguage,
): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const text = raw.toLowerCase();

  // En Rapa Go la foto de perfil es opcional y el nombre visible puede venir
  // desde la sesión/registro. No mostramos errores antiguos del backend que
  // exigían name/avatarUrl, porque confundían al usuario aunque el nombre ya
  // apareciera en pantalla.
  if (
    text.includes("at least one field") ||
    text.includes("name or avatarurl") ||
    text.includes("name or avatar url")
  ) {
    return language === "en"
      ? "No changes were needed. Your profile is ready."
      : "No era necesario completar más datos. Tu perfil quedó listo.";
  }

  if (text.includes("failed to fetch") || text.includes("network")) {
    return language === "en"
      ? "Connection problem. Check your internet and try again."
      : "Problema de conexión. Revisa tu internet e intenta nuevamente.";
  }

  if (text.includes("unauthorized") || text.includes("401") || text.includes("token")) {
    return language === "en"
      ? "Your session could not be verified. Please sign in again."
      : "No se pudo verificar tu sesión. Inicia sesión nuevamente.";
  }

  return raw || (language === "en" ? "Unexpected error." : "Error inesperado.");
}

type NormalizedRole = "passenger" | "driver" | "guide" | "rental_operator" | "admin";

function normalizeRoleValue(value: unknown): NormalizedRole | null {
  const text = normalizeTextForFare(value);

  if (!text) return null;
  if (text.includes("admin") || text.includes("administrador")) return "admin";
  if (text.includes("driver") || text.includes("conductor")) return "driver";
  if (text.includes("guide") || text.includes("guia")) return "guide";
  if (
    text.includes("rental_operator") ||
    text.includes("rent_a_car") ||
    text.includes("rentacar") ||
    text.includes("arriendo")
  ) {
    return "rental_operator";
  }
  if (text.includes("passenger") || text.includes("pasajero")) return "passenger";

  return null;
}

function collectRoleValues(source: unknown): unknown[] {
  if (!source || typeof source !== "object") return [];

  const record = source as Record<string, unknown>;
  const values: unknown[] = [
    record.role,
    record.activeRole,
    record.currentRole,
    record.selectedRole,
    record.viewMode,
    record.mode,
  ];

  for (const key of ["roles", "availableRoles", "userRoles", "permissions"]) {
    const value = record[key];

    if (Array.isArray(value)) {
      values.push(...value);
    }
  }

  return values;
}

function getAutoRoleLabel(profileCandidate: unknown, userCandidate: unknown, canOpenDriverMode: boolean, language: ProfileLanguage): string {
  const roles = new Set<NormalizedRole>();

  for (const value of [
    ...collectRoleValues(profileCandidate),
    ...collectRoleValues(userCandidate),
    localStorage.getItem("rapago_active_role"),
    localStorage.getItem("rapago_selected_role"),
    localStorage.getItem("rapago_view_mode"),
  ]) {
    const normalized = normalizeRoleValue(value);
    if (normalized) roles.add(normalized);
  }

  const profileRole =
    profileCandidate && typeof profileCandidate === "object"
      ? normalizeRoleValue((profileCandidate as Record<string, unknown>).role)
      : null;

  if (profileRole) roles.add(profileRole);
  if (canOpenDriverMode) roles.add("driver");
  if (roles.size === 0) roles.add("passenger");

  const ordered: NormalizedRole[] = ["passenger", "driver", "guide", "rental_operator", "admin"];

  return ordered
    .filter((role) => roles.has(role))
    .map((role) => getProfileRoleLabel(role, language))
    .join(" / ");
}

function sameEmail(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function readTextField(source: unknown, keys: string[]): string {
  if (!source || typeof source !== "object") return "";

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  }

  return "";
}

function readBooleanField(source: unknown, keys: string[]): boolean {
  if (!source || typeof source !== "object") return false;

  const record = source as Record<string, unknown>;

  return keys.some((key) => record[key] === true);
}

function readArrayTextField(source: unknown, keys: string[]): string[] {
  if (!source || typeof source !== "object") return [];

  const record = source as Record<string, unknown>;
  const values: string[] = [];

  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      values.push(
        ...value
          .map((item) => String(item ?? "").trim().toLowerCase())
          .filter(Boolean),
      );
    }
  }

  return values;
}

function hasApprovedDriverAccess(profile: unknown, user: unknown): boolean {
  const roleText = [
    readTextField(profile, ["role", "activeRole", "currentRole"]),
    readTextField(user, ["role", "activeRole", "currentRole"]),
    ...readArrayTextField(profile, ["roles", "availableRoles"]),
    ...readArrayTextField(user, ["roles", "availableRoles"]),
  ].join(" ");

  const hasDriverRole =
    roleText.includes("driver") ||
    roleText.includes("conductor");

  if (!hasDriverRole) {
    return false;
  }

  const driverStatusText = [
    readTextField(profile, [
      "driverStatus",
      "driverProfileStatus",
      "driverApplicationStatus",
      "applicationStatus",
      "approvalStatus",
      "driverApprovalStatus",
    ]),
    readTextField(user, [
      "driverStatus",
      "driverProfileStatus",
      "driverApplicationStatus",
      "applicationStatus",
      "approvalStatus",
      "driverApprovalStatus",
    ]),
  ].join(" ");

  const generalStatusText = [
    readTextField(profile, ["status"]),
    readTextField(user, ["status"]),
  ].join(" ");

  const hasExplicitApproval =
    driverStatusText.includes("approved") ||
    driverStatusText.includes("aprobado") ||
    driverStatusText.includes("active") ||
    driverStatusText.includes("activo") ||
    generalStatusText.includes("approved") ||
    generalStatusText.includes("aprobado") ||
    generalStatusText.includes("active") ||
    generalStatusText.includes("activo") ||
    readBooleanField(profile, ["isDriverApproved", "driverApproved", "isApprovedDriver"]) ||
    readBooleanField(user, ["isDriverApproved", "driverApproved", "isApprovedDriver"]);

  // El botón solo debe aparecer para usuarios que ya son conductores
  // y cuya cuenta/postulación de conductor está aprobada o activa.
  return hasExplicitApproval;
}


export function ProfileIndexPage(): JSX.Element {
  const auth = useAuth() as ReturnType<typeof useAuth> & {
    logout?: () => void | Promise<void>;
    signOut?: () => void | Promise<void>;
  };

  const { session } = auth;
  const history = useHistory();

  type StoredRegistrationProfile = {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    rut?: string | null;
    birthDate?: string | null;

    passengerFareType?: PassengerFareType | string | null;
    passengerFareLabel?: string | null;
    directPassengerFareType?: string | null;
    directNationality?: string | null;

    passengerType?: PassengerFareType | string | null;
    farePassengerType?: PassengerFareType | string | null;
    passengerCondition?: string | null;
    condition?: string | null;
    nationality?: string | null;
    isResident?: boolean | string | null;
    rapaNuiEthnicity?: string | boolean | null;
    role?: string | null;
    activeRole?: string | null;
    currentRole?: string | null;
    roles?: string[] | null;
  };
  function readStoredRegistrationProfile(): StoredRegistrationProfile {
    try {
      const raw = localStorage.getItem("rapago_registration_profile");
      const parsed = raw ? (JSON.parse(raw) as StoredRegistrationProfile) : {};
      const directFareType =
        localStorage.getItem("rapago_passenger_fare_type") ??
        localStorage.getItem("rapago_passenger_condition") ??
        localStorage.getItem("rapago_profile_passenger_type") ??
        localStorage.getItem("rapago_fare_passenger_type") ??
        localStorage.getItem("farePassengerType") ??
        localStorage.getItem("passengerType") ??
        localStorage.getItem("condition");
      const directNationality =
        localStorage.getItem("rapago_profile_nationality") ??
        localStorage.getItem("rapago_nationality") ??
        localStorage.getItem("nationality");

      return {
        ...parsed,
        phone: parsed.phone ?? localStorage.getItem("rapago_profile_phone"),
        rut: parsed.rut ?? localStorage.getItem("rapago_profile_rut"),
        passengerFareType:
          parsed.passengerFareType ??
          parsed.farePassengerType ??
          parsed.passengerType ??
          null,
        passengerFareLabel:
          parsed.passengerFareLabel ?? parsed.nationality ?? null,
        directPassengerFareType: directFareType,
        directNationality,
        nationality: parsed.nationality ?? parsed.passengerFareLabel ?? null,
        passengerCondition:
          parsed.passengerCondition ??
          parsed.condition ??
          localStorage.getItem("rapago_passenger_condition") ??
          localStorage.getItem("condition") ??
          null,
        condition:
          parsed.condition ??
          localStorage.getItem("rapago_passenger_condition") ??
          localStorage.getItem("condition") ??
          null,
        rapaNuiEthnicity:
          parsed.rapaNuiEthnicity ??
          localStorage.getItem("rapago_belongs_to_rapa_nui_ethnicity") ??
          null,
        role:
          parsed.role ??
          localStorage.getItem("rapago_active_role") ??
          localStorage.getItem("rapago_selected_role") ??
          null,
        activeRole:
          parsed.activeRole ??
          localStorage.getItem("rapago_active_role") ??
          null,
        currentRole:
          parsed.currentRole ??
          localStorage.getItem("rapago_view_mode") ??
          null,
        roles: Array.isArray(parsed.roles) ? parsed.roles : null,
      };
    } catch {
      return {};
    }
  }

  function persistStoredRegistrationProfile(data: Partial<StoredRegistrationProfile>): void {
    try {
      const current = readStoredRegistrationProfile();
      const next = { ...current, ...data };

      localStorage.setItem("rapago_registration_profile", JSON.stringify(next));

      if (next.phone) localStorage.setItem("rapago_profile_phone", next.phone);
      if (next.rut) localStorage.setItem("rapago_profile_rut", next.rut);

      const normalizedFareType = normalizePassengerFareType(
        next.passengerFareType,
        next.farePassengerType,
        next.passengerType,
        next.nationality,
        next.passengerFareLabel,
        next.isResident,
      );

      if (normalizedFareType) {
        localStorage.setItem("rapago_passenger_fare_type", normalizedFareType);
        localStorage.setItem("rapago_passenger_condition", normalizedFareType);
        localStorage.setItem("rapago_profile_passenger_type", normalizedFareType);
        localStorage.setItem("rapago_profile_nationality", getPassengerFareTypeLabel(normalizedFareType));
        localStorage.setItem("rapago_nationality", getPassengerFareTypeLabel(normalizedFareType));
      }
    } catch {
      // No bloquea el perfil si localStorage no está disponible.
    }
  }

  function getSessionPhone(user: unknown): string {
    if (!user || typeof user !== "object") return "";

    const value = (user as { phone?: string | null }).phone;
    return typeof value === "string" ? value.trim() : "";
  }

  function getAutoPhone(profilePhone?: string | null): string {
    const stored = readStoredRegistrationProfile();

    return (
      profilePhone?.trim() ||
      getSessionPhone(session?.user) ||
      stored.phone?.trim() ||
      ""
    );
  }

  function getAutoPassengerFareType(profileCandidate?: unknown): PassengerFareType | null {
    const stored = readStoredRegistrationProfile();
    const profileObject = profileCandidate && typeof profileCandidate === "object"
      ? (profileCandidate as Record<string, unknown>)
      : {};
    const sessionUser = session?.user && typeof session.user === "object"
      ? (session.user as Record<string, unknown>)
      : {};

    const profileEmail = String(profileObject.email ?? sessionUser.email ?? stored.email ?? "").trim();

    const fromProfileOrSession = normalizePassengerFareType(
      profileObject.passengerFareType,
      profileObject.farePassengerType,
      profileObject.passengerType,
      profileObject.passengerCondition,
      profileObject.condition,
      profileObject.nationality,
      profileObject.isResident,

      sessionUser.passengerFareType,
      sessionUser.farePassengerType,
      sessionUser.passengerType,
      sessionUser.passengerCondition,
      sessionUser.condition,
      sessionUser.nationality,
      sessionUser.isResident,
    );

    if (fromProfileOrSession) return fromProfileOrSession;

    const storedBelongsToThisUser = !stored.email || !profileEmail || sameEmail(stored.email, profileEmail);

    if (storedBelongsToThisUser) {
      const fromStored =
        normalizePassengerFareType(
          stored.nationality,
          stored.passengerFareLabel,
          stored.farePassengerType,
          stored.passengerFareType,
          stored.passengerType,
          stored.passengerCondition,
          stored.condition,
          stored.isResident,
        ) ??
        normalizePassengerFareType(
          stored.directNationality,
          stored.directPassengerFareType,
          localStorage.getItem("rapago_passenger_condition"),
          localStorage.getItem("rapago_passenger_fare_type"),
        );

      if (fromStored) return fromStored;
    }

    return null;
  }

  const [profile,    setProfile]    = useState<ProfileData | null>(null);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);

  const [nameInput,      setNameInput]      = useState("");
  const [avatarInput,    setAvatarInput]    = useState("");
  const avatarPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarPhotoError, setAvatarPhotoError] = useState<string | null>(null);
  const [phoneInput,     setPhoneInput]     = useState("");
  const [passengerFareType, setPassengerFareType] = useState<PassengerFareType | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [saveError,      setSaveError]      = useState<string | null>(null);
  const [saveSuccess,    setSaveSuccess]    = useState(false);
  const [language,       setLanguage]       = useState<ProfileLanguage>(() => readInitialProfileLanguage());

  const [referral,       setReferral]       = useState<ReferralSummary | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode,     setCopiedCode]     = useState(false);

  const loadProfile = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setLoadError(null);

    try {
      const data = await profileService.getProfile(session.accessToken);
      const autoPhone = getAutoPhone((data as ProfileData & { phone?: string | null }).phone);
      const autoPassengerFareType = getAutoPassengerFareType(data);

      setProfile(data);
      setNameInput(data.name);
      setAvatarInput(readStoredPassengerProfilePhoto(data) || getSafePassengerProfilePhotoSource(data.avatarUrl));
      setPhoneInput(autoPhone);
      setPassengerFareType(autoPassengerFareType);

      persistStoredRegistrationProfile({
        ...(autoPhone ? { phone: autoPhone } : {}),
        email: data.email,
        name: data.name,
        role: data.role,
        ...(autoPassengerFareType
          ? {
              passengerFareType: autoPassengerFareType,
              passengerFareLabel: getPassengerFareTypeLabel(autoPassengerFareType),
              nationality: getPassengerFareTypeLabel(autoPassengerFareType),
              isResident: autoPassengerFareType === "resident",
            }
          : {}),
      });

      referralsService.getMyReferral(session.accessToken).then(setReferral).catch(() => {});
    } catch (err) {
      const fallbackPhone = getAutoPhone(null);
      const fallbackPassengerFareType = getAutoPassengerFareType(session.user);

      setPassengerFareType(fallbackPassengerFareType);

      if (fallbackPhone || fallbackPassengerFareType) {
        setPhoneInput(fallbackPhone);
        persistStoredRegistrationProfile({
          ...(fallbackPhone ? { phone: fallbackPhone } : {}),
          email: session.user?.email ?? null,
          name: session.user?.name ?? null,
          role: session.user?.role ?? null,
          ...(fallbackPassengerFareType
            ? {
                passengerFareType: fallbackPassengerFareType,
                passengerFareLabel: getPassengerFareTypeLabel(fallbackPassengerFareType),
                nationality: getPassengerFareTypeLabel(fallbackPassengerFareType),
                isResident: fallbackPassengerFareType === "resident",
              }
            : {}),
        });
      }

      setLoadError(err instanceof Error ? err.message : "Error al cargar el perfil.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, session?.user]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  function handleAvatarPhotoChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const uiText = PROFILE_TEXT[language];
    setSaveError(null);
    setSaveSuccess(false);
    setAvatarPhotoError(null);

    if (!file.type.startsWith("image/")) {
      setAvatarPhotoError(uiText.invalidAvatar);
      event.target.value = "";
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setAvatarPhotoError(language === "en" ? "The photo must be under 4 MB." : "La foto no puede pesar más de 4 MB.");
      event.target.value = "";
      return;
    }

    void resizePassengerProfilePhoto(file)
      .then((photoDataUrl) => {
        setAvatarInput(photoDataUrl);
        persistStoredPassengerProfilePhoto(photoDataUrl, profile ?? session?.user);
        setSaveSuccess(true);
      })
      .catch(() => setAvatarPhotoError(uiText.invalidAvatar))
      .finally(() => {
        event.target.value = "";
      });
  }

  function handleRemoveAvatarPhoto(): void {
    setAvatarInput("");
    setAvatarPhotoError(null);
    setSaveError(null);
    setSaveSuccess(false);
    persistStoredPassengerProfilePhoto("", profile ?? session?.user);
  }

  async function handleSave() {
    if (!session?.accessToken || !profile) return;

    const payload: { name?: string; avatarUrl?: string | null; phone?: string } = {};
    const typedName = sanitizeProfileText(nameInput, 100);
    const fallbackName = sanitizeProfileText(
      profile.name || session?.user?.name || session?.user?.email?.split("@")[0] || "",
      100,
    );
    const finalName = typedName || fallbackName;
    const trimmedPhone = sanitizeProfilePhone(phoneInput);

    // La foto de perfil es 100% opcional.
    // No se pide URL ni se bloquea guardar por no adjuntar foto.
    // Si el usuario adjunta foto, se guarda localmente comprimida para no exponer enlaces externos.
    const cleanAvatarPhoto = getSafePassengerProfilePhotoSource(avatarInput);
    persistStoredPassengerProfilePhoto(cleanAvatarPhoto, profile);

    // Siempre enviamos el nombre visible si existe. Así el backend no responde
    // con el error antiguo de "name or avatarUrl" cuando solo se guardan datos locales.
    if (finalName) {
      payload.name = finalName;
    }

    if (!cleanAvatarPhoto && profile.avatarUrl) {
      payload.avatarUrl = null;
    }

    if (trimmedPhone) {
      payload.phone = trimmedPhone;
    }

    setNameInput(finalName);
    setPhoneInput(trimmedPhone);
    setAvatarInput(cleanAvatarPhoto);

    if (Object.keys(payload).length === 0) {
      setSaveError(null);
      setSaveSuccess(true);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const updated = await profileService.updateProfile(session.accessToken, payload);
      const savedPhone = getAutoPhone((updated as ProfileData & { phone?: string | null }).phone ?? trimmedPhone);

      setProfile(updated);
      setNameInput(updated.name);
      setAvatarInput(readStoredPassengerProfilePhoto(updated) || cleanAvatarPhoto || getSafePassengerProfilePhotoSource(updated.avatarUrl));
      setPhoneInput(savedPhone);

      persistStoredRegistrationProfile({
        ...(savedPhone ? { phone: savedPhone } : {}),
        email: updated.email,
        name: updated.name,
        role: updated.role,
        ...(passengerFareType
          ? {
              passengerFareType,
              passengerFareLabel: getPassengerFareTypeLabel(passengerFareType),
              nationality: getPassengerFareTypeLabel(passengerFareType),
              isResident: passengerFareType === "resident",
            }
          : {}),
      });

      setSaveSuccess(true);
    } catch (err) {
      const translated = translateProfileErrorMessage(err, language);
      const raw = err instanceof Error ? err.message.toLowerCase() : String(err ?? "").toLowerCase();

      if (
        raw.includes("at least one field") ||
        raw.includes("name or avatarurl") ||
        raw.includes("name or avatar url")
      ) {
        // Guardado local correcto; no bloqueamos al usuario por una validación vieja del backend.
        persistStoredRegistrationProfile({
          ...(trimmedPhone ? { phone: trimmedPhone } : {}),
          email: profile.email,
          name: finalName || profile.name,
          role: profile.role,
          ...(passengerFareType
            ? {
                passengerFareType,
                passengerFareLabel: getPassengerFareTypeLabel(passengerFareType),
                nationality: getPassengerFareTypeLabel(passengerFareType),
                isResident: passengerFareType === "resident",
              }
            : {}),
        });
        setSaveError(null);
        setSaveSuccess(true);
        return;
      }

      setSaveError(translated);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateCode() {
    if (!session?.accessToken) return;
    setGeneratingCode(true);
    try {
      const result = await referralsService.generateCode(session.accessToken);
      setReferral(prev => prev
        ? { ...prev, code: result.code, link: result.link }
        : { code: result.code, link: result.link, usedCount: 0, totalReward: 0, pendingReward: 0 }
      );
    } catch { } finally {
      setGeneratingCode(false);
    }
  }

  async function handleCopyCode(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch { }
  }

  async function handleLogout() {
    try {
      if (typeof auth.logout === "function") {
        await auth.logout();
      } else if (typeof auth.signOut === "function") {
        await auth.signOut();
      } else {
        localStorage.removeItem("rapago_session");
        localStorage.removeItem("rapago_auth_session");
        localStorage.removeItem("auth_session");
        sessionStorage.clear();
      }
    } finally {
      history.replace(ROUTES.AUTH.LOGIN);
    }
  }

  const roleHome = profile?.role ? ROLE_HOME[profile.role as keyof typeof ROLE_HOME] : undefined;
  const canOpenDriverMode = hasApprovedDriverAccess(profile, session?.user);
  const accountRoleLabel = getAutoRoleLabel(profile, session?.user, canOpenDriverMode, language);
  const profileText = PROFILE_TEXT[language];
  const passengerFareLabel = getPassengerFareTypeLabel(passengerFareType, language);
  const passengerFareDescription = getPassengerFareTypeDescription(passengerFareType, language);

  function handleLanguageChange(nextLanguage: ProfileLanguage): void {
    setLanguage(nextLanguage);
    persistProfileLanguage(nextLanguage);
  }

  function handleGoToDriverMode(): void {
    try {
      localStorage.setItem("rapago_active_mode", "driver");
      localStorage.setItem("rapago_active_role", "driver");
      localStorage.setItem("rapago_selected_role", "driver");
      localStorage.setItem("rapago_view_mode", "driver");

      const currentRaw = localStorage.getItem("rapago_registration_profile");
      const current = currentRaw ? JSON.parse(currentRaw) as Record<string, unknown> : {};
      const currentRoles = Array.isArray(current.roles)
        ? current.roles.map((item) => String(item))
        : [];
      localStorage.setItem("rapago_registration_profile", JSON.stringify({
        ...current,
        activeRole: "driver",
        currentRole: "driver",
        roles: Array.from(new Set(["passenger", "driver", ...currentRoles])),
      }));
    } catch {
      // No bloquea navegación si el navegador no permite localStorage.
    }

    history.push(ROUTES.DRIVER.HOME);
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar
          style={
            {
              "--background": "linear-gradient(135deg,#d2a43a,#b87828)",
              "--color": "#ffffff",
              "--border-width": "0",
              "--min-height": "70px",
            } as CSSProperties
          }
        >
          {roleHome && (
            <IonButtons slot="start">
              <IonButton
                onClick={() => history.push(roleHome)}
                style={
                  {
                    "--border-radius": "999px",
                    "--background": "rgba(255,255,255,.28)",
                    "--color": "#111111",
                    fontWeight: 950,
                    marginLeft: 8,
                  } as CSSProperties
                }
              >
                <IonIcon icon={arrowBackOutline} slot="start" />
                {profileText.home}
              </IonButton>
            </IonButtons>
          )}

          <IonTitle style={{ fontWeight: 950, fontSize: "1.2rem" }}>
            {profileText.profile}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent
        className="ion-padding"
        style={
          {
            "--background":
              "linear-gradient(180deg, rgba(15,15,15,.84), rgba(15,15,15,.94)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat",
          } as CSSProperties
        }
      >
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && (
          <IonText color="danger">
            <p style={{ fontWeight: 900 }}>{loadError}</p>
          </IonText>
        )}

        {!loading && profile && (
          <div style={{ maxWidth: 560, margin: "0 auto", paddingBottom: 96 }}>
            <section
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 28,
                marginBottom: 14,
                padding: 18,
                color: "#ffffff",
                background:
                  "linear-gradient(135deg, rgba(17,17,17,.98) 0%, rgba(47,30,22,.98) 46%, rgba(210,164,58,.95) 100%)",
                border: "1px solid rgba(255,255,255,.14)",
                boxShadow: "0 24px 54px rgba(0,0,0,.34)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: -48,
                  top: -62,
                  width: 172,
                  height: 172,
                  borderRadius: 999,
                  background: "rgba(255,255,255,.14)",
                }}
              />
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 26,
                    overflow: "hidden",
                    background: "linear-gradient(135deg,#2dd36f,#d2a43a)",
                    border: "2px solid rgba(255,255,255,.38)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 950,
                    fontSize: "1.35rem",
                    boxShadow: "0 16px 34px rgba(0,0,0,.32)",
                    flexShrink: 0,
                  }}
                >
                  {getSafePassengerProfilePhotoSource(avatarInput) ? (
                    <img
                      src={getSafePassengerProfilePhotoSource(avatarInput)}
                      alt="Foto de perfil"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    sanitizeProfileText(profile.name || session?.user?.email || "R", 40)
                      .split(" ")
                      .slice(0, 2)
                      .map((word) => word[0] ?? "")
                      .join("")
                      .toUpperCase() || "R"
                  )}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <IonBadge color="success" style={{ fontWeight: 950 }}>
                      <IonIcon icon={shieldCheckmarkOutline} style={{ marginRight: 4, verticalAlign: "-2px" }} />
                      {profileText.safeBadge}
                    </IonBadge>
                    {profile.status === "active" && (
                      <IonBadge color="warning" style={{ fontWeight: 950 }}>
                        {profileText.activeBadge}
                      </IonBadge>
                    )}
                  </div>
                  <div style={{ fontSize: "1.45rem", fontWeight: 950, lineHeight: 1.08 }}>
                    {sanitizeProfileText(nameInput || profile.name, 80)}
                  </div>
                  <div style={{ marginTop: 5, fontSize: ".86rem", opacity: .88, fontWeight: 800 }}>
                    {profileText.hello}
                  </div>
                  <div style={{ marginTop: 8, fontSize: ".76rem", opacity: .82, fontWeight: 800 }}>
                    {sanitizeProfileText(profile.email, 160)}
                  </div>
                </div>
              </div>
            </section>

            {!phoneInput.trim() && (
              <IonCard
                style={rapagoProfileCard({
                  background: "linear-gradient(135deg,#fff3cd,#fff9e8)",
                  border: "1px solid rgba(210,164,58,.62)",
                })}
              >
                <IonCardContent style={{ padding: "12px 14px", fontWeight: 900, color: "#6b4700" }}>
                  📱 {profileText.completePhone}
                </IonCardContent>
              </IonCard>
            )}

            <IonCard style={rapagoProfileCard()}>
              <IonCardContent style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 16,
                        background: "linear-gradient(135deg,#111827,#8F3F25)",
                        color: "#f8d879",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IonIcon icon={languageOutline} style={{ fontSize: 26 }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 950, fontSize: "1rem" }}>{profileText.languageTitle}</div>
                      <div style={{ color: "#555", fontSize: ".76rem", fontWeight: 800, marginTop: 2, lineHeight: 1.35 }}>
                        {profileText.languageSubtitle}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <IonButton
                    expand="block"
                    color={language === "es" ? "success" : "medium"}
                    fill={language === "es" ? "solid" : "outline"}
                    onClick={() => handleLanguageChange("es")}
                    style={{ "--border-radius": "16px", height: "48px", fontWeight: 950 } as CSSProperties}
                  >
                    🇨🇱 {profileText.spanish}
                  </IonButton>
                  <IonButton
                    expand="block"
                    color={language === "en" ? "success" : "medium"}
                    fill={language === "en" ? "solid" : "outline"}
                    onClick={() => handleLanguageChange("en")}
                    style={{ "--border-radius": "16px", height: "48px", fontWeight: 950 } as CSSProperties}
                  >
                    🇺🇸 {profileText.english}
                  </IonButton>
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard style={rapagoProfileCard()}>
              <IonCardContent style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 16,
                      background: "rgba(34,197,94,.14)",
                      color: "#15803d",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IonIcon icon={lockClosedOutline} style={{ fontSize: 25 }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: "1rem" }}>{profileText.securityTitle}</div>
                    <div style={{ color: "#555", fontSize: ".76rem", fontWeight: 800, marginTop: 2, lineHeight: 1.35 }}>
                      {profileText.securitySubtitle}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ borderRadius: 18, background: "#ffffff", padding: 12, border: "1px solid rgba(210,164,58,.28)" }}>
                    <div style={{ color: "#8a6418", fontWeight: 950, fontSize: ".70rem" }}>{profileText.verifiedBadge}</div>
                    <div style={{ marginTop: 5, fontWeight: 950 }}>{profile.isVerified ? profileText.yes : profileText.no}</div>
                  </div>
                  <div style={{ borderRadius: 18, background: "#ffffff", padding: 12, border: "1px solid rgba(210,164,58,.28)" }}>
                    <div style={{ color: "#8a6418", fontWeight: 950, fontSize: ".70rem" }}>{profileText.status}</div>
                    <div style={{ marginTop: 5, fontWeight: 950 }}>{getProfileStatusLabel(profile.status, language)}</div>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard style={rapagoProfileCard()}>
              <IonCardContent style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 16,
                      background: "linear-gradient(135deg,#d2a43a,#f0d9aa)",
                      color: "#111",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IonIcon icon={personOutline} style={{ fontSize: 25 }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: "1.05rem" }}>{profileText.accountData}</div>
                    <div style={{ color: "#555", fontSize: ".76rem", fontWeight: 800, marginTop: 2, lineHeight: 1.35 }}>
                      {profileText.accountSubtitle}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {[
                    { icon: mailOutline, label: profileText.email, value: profile.email },
                    { icon: sparklesOutline, label: profileText.nationality, value: passengerFareLabel, helper: passengerFareDescription },
                    { icon: personOutline, label: profileText.role, value: accountRoleLabel },
                    { icon: shieldCheckmarkOutline, label: profileText.verified, value: profile.isVerified ? profileText.yes : profileText.no },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "34px 1fr",
                        gap: 10,
                        alignItems: "center",
                        borderRadius: 18,
                        background: "#ffffff",
                        padding: "10px 12px",
                        border: "1px solid rgba(210,164,58,.24)",
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 12,
                          background: "rgba(210,164,58,.14)",
                          color: "#8a6418",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IonIcon icon={item.icon} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "#6f4d12", fontSize: ".68rem", fontWeight: 950, textTransform: "uppercase" }}>
                          {item.label}
                        </div>
                        <div style={{ fontWeight: 950, fontSize: ".92rem", marginTop: 2, wordBreak: "break-word" }}>
                          {sanitizeProfileText(item.value, 180)}
                        </div>
                        {item.helper && (
                          <div style={{ color: "#666", fontSize: ".72rem", fontWeight: 750, marginTop: 2, lineHeight: 1.3 }}>
                            {item.helper}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <div style={{ color: "#666", fontSize: ".75rem", fontWeight: 850, padding: "0 2px" }}>
                    {profileText.memberSince} {new Date(profile.createdAt).toLocaleDateString(language === "en" ? "en-US" : "es-CL")}
                  </div>
                </div>
              </IonCardContent>
            </IonCard>

            {canOpenDriverMode && (
              <IonCard
                style={rapagoProfileCard({
                  background: "linear-gradient(135deg, rgba(17,17,17,.98), rgba(58,45,27,.97) 58%, rgba(210,164,58,.92))",
                  color: "#ffffff",
                  border: "1px solid rgba(210,164,58,.46)",
                })}
              >
                <IonCardContent style={{ padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 18,
                      background: "rgba(255,255,255,.14)",
                      border: "1px solid rgba(255,255,255,.18)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IonIcon icon={carOutline} style={{ fontSize: 28, color: "#F8D879" }} />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#BBF7D0", fontSize: ".68rem", fontWeight: 950, textTransform: "uppercase", marginBottom: 3 }}>
                      <IonIcon icon={checkmarkCircleOutline} />
                      {profileText.driverApproved}
                    </div>
                    <div style={{ fontWeight: 950, fontSize: "1.05rem", lineHeight: 1.15 }}>{profileText.driverMode}</div>
                    <div style={{ marginTop: 3, color: "rgba(255,255,255,.76)", fontSize: ".74rem", fontWeight: 750, lineHeight: 1.28 }}>
                      {profileText.driverModeSubtitle}
                    </div>
                  </div>

                  <IonButton
                    size="small"
                    onClick={handleGoToDriverMode}
                    style={
                      {
                        "--border-radius": "999px",
                        "--background": "linear-gradient(135deg, #D8A83E 0%, #F0D9AA 100%)",
                        "--background-activated": "#d2a43a",
                        "--color": "#111111",
                        height: "42px",
                        minHeight: "42px",
                        fontWeight: 950,
                        fontSize: ".76rem",
                        margin: 0,
                        flexShrink: 0,
                      } as CSSProperties
                    }
                  >
                    <IonIcon icon={enterOutline} slot="start" />
                    {profileText.switchDriver}
                  </IonButton>
                </IonCardContent>
              </IonCard>
            )}

            <IonCard style={rapagoProfileCard()}>
              <IonCardContent style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 16,
                      background: "rgba(210,164,58,.16)",
                      color: "#8a6418",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IonIcon icon={saveOutline} style={{ fontSize: 24 }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: "1.05rem" }}>{profileText.editProfile}</div>
                    <div style={{ color: "#555", fontSize: ".76rem", fontWeight: 800, marginTop: 2, lineHeight: 1.35 }}>
                      {profileText.editSubtitle}
                    </div>
                  </div>
                </div>

                <IonItem lines="none" style={rapagoInputStyle()}>
                  <IonLabel position="stacked" style={rapagoLabelStyle()}>{profileText.name}</IonLabel>
                  <IonInput
                    style={rapagoFieldStyle()}
                    value={nameInput}
                    onIonInput={(e) => setNameInput(sanitizeProfileText(e.detail.value, 100))}
                    placeholder={profileText.namePlaceholder}
                    maxlength={100}
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" style={rapagoInputStyle()}>
                  <IonLabel position="stacked" style={rapagoLabelStyle()}>{profileText.phone}</IonLabel>
                  <IonInput
                    style={rapagoFieldStyle()}
                    value={phoneInput}
                    onIonInput={(e) => setPhoneInput(sanitizeProfilePhone(e.detail.value))}
                    placeholder={profileText.phonePlaceholder}
                    type="tel"
                    maxlength={20}
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" style={rapagoInputStyle()}>
                  <IonLabel position="stacked" style={rapagoLabelStyle()}>{profileText.nationality}</IonLabel>
                  <IonInput
                    style={rapagoFieldStyle()}
                    value={passengerFareLabel}
                    readonly
                  />
                  <IonNote slot="helper" style={{ fontSize: ".70rem", fontWeight: 750 }}>
                    {profileText.fareHelper}
                  </IonNote>
                </IonItem>

                <div
                  style={{
                    marginTop: 12,
                    padding: 14,
                    borderRadius: 20,
                    background: "linear-gradient(135deg,#ffffff 0%,#fff8e6 100%)",
                    border: "1.5px dashed rgba(210,164,58,.62)",
                    boxShadow: "0 12px 26px rgba(0,0,0,.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 70,
                        height: 70,
                        borderRadius: 22,
                        overflow: "hidden",
                        background: "linear-gradient(135deg,#2dd36f,#d2a43a)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 950,
                        fontSize: "1.18rem",
                        boxShadow: "0 12px 24px rgba(0,0,0,.18)",
                        flexShrink: 0,
                      }}
                    >
                      {getSafePassengerProfilePhotoSource(avatarInput) ? (
                        <img
                          src={getSafePassengerProfilePhotoSource(avatarInput)}
                          alt="Foto de perfil"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        sanitizeProfileText(nameInput || profile.name || session?.user?.email || "R", 40)
                          .split(" ")
                          .slice(0, 2)
                          .map((word) => word[0] ?? "")
                          .join("")
                          .toUpperCase() || "R"
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 950, color: "#111", fontSize: ".95rem" }}>
                        {profileText.avatarUrl}
                      </div>
                      <div style={{ color: "#555", fontSize: ".76rem", fontWeight: 800, lineHeight: 1.35, marginTop: 3 }}>
                        {profileText.avatarHelper}
                      </div>
                      {getSafePassengerProfilePhotoSource(avatarInput) && (
                        <div style={{ color: "#0F8A3A", fontSize: ".74rem", fontWeight: 950, marginTop: 5 }}>
                          ✓ {profileText.avatarSelected}
                        </div>
                      )}
                    </div>
                  </div>

                  <input
                    ref={avatarPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarPhotoChange}
                    style={{ display: "none" }}
                  />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: getSafePassengerProfilePhotoSource(avatarInput) ? "1fr 1fr" : "1fr",
                      gap: 10,
                      marginTop: 14,
                    }}
                  >
                    <IonButton
                      expand="block"
                      color="success"
                      onClick={() => avatarPhotoInputRef.current?.click()}
                      style={{ "--border-radius": "16px", height: "48px", fontWeight: 950 } as CSSProperties}
                    >
                      <IonIcon icon={cameraOutline} slot="start" />
                      {getSafePassengerProfilePhotoSource(avatarInput) ? profileText.avatarChange : profileText.avatarAttach}
                    </IonButton>

                    {getSafePassengerProfilePhotoSource(avatarInput) && (
                      <IonButton
                        expand="block"
                        fill="outline"
                        color="danger"
                        onClick={handleRemoveAvatarPhoto}
                        style={{ "--border-radius": "16px", height: "48px", fontWeight: 950 } as CSSProperties}
                      >
                        <IonIcon icon={trashOutline} slot="start" />
                        {profileText.avatarRemove}
                      </IonButton>
                    )}
                  </div>

                  {avatarPhotoError && (
                    <IonText color="danger">
                      <p style={{ margin: "8px 0 0", fontSize: ".78rem", fontWeight: 850 }}>
                        {avatarPhotoError}
                      </p>
                    </IonText>
                  )}
                </div>

                {saveSuccess && (
                  <IonText color="success">
                    <p style={{ margin: "10px 0 0", fontSize: ".85rem", fontWeight: 900 }}>✓ {profileText.saved}</p>
                  </IonText>
                )}
                {saveError && (
                  <IonText color="danger">
                    <p style={{ margin: "10px 0 0", fontSize: ".85rem", fontWeight: 900 }}>{saveError}</p>
                  </IonText>
                )}

                <IonButton
                  expand="block"
                  color="warning"
                  style={{ "--border-radius": "18px", "--color": "#111", height: "52px", marginTop: 16, fontWeight: 950 } as CSSProperties}
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? <IonSpinner name="dots" /> : profileText.save}
                </IonButton>
              </IonCardContent>
            </IonCard>

            <IonCard style={rapagoProfileCard({ background: "linear-gradient(135deg,#fff7dc,#f6f2ec)" })}>
              <IonCardContent style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 16,
                      background: "linear-gradient(135deg,#d2a43a,#f0d9aa)",
                      color: "#111",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IonIcon icon={giftOutline} style={{ fontSize: 25 }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: "1.05rem" }}>{profileText.inviteTitle}</div>
                    <div style={{ color: "#555", fontSize: ".76rem", fontWeight: 800, marginTop: 2, lineHeight: 1.35 }}>
                      {profileText.inviteSubtitle}
                    </div>
                  </div>
                </div>

                {referral && referral.code ? (
                  <>
                    <div
                      style={{
                        borderRadius: 18,
                        background: "#ffffff",
                        border: "1px solid rgba(210,164,58,.35)",
                        padding: "13px 14px",
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ color: "#8a6418", fontWeight: 950, fontSize: ".70rem", textTransform: "uppercase" }}>
                        {profileText.yourCode}
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: "1.35rem", fontWeight: 950, marginTop: 3 }}>
                        {sanitizeProfileText(referral.code, 40)}
                      </div>
                      <div style={{ marginTop: 8, color: "#555", fontSize: ".78rem", fontWeight: 800, lineHeight: 1.35 }}>
                        {profileText.invited} <strong>{referral.usedCount}</strong> {profileText.people} · {profileText.earned} <strong>${referral.totalReward.toLocaleString(language === "en" ? "en-US" : "es-CL")} CLP</strong>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <IonButton
                        expand="block"
                        color="warning"
                        onClick={() => void handleCopyCode(referral.code)}
                        style={{ "--border-radius": "16px", "--color": "#111", fontWeight: 950 } as CSSProperties}
                      >
                        <IonIcon icon={copyOutline} slot="start" />
                        {copiedCode ? profileText.copied : profileText.copyCode}
                      </IonButton>
                      <IonButton
                        expand="block"
                        fill="outline"
                        color="dark"
                        onClick={() => {
                          const shareData = { title: profileText.shareTitle, text: profileText.shareText, url: referral.link };
                          if (navigator.share) {
                            void navigator.share(shareData);
                          } else {
                            void handleCopyCode(referral.link);
                          }
                        }}
                        style={{ "--border-radius": "16px", fontWeight: 950 } as CSSProperties}
                      >
                        <IonIcon icon={shareSocialOutline} slot="start" />
                        {profileText.shareLink}
                      </IonButton>
                    </div>
                  </>
                ) : (
                  <IonButton
                    expand="block"
                    color="warning"
                    onClick={() => void handleGenerateCode()}
                    disabled={generatingCode}
                    style={{ "--border-radius": "18px", "--color": "#111", height: "52px", fontWeight: 950 } as CSSProperties}
                  >
                    {generatingCode ? <IonSpinner name="dots" /> : profileText.generateCode}
                  </IonButton>
                )}
              </IonCardContent>
            </IonCard>

            <AccountDeletionCard
              requesterSnapshot={{
                phone: phoneInput.trim() || null,
                rut: readStoredRegistrationProfile().rut ?? null,
                passengerType: passengerFareType,
                sourceView: "passenger",
              }}
            />

            <IonCard style={rapagoProfileCard({ marginBottom: 20 })}>
              <IonCardContent style={{ padding: 16 }}>
                <IonButton
                  expand="block"
                  color="danger"
                  fill="outline"
                  onClick={() => void handleLogout()}
                  disabled={saving}
                  style={{ "--border-radius": "18px", height: "52px", fontWeight: 950 } as CSSProperties}
                >
                  <IonIcon icon={exitOutline} slot="start" />
                  {profileText.logout}
                </IonButton>
              </IonCardContent>
            </IonCard>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}

export function ProfileDocumentsPage(): JSX.Element {
  return <DocumentsPage />;
}

type DocumentRecord = import("../../../features/documents/documents.service").DocumentRecord;

function DocumentsPage(): JSX.Element {
  const { session, user } = useAuth();

  const [docs,       setDocs]       = useState<DocumentRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [creating,   setCreating]   = useState<string | null>(null);
  const [createErr,  setCreateErr]  = useState<string | null>(null);

  // Upload metadata form state
  const [uploadDocId,   setUploadDocId]   = useState<string | null>(null);
  const [fileName,      setFileName]      = useState("");
  const [fileMimeType,  setFileMimeType]  = useState("image/jpeg");
  const [fileSizeMB,    setFileSizeMB]    = useState("");
  const [uploading,     setUploading]     = useState(false);
  const [uploadErr,     setUploadErr]     = useState<string | null>(null);

  const role = user?.role ?? "";

  const requiredTypes: readonly string[] = (
    (role in ROLE_REQUIRED_DOCS) ? ROLE_REQUIRED_DOCS[role] : []
  ) as readonly string[];

  useEffect(() => {
    if (!session?.accessToken) return;
    setLoading(true);
    documentsService
      .listDocuments(session.accessToken)
      .then(setDocs)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Error al cargar documentos."))
      .finally(() => setLoading(false));
  }, [session?.accessToken]);

  async function handlePrepare(documentType: string) {
    if (!session?.accessToken) return;
    setCreating(documentType);
    setCreateErr(null);
    try {
      const doc = await documentsService.createDocument(session.accessToken, documentType);
      setDocs((prev) => [...prev, doc]);
    } catch (e: unknown) {
      setCreateErr(e instanceof Error ? e.message : "Error al preparar el documento.");
    } finally {
      setCreating(null);
    }
  }

  async function handleUploadMetadata() {
    if (!session?.accessToken || !uploadDocId) return;
    const sizeBytes = Math.round(parseFloat(fileSizeMB) * 1024 * 1024);
    if (!fileName.trim() || fileName.trim().length < 3) {
      setUploadErr("El nombre de archivo debe tener al menos 3 caracteres.");
      return;
    }
    if (!fileSizeMB || isNaN(sizeBytes) || sizeBytes <= 0) {
      setUploadErr("El tamaño debe ser mayor a 0.");
      return;
    }
    if (sizeBytes > 10 * 1024 * 1024) {
      setUploadErr("El tamaño no puede superar 10 MB.");
      return;
    }
    setUploading(true);
    setUploadErr(null);
    try {
      const updated = await documentsService.uploadMetadata(session.accessToken, uploadDocId, {
        fileName:      fileName.trim(),
        fileMimeType,
        fileSizeBytes: sizeBytes,
      });
      setDocs((prev) => prev.map((d) => (d.id === uploadDocId ? updated : d)));
      setUploadDocId(null);
      setFileName("");
      setFileSizeMB("");
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : "Error al registrar metadata.");
    } finally {
      setUploading(false);
    }
  }

  const docByType = Object.fromEntries(docs.map((d) => [d.documentType, d]));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Documentos</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Notice */}
        <div style={{
          background: "var(--ion-color-warning-tint)",
          border: "1px solid var(--ion-color-warning)",
          borderRadius: "8px",
          padding: "10px 14px",
          marginBottom: "16px",
          fontSize: "0.82rem",
          color: "var(--ion-color-warning-shade)",
        }}>
          <strong>Carga real de archivos se implementará en fase futura.</strong><br />
          Esta fase solo registra metadata del documento. No se sube ningún archivo al servidor.
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && requiredTypes.length === 0 && (
          <IonText color="medium"><p>Este rol no requiere documentos.</p></IonText>
        )}

        {!loading && requiredTypes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {requiredTypes.map((docType) => {
              const existing = docByType[docType];
              const label = DOCUMENT_LABEL[docType] ?? docType;
              const status = existing?.status ?? null;
              const statusColor = status ? DOC_STATUS_COLOR[status] ?? "medium" : "medium";
              const statusText  = status ? DOC_STATUS_LABEL[status]  ?? status  : "No registrado";
              const canUpload   = existing && (existing.status === "pending" || existing.status === "rejected");
              const isExpanded  = uploadDocId === existing?.id;

              return (
                <IonCard key={docType} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "4px" }}>{label}</div>
                        <IonBadge color={statusColor} style={{ fontSize: "0.7rem" }}>{statusText}</IonBadge>
                        {existing?.rejectionReason && (
                          <IonText color="danger">
                            <p style={{ margin: "6px 0 0", fontSize: "0.78rem" }}>
                              Motivo: {existing.rejectionReason}
                            </p>
                          </IonText>
                        )}
                        {existing?.fileUrl && (
                          <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--ion-color-medium)", wordBreak: "break-all" }}>
                            {existing.fileUrl}
                          </p>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                        {!existing && (
                          <IonButton
                            size="small"
                            fill="outline"
                            disabled={creating === docType}
                            onClick={() => void handlePrepare(docType)}
                          >
                            {creating === docType ? <IonSpinner name="dots" /> : "Preparar"}
                          </IonButton>
                        )}
                        {canUpload && (
                          <IonButton
                            size="small"
                            fill="outline"
                            color="primary"
                            onClick={() => {
                              if (isExpanded) {
                                setUploadDocId(null);
                              } else {
                                setUploadDocId(existing.id);
                                setFileName("");
                                setFileMimeType("image/jpeg");
                                setFileSizeMB("");
                                setUploadErr(null);
                              }
                            }}
                          >
                            {isExpanded ? "Cancelar" : "Marcar subido"}
                          </IonButton>
                        )}
                      </div>
                    </div>

                    {/* Upload metadata form */}
                    {isExpanded && (
                      <div style={{ marginTop: "12px", borderTop: "1px solid var(--ion-color-light-shade)", paddingTop: "10px" }}>
                        <IonItem lines="full">
                          <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Nombre del archivo</IonLabel>
                          <IonInput
                            value={fileName}
                            onIonInput={(e) => setFileName(String(e.detail.value ?? ""))}
                            placeholder="ej: cedula_frente.jpg"
                          />
                        </IonItem>
                        <IonItem lines="full">
                          <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Tipo de archivo</IonLabel>
                          <IonSelect
                            value={fileMimeType}
                            onIonChange={(e) => setFileMimeType(String(e.detail.value ?? "image/jpeg"))}
                            interface="popover"
                          >
                            <IonSelectOption value="image/jpeg">JPEG (imagen)</IonSelectOption>
                            <IonSelectOption value="image/png">PNG (imagen)</IonSelectOption>
                            <IonSelectOption value="application/pdf">PDF</IonSelectOption>
                          </IonSelect>
                        </IonItem>
                        <IonItem lines="none">
                          <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Tamaño en MB (máx 10)</IonLabel>
                          <IonInput
                            type="number"
                            value={fileSizeMB}
                            onIonInput={(e) => setFileSizeMB(String(e.detail.value ?? ""))}
                            placeholder="ej: 1.5"
                            min="0.001"
                            max="10"
                          />
                        </IonItem>
                        {uploadErr && (
                          <IonText color="danger">
                            <p style={{ fontSize: "0.78rem", margin: "6px 0" }}>{uploadErr}</p>
                          </IonText>
                        )}
                        <IonButton
                          expand="block"
                          size="small"
                          style={{ marginTop: "8px" }}
                          onClick={() => void handleUploadMetadata()}
                          disabled={uploading}
                        >
                          {uploading ? <IonSpinner name="dots" /> : "Registrar metadata"}
                        </IonButton>
                      </div>
                    )}
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        {createErr && (
          <IonText color="danger">
            <p style={{ marginTop: "12px", fontSize: "0.85rem" }}>{createErr}</p>
          </IonText>
        )}
      </IonContent>
    </IonPage>
  );
}

export function ProfileBankAccountPage(): JSX.Element {
  return <BankAccountPage />;
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: "Cuenta corriente",
  savings:  "Cuenta de ahorro",
  vista:    "Cuenta vista",
};

const BANK_OPTIONS = [
  "Banco de Chile", "BancoEstado", "Santander", "BCI", "Scotiabank",
  "Itaú", "BICE", "Security", "Falabella", "Ripley", "Coopeuch", "Otro",
];

function BankAccountPage(): JSX.Element {
  const { session } = useAuth();

  const [account,     setAccount]     = useState<BankAccountData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);

  const [holderInput, setHolderInput] = useState("");
  const [bankInput,   setBankInput]   = useState("");
  const [typeInput,   setTypeInput]   = useState<"checking" | "savings" | "vista">("checking");
  const [numInput,    setNumInput]    = useState("");

  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadAccount = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await bankAccountService.getBankAccount(session.accessToken);
      setAccount(data);
      if (data) {
        setHolderInput(data.accountHolderName);
        setBankInput(data.bankName);
        setTypeInput(data.accountType as "checking" | "savings" | "vista");
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar la cuenta bancaria.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadAccount(); }, [loadAccount]);

  async function handleSave() {
    if (!session?.accessToken) return;
    const trimHolder = holderInput.trim();
    const trimBank   = bankInput.trim();
    const trimNum    = numInput.trim();

    if (!trimHolder || !trimBank || !trimNum) {
      setSaveError("Completa todos los campos requeridos.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await bankAccountService.upsertBankAccount(session.accessToken, {
        accountHolderName: trimHolder,
        bankName:          trimBank,
        accountType:       typeInput,
        accountNumber:     trimNum,
      });
      setAccount(updated);
      setHolderInput(updated.accountHolderName);
      setBankInput(updated.bankName);
      setTypeInput(updated.accountType as "checking" | "savings" | "vista");
      setNumInput("");
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar la cuenta bancaria.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Cuenta Bancaria</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Notice — pagos futuros */}
        <div style={{
          background:    "var(--ion-color-warning-tint)",
          border:        "1px solid var(--ion-color-warning)",
          borderRadius:  "8px",
          padding:       "10px 14px",
          marginBottom:  "16px",
          fontSize:      "0.82rem",
          color:         "var(--ion-color-warning-shade)",
        }}>
          <strong>Los pagos reales se implementarán en una fase futura.</strong><br />
          Puedes registrar tu cuenta bancaria ahora. El procesamiento de pagos estará disponible próximamente.
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && (
          <>
            {/* Current account info */}
            {account && (
              <IonCard style={{ marginBottom: "16px" }}>
                <IonCardHeader>
                  <IonCardTitle style={{ fontSize: "1rem" }}>Cuenta registrada</IonCardTitle>
                </IonCardHeader>
                <IonCardContent style={{ paddingTop: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem" }}>
                    <div><strong>Titular:</strong> {account.accountHolderName}</div>
                    <div><strong>Banco:</strong> {account.bankName}</div>
                    <div><strong>Tipo:</strong> {ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType}</div>
                    <div><strong>Número:</strong> •••• {account.accountNumberLast4}</div>
                    <div>
                      <strong>Estado:</strong>{" "}
                      <IonBadge color={account.status === "active" ? "success" : "warning"} style={{ fontSize: "0.7rem" }}>
                        {account.status === "active" ? "Activa" : "Pendiente"}
                      </IonBadge>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            )}

            {/* Form */}
            <IonCard>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: "1rem" }}>
                  {account ? "Actualizar cuenta bancaria" : "Registrar cuenta bancaria"}
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent style={{ paddingTop: 0 }}>

                <IonItem lines="full">
                  <IonLabel position="stacked">Nombre del titular</IonLabel>
                  <IonInput
                    value={holderInput}
                    onIonInput={(e) => setHolderInput(String(e.detail.value ?? ""))}
                    placeholder="Nombre completo del titular"
                    maxlength={150}
                    clearInput
                  />
                </IonItem>

                <IonItem lines="full" style={{ marginTop: "8px" }}>
                  <IonLabel position="stacked">Banco</IonLabel>
                  <IonInput
                    value={bankInput}
                    onIonInput={(e) => setBankInput(String(e.detail.value ?? ""))}
                    placeholder={BANK_OPTIONS.slice(0, 3).join(", ") + "..."}
                    maxlength={100}
                    clearInput
                  />
                </IonItem>

                <IonItem lines="full" style={{ marginTop: "8px" }}>
                  <IonLabel position="stacked">Tipo de cuenta</IonLabel>
                  <select
                    value={typeInput}
                    onChange={(e) => setTypeInput(e.target.value as "checking" | "savings" | "vista")}
                    style={{
                      width: "100%", padding: "10px 0", background: "transparent",
                      border: "none", fontSize: "1rem", color: "var(--ion-text-color)",
                    }}
                  >
                    <option value="checking">Cuenta corriente</option>
                    <option value="savings">Cuenta de ahorro</option>
                    <option value="vista">Cuenta vista</option>
                  </select>
                </IonItem>

                <IonItem lines="none" style={{ marginTop: "8px" }}>
                  <IonLabel position="stacked">
                    Número de cuenta{account ? ` (actual: •••• ${account.accountNumberLast4})` : ""}
                  </IonLabel>
                  <IonInput
                    value={numInput}
                    onIonInput={(e) => setNumInput(String(e.detail.value ?? ""))}
                    placeholder={account ? "Ingresa el número para confirmar cambios" : "Solo dígitos"}
                    type="tel"
                    maxlength={20}
                    clearInput
                  />
                  <IonNote slot="helper" style={{ fontSize: "0.7rem" }}>
                    Solo se guardarán los últimos 4 dígitos. Requerido para guardar.
                  </IonNote>
                </IonItem>

                {saveSuccess && (
                  <IonText color="success">
                    <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>✓ Cuenta bancaria guardada correctamente.</p>
                  </IonText>
                )}
                {saveError && (
                  <IonText color="danger">
                    <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>{saveError}</p>
                  </IonText>
                )}

                <IonButton
                  expand="block"
                  style={{ marginTop: "16px" }}
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? <IonSpinner name="dots" /> : (account ? "Actualizar cuenta" : "Guardar cuenta")}
                </IonButton>
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}

export function ProfileSecurityPage(): JSX.Element {
  const history = useHistory();
  const { session, user, refreshSession } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [linkingFacebook, setLinkingFacebook] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const authProviders = user?.authProviders ?? [];
  const hasPassword =
    user?.hasPassword === true || authProviders.includes("password");
  const facebookLinked = authProviders.includes("facebook");

  useEffect(() => {
    const linkStatus = new URLSearchParams(
      window.location.search,
    ).get("facebookLink");

    if (!linkStatus) return;

    if (linkStatus === "success") {
      setSuccess("Facebook quedó vinculado correctamente.");
      setError("");
      void refreshSession();
    } else if (linkStatus === "already-linked") {
      setError(
        "Esa cuenta de Facebook ya está vinculada a otra cuenta RAPA GO.",
      );
    } else {
      setError(
        "No se pudo vincular Facebook. Inicia el proceso nuevamente.",
      );
    }

    history.replace(ROUTES.PROFILE.SECURITY);
  }, [history, refreshSession]);

  async function createBackupPassword(): Promise<void> {
    if (!session?.accessToken) {
      setError("Debes iniciar sesión nuevamente.");
      return;
    }

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSavingPassword(true);
    setError("");
    setSuccess("");

    try {
      const result = await authService.createPassword(
        session.accessToken,
        { newPassword, confirmPassword },
      );

      setNewPassword("");
      setConfirmPassword("");
      setSuccess(result.message);
      await refreshSession();
    } catch (passwordError) {
      setError(
        passwordError instanceof Error
          ? passwordError.message
          : "No se pudo crear la contraseña.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function linkFacebook(): Promise<void> {
    if (!session?.accessToken) {
      setError("Debes iniciar sesión nuevamente.");
      return;
    }

    setLinkingFacebook(true);
    setError("");
    setSuccess("");

    try {
      const authorizationUrl = await authService.startFacebookLink(
        session.accessToken,
      );
      window.location.assign(authorizationUrl);
    } catch (linkError) {
      setError(
        linkError instanceof Error
          ? linkError.message
          : "No se pudo iniciar la vinculación.",
      );
      setLinkingFacebook(false);
    }
  }

  const cardStyle = {
    borderRadius: 22,
    border: "1px solid rgba(210,164,58,.35)",
    boxShadow: "0 14px 34px rgba(65,34,20,.10)",
  } as CSSProperties;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonButton onClick={() => history.goBack()}>
              <IonIcon icon={arrowBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>Seguridad de la cuenta</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent
        className="ion-padding"
        style={{
          "--background": "linear-gradient(180deg,#fff7e8,#eed5a4)",
        } as CSSProperties}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", paddingBottom: 80 }}>
          {success && (
            <IonText color="success">
              <p style={{ fontWeight: 900 }}>{success}</p>
            </IonText>
          )}

          {error && (
            <IonText color="danger">
              <p style={{ fontWeight: 900 }}>{error}</p>
            </IonText>
          )}

          <IonCard style={cardStyle}>
            <IonCardHeader>
              <IonCardTitle>Formas de ingreso</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div style={{ display: "grid", gap: 10 }}>
                <IonItem lines="none">
                  <IonIcon icon={mailOutline} slot="start" />
                  <IonLabel>
                    <strong>Correo de la cuenta</strong>
                    <p>{user?.email ?? "No disponible"}</p>
                  </IonLabel>
                </IonItem>

                <IonItem lines="none">
                  <IonIcon icon={keyOutline} slot="start" />
                  <IonLabel>
                    <strong>Correo y contraseña</strong>
                    <p>{hasPassword ? "Configurado" : "Sin contraseña de respaldo"}</p>
                  </IonLabel>
                  <IonBadge color={hasPassword ? "success" : "warning"}>
                    {hasPassword ? "Activo" : "Pendiente"}
                  </IonBadge>
                </IonItem>

                <IonItem lines="none">
                  <IonIcon icon={logoFacebook} slot="start" />
                  <IonLabel>
                    <strong>Facebook</strong>
                    <p>{facebookLinked ? "Vinculado de forma segura" : "No vinculado"}</p>
                  </IonLabel>
                  <IonBadge color={facebookLinked ? "success" : "medium"}>
                    {facebookLinked ? "Activo" : "Disponible"}
                  </IonBadge>
                </IonItem>
              </div>
            </IonCardContent>
          </IonCard>

          {!hasPassword && (
            <IonCard style={cardStyle}>
              <IonCardHeader>
                <IonCardTitle>Crear contraseña de respaldo</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <p style={{ color: "#5b4632", fontWeight: 750 }}>
                  Podrás seguir entrando con Facebook y también recuperar el
                  acceso mediante tu correo verificado.
                </p>

                <IonItem>
                  <IonLabel position="stacked">Nueva contraseña</IonLabel>
                  <IonInput
                    type="password"
                    value={newPassword}
                    minlength={8}
                    maxlength={128}
                    autocomplete="new-password"
                    onIonInput={(event) =>
                      setNewPassword(String(event.detail.value ?? ""))
                    }
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Repetir contraseña</IonLabel>
                  <IonInput
                    type="password"
                    value={confirmPassword}
                    minlength={8}
                    maxlength={128}
                    autocomplete="new-password"
                    onIonInput={(event) =>
                      setConfirmPassword(String(event.detail.value ?? ""))
                    }
                  />
                </IonItem>

                <IonButton
                  expand="block"
                  color="warning"
                  disabled={savingPassword}
                  onClick={() => void createBackupPassword()}
                  style={{ marginTop: 14, fontWeight: 950 } as CSSProperties}
                >
                  {savingPassword ? <IonSpinner name="dots" /> : "Crear contraseña"}
                </IonButton>
              </IonCardContent>
            </IonCard>
          )}

          <IonCard style={cardStyle}>
            <IonCardHeader>
              <IonCardTitle>Vinculación segura</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <p style={{ color: "#5b4632", fontWeight: 750 }}>
                RAPA GO nunca fusiona cuentas solo porque tengan el mismo correo.
                Para vincular Facebook debes iniciar sesión en RAPA GO y autorizar
                expresamente el proveedor.
              </p>

              <IonButton
                expand="block"
                color="primary"
                disabled={facebookLinked || linkingFacebook}
                onClick={() => void linkFacebook()}
                style={{ fontWeight: 950 } as CSSProperties}
              >
                <IonIcon icon={linkOutline} slot="start" />
                {facebookLinked
                  ? "Facebook ya está vinculado"
                  : linkingFacebook
                    ? "Abriendo Facebook..."
                    : "Vincular Facebook"}
              </IonButton>

              <IonButton
                expand="block"
                fill="outline"
                color="dark"
                onClick={() => history.push("/auth/forgot-password")}
                style={{ marginTop: 10, fontWeight: 900 } as CSSProperties}
              >
                Recuperar o cambiar contraseña por correo
              </IonButton>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
}

export function ProfileNotificationsPage(): JSX.Element {
  const m = meta("/profile/notifications");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export default ProfileIndexPage;
