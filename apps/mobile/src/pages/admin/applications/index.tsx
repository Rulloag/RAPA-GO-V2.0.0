import {
  IonAlert,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import {
  carOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  documentTextOutline,
  downloadOutline,
  eyeOutline,
  hourglassOutline,
  mailOutline,
  schoolOutline,
  shieldCheckmarkOutline,
  imageOutline,
  refreshOutline,
  timeOutline,
} from "ionicons/icons";
import { useRef, useState, type CSSProperties } from "react";
import { useAuth } from "../../../features/auth/index.js";
import {
  applicationsService,
  type ApplicationData,
} from "../../../features/applications/applications.service.js";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  under_review: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  on_hold: "En espera",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "warning",
  under_review: "tertiary",
  approved: "success",
  rejected: "danger",
  on_hold: "medium",
};

const TYPE_LABEL: Record<string, string> = {
  driver: "Conductor",
  guide: "Guía",
  rental_operator: "Operador de arriendo",
};

type AnyRecord = Record<string, unknown>;

type DriverVehicleView = {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  year: string | null;
  plate: string | null;
  color: string | null;
  photoUrl: string | null;
  isMain: boolean;
};

type DocumentView = {
  key: string;
  label: string;
  url: string | null;
  fileName: string | null;
  helper: string;
};

const APPLICATION_LOCAL_KEYS = [
  "rapago_driver_application",
  "rapago_driver_application_submitted",
  "rapago_pending_driver_application",
  "rapago_last_driver_application",
  "rapago_application_driver",
  "rapago_applications_driver",
  "rapago_driver_applications",
  "rapago_applications_cache",
  "rapago_registration_driver_application",
  "rapago_driver_application_v1",
  "rapago_driver_application_draft_v1",
  "rapago_admin_driver_applications_v1",
  "rapago_driver_apply_form_v1",
  "rapago_driver_apply_documents_v1",
  "rapago_driver_documents_v1",
  "rapago_driver_document_images_v1",
  "rapago_driver_vehicle_images_v1",
  "rapago_driver_vehicle_photo_v1",
  "rapago_driver_profile_v1",
  "rapago_driver_public_profile_v1",
  "rapago_current_user",
  "rapago_auth_user",
  "rapago_user",
  "rapago_session",
];

const APPLICATION_LOCAL_KEY_HINTS = [
  "rapago",
  "driver",
  "conductor",
  "application",
  "postulacion",
  "postulacion",
  "documents",
  "documentos",
  "images",
  "imagenes",
  "photo",
  "foto",
  "vehicle",
  "vehiculo",
  "profile",
  "perfil",
  "register",
  "registro",
];

const APPLICATION_FILE_KEY_HINTS = [
  "idfront",
  "idback",
  "identityfront",
  "identityback",
  "identitycardfront",
  "identitycardback",
  "identitycardfrontdataurl",
  "identitycardbackdataurl",
  "carnetfrente",
  "carnetreverso",
  "cedulafrente",
  "cedulareverso",
  "dnifrente",
  "dnireverso",
  "licensefront",
  "licenseback",
  "driverlicenseback",
  "drivinglicenseback",
  "licensereverso",
  "licensetrasera",
  "licenseposterior",
  "licenciafrente",
  "licenciareverso",
  "licenciaback",
  "licenciatrasera",
  "licenciaposterior",
  "profilephoto",
  "profileimage",
  "fotoperfil",
  "vehiclephoto",
  "vehicleimage",
  "carphoto",
  "autophoto",
  "fotovehiculo",
  "vehiculofoto",
];

const detailSectionStyle: CSSProperties = {
  margin: "0 0 14px",
  borderRadius: "22px",
  background: "#F6F2EC",
  color: "#111",
  border: "1px solid rgba(210,164,58,.42)",
  boxShadow: "0 14px 30px rgba(0,0,0,.16)",
};

const rowCardStyle: CSSProperties = {
  "--background": "#ffffff",
  "--color": "#111111",
  "--padding-start": "14px",
  "--inner-padding-end": "10px",
  "--min-height": "76px",
  marginBottom: "10px",
  borderRadius: "18px",
  border: "1px solid rgba(210,164,58,.34)",
  overflow: "hidden",
} as CSSProperties;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "No informado";

  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return iso;

  return new Date(iso).toLocaleDateString("es-CL");
}

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeUrl(value: unknown): string | null {
  if (value && typeof value === "object") {
    const record = value as AnyRecord;
    const nested =
      record.url ??
      record.fileUrl ??
      record.publicUrl ??
      record.downloadUrl ??
      record.dataUrl ??
      record.previewUrl ??
      record.imageUrl ??
      record.photoUrl ??
      record.src ??
      record.href ??
      record.base64 ??
      record.data ??
      record.value;

    const normalizedNested = normalizeUrl(nested);
    if (normalizedNested) return normalizedNested;
  }

  const raw = normalizeString(value);
  if (!raw) return null;

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("blob:") ||
    raw.startsWith("data:") ||
    raw.startsWith("/")
  ) {
    return raw;
  }

  // Soporta imágenes base64 guardadas en localStorage sin prefijo data:image.
  if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 120) {
    return `data:image/jpeg;base64,${raw}`;
  }

  return raw;
}

function readStringByKeys(source: unknown, keys: string[], depth = 0): string | null {
  if (depth > 5) return null;

  const record = asRecord(source);
  if (!record) return null;

  for (const key of keys) {
    const direct = normalizeString(record[key]);
    if (direct) return direct;

    const urlRecord = asRecord(record[key]);
    if (urlRecord) {
      const directUrl =
        normalizeString(urlRecord.url) ??
        normalizeString(urlRecord.fileUrl) ??
        normalizeString(urlRecord.dataUrl) ??
        normalizeString(urlRecord.previewUrl) ??
        normalizeString(urlRecord.base64) ??
        normalizeString(urlRecord.value);

      if (directUrl) return directUrl;
    }
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = readStringByKeys(item, keys, depth + 1);
        if (nested) return nested;
      }
      continue;
    }

    if (typeof value === "object" && value !== null) {
      const nested = readStringByKeys(value, keys, depth + 1);
      if (nested) return nested;
    }
  }

  return null;
}

function readUrlByKeys(source: unknown, keys: string[], depth = 0): string | null {
  return normalizeUrl(readStringByKeys(source, keys, depth));
}

function readArrayByKeys(source: unknown, keys: string[], depth = 0): unknown[] | null {
  if (depth > 5) return null;

  const record = asRecord(source);
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = readArrayByKeys(item, keys, depth + 1);
        if (nested) return nested;
      }
      continue;
    }

    if (typeof value === "object" && value !== null) {
      const nested = readArrayByKeys(value, keys, depth + 1);
      if (nested) return nested;
    }
  }

  return null;
}


function normalizeLooseKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function buildFileKeyCandidates(keys: string[]): string[] {
  const suffixes = [
    "",
    "Url",
    "URL",
    "DataUrl",
    "dataUrl",
    "Base64",
    "base64",
    "PreviewUrl",
    "previewUrl",
    "FileUrl",
    "fileUrl",
    "ImageUrl",
    "imageUrl",
    "PhotoUrl",
    "photoUrl",
    "File",
    "file",
    "Image",
    "image",
    "Photo",
    "photo",
    "Src",
    "src",
  ];

  const seen = new Set<string>();

  for (const key of keys) {
    seen.add(key);
    for (const suffix of suffixes) {
      seen.add(`${key}${suffix}`);
    }
  }

  return Array.from(seen);
}

function localStorageKeyLooksUsefulForApplication(key: string): boolean {
  const normalized = normalizeLooseKey(key);
  if (!normalized.includes("rapago")) return false;

  return APPLICATION_LOCAL_KEY_HINTS.some((hint) =>
    normalized.includes(normalizeLooseKey(hint)),
  );
}

function valueLooksLikeStoredFile(value: unknown): boolean {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();

  return (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("data:application/") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    /^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 120
  );
}

function sourceContainsUploadedFiles(source: unknown, depth = 0): boolean {
  if (depth > 6) return false;

  if (valueLooksLikeStoredFile(source)) return true;

  if (Array.isArray(source)) {
    return source.some((item) => sourceContainsUploadedFiles(item, depth + 1));
  }

  const record = asRecord(source);
  if (!record) return false;

  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeLooseKey(key);

    if (
      APPLICATION_FILE_KEY_HINTS.some((hint) => normalizedKey.includes(hint)) &&
      (valueLooksLikeStoredFile(value) || Boolean(normalizeUrl(value)))
    ) {
      return true;
    }

    if (typeof value === "object" && value !== null && sourceContainsUploadedFiles(value, depth + 1)) {
      return true;
    }

    if (Array.isArray(value) && value.some((item) => sourceContainsUploadedFiles(item, depth + 1))) {
      return true;
    }
  }

  return false;
}


const DOCUMENT_DIRECT_KEY_HINTS: Record<string, string[]> = {
  idFront: [
    "idfront",
    "identityfront",
    "identitycardfront",
    "documentfront",
    "documentofrente",
    "cedulafrente",
    "cedulafront",
    "carnetfrente",
    "carnetfront",
    "dnifrente",
    "dnifront",
  ],
  idBack: [
    "idback",
    "identityback",
    "identitycardback",
    "documentback",
    "documentoreverso",
    "cedulareverso",
    "cedulaback",
    "carnetreverso",
    "carnetback",
    "dnireverso",
    "dniback",
  ],
  licenseFront: [
    "licensefront",
    "driverlicensefront",
    "drivinglicensefront",
    "licenciafrente",
    "licenciafront",
    "licenciaconducirfrente",
  ],
  licenseBack: [
    "licenseback",
    "driverlicenseback",
    "drivinglicenseback",
    "licenciareverso",
    "licenciaback",
    "licenciaconducirreverso",
    "licenciatrasera",
    "licenciaposterior",
    "licensereverso",
    "licensetrasera",
    "licenseposterior",
  ],
  profilePhoto: [
    "profilephoto",
    "profileimage",
    "profilepicture",
    "avatar",
    "fotoperfil",
    "driverprofilephoto",
    "personalphoto",
    "selfie",
  ],
  vehiclePhoto: [
    "vehiclephoto",
    "vehicleimage",
    "drivervehiclephoto",
    "drivervehicleimage",
    "mainvehiclephoto",
    "carphoto",
    "autophoto",
    "fotovehiculo",
    "vehiculofoto",
    "fotoauto",
  ],
  certificate: [
    "certificate",
    "certification",
    "guidecertificate",
    "certificacion",
    "certificadoguia",
  ],
};

function documentKeyMatchesTarget(key: string, target: string): boolean {
  const normalized = normalizeLooseKey(key);
  const hints = DOCUMENT_DIRECT_KEY_HINTS[target] ?? [];

  if (!normalized.includes("rapago")) return false;
  if (!hints.some((hint) => normalized.includes(normalizeLooseKey(hint)))) return false;

  // Evita que una foto de vehículo caiga como carnet/licencia/perfil.
  if (target !== "vehiclePhoto") {
    const vehicleHints = DOCUMENT_DIRECT_KEY_HINTS.vehiclePhoto ?? [];
    if (vehicleHints.some((hint) => normalized.includes(normalizeLooseKey(hint)))) return false;
  }

  if (target !== "profilePhoto") {
    const profileHints = DOCUMENT_DIRECT_KEY_HINTS.profilePhoto ?? [];
    if (profileHints.some((hint) => normalized.includes(normalizeLooseKey(hint))) && target !== "profilePhoto") return false;
  }

  if (target === "idFront") {
    return !/(back|reverso|trasera|posterior)/i.test(normalized);
  }

  if (target === "idBack") {
    return /(back|reverso|trasera|posterior)/i.test(normalized) || hints.some((hint) => normalized.includes(normalizeLooseKey(hint)));
  }

  if (target === "licenseFront") {
    return !/(back|reverso|trasera|posterior)/i.test(normalized);
  }

  if (target === "licenseBack") {
    return /(back|reverso|trasera|posterior)/i.test(normalized) || hints.some((hint) => normalized.includes(normalizeLooseKey(hint)));
  }

  return true;
}

function readLocalStorageDirectFile(target: string, item: ApplicationData, candidateKeys: string[]): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;

  const identity = getApplicationIdentity(item);
  const identityHints = [identity.email, identity.rut, identity.phone, identity.id]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeLooseKey(value));

  const fallbackMatches: string[] = [];

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !documentKeyMatchesTarget(key, target)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const normalizedKey = normalizeLooseKey(key);
      const matchesIdentity = identityHints.length === 0 || identityHints.some((hint) => normalizedKey.includes(hint));

      const rawUrl = normalizeUrl(raw);
      if (rawUrl && valueLooksLikeStoredFile(rawUrl)) {
        if (matchesIdentity || normalizedKey.includes("latest") || normalizedKey.includes("actual")) return rawUrl;
        fallbackMatches.push(rawUrl);
        continue;
      }

      try {
        const parsed = JSON.parse(raw) as unknown;
        const parsedSources = flattenApplicationContainers(parsed);
        for (const source of parsedSources) {
          const parsedUrl = readUrlByKeys(source, candidateKeys);
          if (!parsedUrl) continue;
          if (matchesIdentity || applicationCandidateMatches(source, item) || normalizedKey.includes("latest") || normalizedKey.includes("actual")) return parsedUrl;
          fallbackMatches.push(parsedUrl);
        }
      } catch {
        // Raw que no es JSON y no era URL válida.
      }
    }
  } catch {
    return null;
  }

  return fallbackMatches[0] ?? null;
}

function readLocalStorageDirectFileName(target: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !documentKeyMatchesTarget(key, target)) continue;

      if (!/(name|filename|nombre|archivo)/i.test(key)) continue;

      const raw = localStorage.getItem(key);
      const name = normalizeString(raw);
      if (name && !valueLooksLikeStoredFile(name)) return name;
    }
  } catch {
    return null;
  }

  return null;
}

function flattenApplicationContainers(source: unknown): unknown[] {
  const record = asRecord(source);
  if (!record) return Array.isArray(source) ? source : [source];

  const containers: unknown[] = [source];

  for (const key of [
    "items",
    "applications",
    "data",
    "rows",
    "results",
    "documents",
    "documentos",
    "files",
    "uploads",
    "vehicles",
    "vehicle",
    "profile",
    "metadata",
    "payload",
    "formData",
  ]) {
    const value = record[key];

    if (Array.isArray(value)) {
      containers.push(...value);
      continue;
    }

    if (value && typeof value === "object") {
      containers.push(value);
    }
  }

  return containers;
}

function collectAllLocalApplicationSources(item: ApplicationData): unknown[] {
  if (typeof window === "undefined" || !window.localStorage) return [];

  const matched: unknown[] = [];
  const fallbackWithFiles: unknown[] = [];

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !localStorageKeyLooksUsefulForApplication(key)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      let parsed: unknown;

      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        parsed = raw;
      }

      const candidates = flattenApplicationContainers(parsed);

      const directMatches = candidates.filter((candidate) =>
        applicationCandidateMatches(candidate, item),
      );

      if (directMatches.length > 0) {
        matched.push(...directMatches, parsed);
        continue;
      }

      if (sourceContainsUploadedFiles(parsed)) {
        fallbackWithFiles.push(parsed);
      }
    }
  } catch {
    // No bloquea la vista si localStorage está restringido.
  }

  return matched.length > 0 ? matched : fallbackWithFiles.slice(0, 8);
}

function getApplicationIdentity(item: ApplicationData): {
  id: string | null;
  email: string | null;
  rut: string | null;
  phone: string | null;
} {
  const record = item as unknown as AnyRecord;

  return {
    id: normalizeString(record.id),
    email: normalizeString(record.email)?.toLowerCase() ?? null,
    rut: normalizeString(record.rut)?.replace(/[.\s-]/g, "").toLowerCase() ?? null,
    phone: normalizeString(record.phone)?.replace(/\D/g, "") ?? null,
  };
}

function applicationCandidateMatches(candidate: unknown, item: ApplicationData): boolean {
  const candidateRecord = asRecord(candidate);
  if (!candidateRecord) return false;

  const identity = getApplicationIdentity(item);
  const candidateId =
    normalizeString(candidateRecord.id) ??
    normalizeString(candidateRecord.applicationId) ??
    normalizeString(candidateRecord.userId);

  const candidateEmail =
    normalizeString(candidateRecord.email) ??
    normalizeString(candidateRecord.userEmail) ??
    normalizeString(candidateRecord.contactEmail) ??
    normalizeString(candidateRecord.passengerEmail) ??
    normalizeString(candidateRecord.driverEmail) ??
    readStringByKeys(candidateRecord, ["email", "userEmail", "contactEmail", "driverEmail"]);

  const candidateRut =
    normalizeString(candidateRecord.rut) ??
    normalizeString(candidateRecord.RUT) ??
    normalizeString(candidateRecord.documentNumber) ??
    normalizeString(candidateRecord.nationalId) ??
    normalizeString(candidateRecord.identityNumber) ??
    readStringByKeys(candidateRecord, ["rut", "RUT", "documentNumber", "nationalId", "identityNumber"]);

  const candidatePhone =
    normalizeString(candidateRecord.phone) ??
    normalizeString(candidateRecord.telefono) ??
    normalizeString(candidateRecord.phoneNumber) ??
    normalizeString(candidateRecord.cellphone) ??
    normalizeString(candidateRecord.mobile) ??
    readStringByKeys(candidateRecord, ["phone", "telefono", "phoneNumber", "cellphone", "mobile"]);

  if (identity.id && candidateId === identity.id) return true;
  if (identity.email && candidateEmail?.toLowerCase() === identity.email) return true;
  if (
    identity.rut &&
    candidateRut?.replace(/[.\s-]/g, "").toLowerCase() === identity.rut
  ) {
    return true;
  }
  if (identity.phone && candidatePhone?.replace(/\D/g, "") === identity.phone) return true;

  return false;
}

function collectLocalApplicationSources(item: ApplicationData): unknown[] {
  const sources: unknown[] = [];
  const identity = getApplicationIdentity(item);

  const exactKeys = [
    ...APPLICATION_LOCAL_KEYS,
    identity.id ? `rapago_driver_application_${identity.id}` : null,
    identity.id ? `rapago_driver_documents_${identity.id}` : null,
    identity.id ? `rapago_driver_vehicle_${identity.id}` : null,
    identity.email ? `rapago_driver_application_${identity.email}` : null,
    identity.email ? `rapago_application_driver_${identity.email}` : null,
    identity.email ? `rapago_driver_documents_${identity.email}` : null,
    identity.email ? `rapago_driver_vehicle_${identity.email}` : null,
    identity.email ? `rapago_driver_public_profile_${identity.email}` : null,
    identity.rut ? `rapago_driver_application_${identity.rut}` : null,
    identity.rut ? `rapago_driver_documents_${identity.rut}` : null,
  ].filter((key): key is string => Boolean(key));

  try {
    for (const key of exactKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as unknown;

      if (Array.isArray(parsed)) {
        const matches = parsed.filter((entry) => applicationCandidateMatches(entry, item));
        sources.push(...(matches.length > 0 ? matches : parsed));
        continue;
      }

      if (applicationCandidateMatches(parsed, item)) {
        sources.push(parsed);
        continue;
      }

      const record = asRecord(parsed);
      if (record) {
        const possibleItems =
          Array.isArray(record.items) ? record.items :
          Array.isArray(record.applications) ? record.applications :
          Array.isArray(record.data) ? record.data :
          null;

        if (possibleItems) {
          const matches = possibleItems.filter((entry) => applicationCandidateMatches(entry, item));
          sources.push(...matches);
          continue;
        }
      }

      sources.push(parsed);
    }
  } catch {
    // No bloquea el detalle si localStorage contiene datos inválidos.
  }

  return sources;
}

function getApplicationSources(item: ApplicationData): unknown[] {
  const record = item as unknown as AnyRecord;
  const localSources = collectLocalApplicationSources(item);
  const allLocalSources = collectAllLocalApplicationSources(item);

  return [
    record,
    record.application,
    record.payload,
    record.data,
    record.metadata,
    record.extraData,
    record.formData,
    record.documents,
    record.documentos,
    record.documentImages,
    record.driverDocuments,
    record.identityDocuments,
    record.files,
    record.uploads,
    record.attachments,
    record.profile,
    record.user,
    record.driver,
    record.driverProfile,
    record.vehicle,
    record.vehicles,
    record.vehiclePhotos,
    record.vehicleImages,
    ...localSources,
    ...allLocalSources,
  ].filter(Boolean);
}

function readFirstString(sources: unknown[], keys: string[]): string | null {
  for (const source of sources) {
    const value = readStringByKeys(source, keys);
    if (value) return value;
  }

  return null;
}

function readFirstUrl(sources: unknown[], keys: string[]): string | null {
  for (const source of sources) {
    const value = readUrlByKeys(source, keys);
    if (value) return value;
  }

  return null;
}


function readLicenseBackFromKnownSources(sources: unknown[]): { url: string | null; fileName: string | null } {
  const containers: unknown[] = [];

  const pushContainer = (value: unknown): void => {
    if (!value) return;
    containers.push(value);

    const record = asRecord(value);
    if (!record) return;

    for (const key of [
      "documents",
      "documentos",
      "driverLicense",
      "drivingLicense",
      "license",
      "licencia",
      "licenseBack",
      "driverLicenseBack",
      "drivingLicenseBack",
      "licenciaReverso",
      "licenciaBack",
      "licenciaTrasera",
      "licenciaPosterior",
      "payload",
      "data",
      "formData",
      "metadata",
      "application",
    ]) {
      if (record[key]) containers.push(record[key]);
    }

    const docs = asRecord(record.documents) ?? asRecord(record.documentos);
    if (docs) {
      for (const key of [
        "licenseBack",
        "driverLicenseBack",
        "drivingLicenseBack",
        "licenciaReverso",
        "licenciaBack",
        "licenciaTrasera",
        "licenciaPosterior",
        "driverLicense",
        "drivingLicense",
        "license",
        "licencia",
      ]) {
        if (docs[key]) containers.push(docs[key]);
      }

      const nestedDriverLicense = asRecord(docs.driverLicense) ?? asRecord(docs.drivingLicense) ?? asRecord(docs.license) ?? asRecord(docs.licencia);
      if (nestedDriverLicense) containers.push(nestedDriverLicense);
    }
  };

  sources.forEach(pushContainer);

  const urlKeys = buildFileKeyCandidates([
    "licenseBackUrl",
    "driverLicenseBackUrl",
    "drivingLicenseBackUrl",
    "licenciaReversoUrl",
    "licenciaBackUrl",
    "licenciaTraseraUrl",
    "licenciaPosteriorUrl",
    "licenseReversoUrl",
    "licenseTraseraUrl",
    "licensePosteriorUrl",
    "licenseBackDataUrl",
    "driverLicenseBackDataUrl",
    "drivingLicenseBackDataUrl",
    "licenciaReversoDataUrl",
    "licenciaTraseraDataUrl",
    "licenseBack",
    "driverLicenseBack",
    "drivingLicenseBack",
    "driverLicenseReverso",
    "licenciaReverso",
    "licenciaBack",
    "licenciaTrasera",
    "licenciaPosterior",
    "backUrl",
    "backDataUrl",
    "reverseUrl",
    "reverseDataUrl",
    "reversoUrl",
    "reversoDataUrl",
    "traseraUrl",
    "traseraDataUrl",
    "posteriorUrl",
    "posteriorDataUrl",
    "back",
    "reverse",
    "reverso",
    "trasera",
    "posterior",
  ]);

  const nameKeys = [
    "licenseBackFileName",
    "driverLicenseBackFileName",
    "drivingLicenseBackFileName",
    "licenciaReversoFileName",
    "licenciaTraseraFileName",
    "backFileName",
    "reversoFileName",
    "traseraFileName",
    "fileNameBack",
    "fileName",
    "name",
    "originalName",
  ];

  for (const container of containers) {
    const url = readUrlByKeys(container, urlKeys);
    if (!url) continue;

    return {
      url,
      fileName: readStringByKeys(container, nameKeys),
    };
  }

  return { url: null, fileName: null };
}


function readFirstArray(sources: unknown[], keys: string[]): unknown[] | null {
  for (const source of sources) {
    const value = readArrayByKeys(source, keys);
    if (value) return value;
  }

  return null;
}

function isImageUrl(url: string | null): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();

  return (
    url.startsWith("data:image/") ||
    url.startsWith("blob:") ||
    /\.(png|jpg|jpeg|webp|gif|bmp|heic|heif)$/i.test(clean)
  );
}


function readStorageValueForAdmin(key: string): string | null {
  try {
    const local = localStorage.getItem(key);
    if (local && local.trim()) return local;
  } catch {
    // No bloquea el detalle.
  }

  try {
    const session = sessionStorage.getItem(key);
    if (session && session.trim()) return session;
  } catch {
    // No bloquea el detalle.
  }

  return null;
}

function getDirectDocumentIdentityParts(item: ApplicationData): string[] {
  const identity = getApplicationIdentity(item);
  const parts = new Set<string>();

  // Primero busca por identidad real del postulante. "latest" queda solo como
  // respaldo para pruebas locales y evita mezclar documentos entre conductores.
  if (identity.email) {
    parts.add(`email_${identity.email}`);
    parts.add(`email_${encodeURIComponent(identity.email)}`);
  }

  if (identity.rut) parts.add(`rut_${identity.rut}`);
  if (identity.phone) parts.add(`phone_${identity.phone}`);
  if (identity.id) parts.add(`id_${identity.id}`);
  parts.add("latest");

  return Array.from(parts).filter(Boolean);
}

function readDirectApplicationFile(item: ApplicationData, suffixes: string[]): { url: string | null; fileName: string | null } {
  for (const suffix of suffixes) {
    for (const identityPart of getDirectDocumentIdentityParts(item)) {
      const directKey = `rapago_driver_document_${suffix}_${identityPart}`;
      const directUrl = normalizeUrl(readStorageValueForAdmin(directKey));
      if (directUrl) {
        return {
          url: directUrl,
          fileName: readStorageValueForAdmin(`${directKey}_fileName`),
        };
      }

      const bundleKey = `rapago_driver_documents_bundle_${identityPart}`;
      const bundleRaw = readStorageValueForAdmin(bundleKey);
      if (bundleRaw) {
        try {
          const bundle = JSON.parse(bundleRaw) as AnyRecord;
          const documents = asRecord(bundle.documents);
          const doc = documents ? asRecord(documents[suffix]) : null;
          const bundleUrl = normalizeUrl(doc?.url ?? doc?.dataUrl ?? doc?.previewUrl);
          if (bundleUrl) {
            return {
              url: bundleUrl,
              fileName: normalizeString(doc?.fileName),
            };
          }
        } catch {
          // Ignora bundle corrupto.
        }
      }
    }
  }

  return { url: null, fileName: null };
}

function buildDocumentViews(item: ApplicationData): DocumentView[] {
  const sources = getApplicationSources(item);

  const documentDefinitions: Array<{
    key: string;
    label: string;
    helper: string;
    directSuffixes: string[];
    keys: string[];
  }> = [
    {
      key: "idFront",
      label: "Carnet frente",
      helper: "Cédula de identidad por el frente.",
      directSuffixes: ["identity_front", "id_front", "carnet_frente", "cedula_frente"],
      keys: [
        "idFrontUrl",
        "identityFrontUrl",
        "identityDocumentFrontUrl",
        "identityCardFrontUrl",
        "identityCardFrontDataUrl",
        "identityCardFrontFile",
        "identityCardFrontImage",
        "identityCardFrontPhoto",
        "identityFrontFile",
        "identityFrontDataUrl",
        "documentFrontUrl",
        "documentoFrenteUrl",
        "cedulaFrenteUrl",
        "cedulaFrontUrl",
        "carnetFrenteUrl",
        "carnetFrontUrl",
        "dniFrontUrl",
        "dniFrenteUrl",
        "idFront",
        "identityFront",
        "identityDocumentFront",
        "identityCardFront",
        "identityCardFrontFile",
        "documentFront",
        "documentoFrente",
        "cedulaFrente",
        "cedulaFront",
        "carnetFrente",
        "carnetFront",
        "dniFront",
        "dniFrente",
        "idCardFrontPhoto",
        "carnetFrentePhoto",
        "cedulaFrentePhoto",
      ],
    },
    {
      key: "idBack",
      label: "Carnet reverso",
      helper: "Cédula de identidad por el reverso.",
      directSuffixes: ["identity_back", "id_back", "carnet_reverso", "cedula_reverso"],
      keys: [
        "idBackUrl",
        "identityBackUrl",
        "identityDocumentBackUrl",
        "identityCardBackUrl",
        "identityCardBackDataUrl",
        "identityCardBackFile",
        "identityCardBackImage",
        "identityCardBackPhoto",
        "identityBackFile",
        "identityBackDataUrl",
        "documentBackUrl",
        "documentoReversoUrl",
        "cedulaReversoUrl",
        "cedulaBackUrl",
        "carnetReversoUrl",
        "carnetBackUrl",
        "dniBackUrl",
        "dniReversoUrl",
        "idBack",
        "identityBack",
        "identityDocumentBack",
        "identityCardBack",
        "identityCardBackFile",
        "documentBack",
        "documentoReverso",
        "cedulaReverso",
        "cedulaBack",
        "carnetReverso",
        "carnetBack",
        "dniBack",
        "dniReverso",
        "idCardBackPhoto",
        "carnetReversoPhoto",
        "cedulaReversoPhoto",
      ],
    },
    {
      key: "licenseFront",
      label: "Licencia frente",
      helper: "Licencia de conducir por el frente.",
      directSuffixes: ["license_front", "licencia_frente", "driver_license_front"],
      keys: [
        "licenseFrontUrl",
        "driverLicenseFrontUrl",
        "drivingLicenseFrontUrl",
        "licenciaFrenteUrl",
        "licenciaFrontUrl",
        "licenseFront",
        "driverLicenseFront",
        "driverLicense",
        "drivingLicenseFront",
        "licenciaFrente",
        "licenciaFront",
        "licenseFrontPhoto",
        "driverLicenseFrontPhoto",
      ],
    },
    {
      key: "licenseBack",
      label: "Licencia reverso",
      helper: "Licencia de conducir por el reverso.",
      directSuffixes: [
        "license_back",
        "driver_license_back",
        "driving_license_back",
        "licencia_reverso",
        "licencia_back",
        "licencia_trasera",
        "licencia_posterior",
        "license_reverso",
        "license_trasera",
        "license_posterior",
        "driver_license_reverso",
        "driver_license_trasera",
        "driver_license_posterior",
      ],
      keys: [
        "licenseBackUrl",
        "driverLicenseBackUrl",
        "drivingLicenseBackUrl",
        "licenciaReversoUrl",
        "licenciaBackUrl",
        "licenciaTraseraUrl",
        "licenciaPosteriorUrl",
        "licenseBackDataUrl",
        "driverLicenseBackDataUrl",
        "drivingLicenseBackDataUrl",
        "licenciaReversoDataUrl",
        "licenciaTraseraDataUrl",
        "licenseBackFile",
        "driverLicenseBackFile",
        "licenseBack",
        "driverLicenseBack",
        "driverLicenseReverso",
        "drivingLicenseBack",
        "licenciaReverso",
        "licenciaBack",
        "licenciaTrasera",
        "licenciaPosterior",
        "licenseBackPhoto",
        "driverLicenseBackPhoto",
        // Soporta estructuras tipo documents.driverLicense.back/backUrl.
        "backUrl",
        "backDataUrl",
        "backFile",
        "back",
        "reverso",
        "trasera",
        "posterior",
      ],
    },
    {
      key: "profilePhoto",
      label: "Foto de perfil",
      helper: "Foto personal del postulante.",
      directSuffixes: ["profile_photo", "foto_perfil"],
      keys: [
        "profilePhotoUrl",
        "profileImageUrl",
        "profilePictureUrl",
        "avatarUrl",
        "photoUrl",
        "fotoPerfilUrl",
        "driverProfilePhotoUrl",
        "profilePhoto",
        "profileImage",
        "profilePicture",
        "avatar",
        "photo",
        "fotoPerfil",
        "driverProfilePhoto",
        "selfie",
        "personalPhoto",
      ],
    },
    {
      key: "vehiclePhoto",
      label: "Foto del vehículo principal",
      helper: "Foto del auto propio para validar la inscripción.",
      directSuffixes: ["vehicle_photo", "foto_vehiculo"],
      keys: [
        "vehiclePhotoUrl",
        "mainVehiclePhotoUrl",
        "driverVehiclePhotoUrl",
        "vehicleImageUrl",
        "carPhotoUrl",
        "autoPhotoUrl",
        "fotoVehiculoUrl",
        "vehiculoFotoUrl",
        "fotoAutoUrl",
        "vehiclePhoto",
        "mainVehiclePhoto",
        "driverVehiclePhoto",
        "vehicleImage",
        "carPhoto",
        "autoPhoto",
        "fotoVehiculo",
        "vehiculoFoto",
        "fotoAuto",
        "vehicleFrontPhoto",
        "vehiclePhotoDataUrl",
        "driverVehicleImage",
      ],
    },
  ];

  if (item.type === "guide") {
    documentDefinitions.push({
      key: "certificate",
      label: "Certificación guía",
      helper: "Certificado o respaldo de guía.",
      directSuffixes: ["certificate", "guide_certificate"],
      keys: [
        "certificateUrl",
        "guideCertificateUrl",
        "certificationUrl",
        "certificate",
        "guideCertificate",
        "certification",
      ],
    });
  }

  return documentDefinitions.map((definition) => {
    const candidateKeys = buildFileKeyCandidates(definition.keys);
    const directFile = readDirectApplicationFile(item, definition.directSuffixes);
    const licenseBackKnown =
      definition.key === "licenseBack"
        ? readLicenseBackFromKnownSources(sources)
        : { url: null, fileName: null };

    const url =
      definition.key === "licenseBack"
        ? (
            directFile.url ??
            licenseBackKnown.url ??
            readFirstUrl(sources, candidateKeys) ??
            readLocalStorageDirectFile(definition.key, item, candidateKeys)
          )
        : (
            readFirstUrl(sources, candidateKeys) ??
            directFile.url ??
            readLocalStorageDirectFile(definition.key, item, candidateKeys)
          );

    const fileName =
      definition.key === "licenseBack"
        ? (
            directFile.fileName ??
            licenseBackKnown.fileName ??
            readFirstString(sources, candidateKeys.map((key) => `${key}Name`)) ??
            readFirstString(sources, candidateKeys.map((key) => `${key}FileName`)) ??
            readFirstString(sources, candidateKeys.map((key) => `${key}OriginalName`)) ??
            readLocalStorageDirectFileName(definition.key)
          )
        : (
            readFirstString(sources, candidateKeys.map((key) => `${key}Name`)) ??
            readFirstString(sources, candidateKeys.map((key) => `${key}FileName`)) ??
            readFirstString(sources, candidateKeys.map((key) => `${key}OriginalName`)) ??
            directFile.fileName ??
            readLocalStorageDirectFileName(definition.key)
          );

    return {
      key: definition.key,
      label: definition.label,
      url,
      fileName,
      helper: definition.helper,
    };
  });
}

function buildVehicleViews(item: ApplicationData): DriverVehicleView[] {
  const sources = getApplicationSources(item);
  const vehicles: DriverVehicleView[] = [];

  const vehicleArrays = [
    readFirstArray(sources, ["vehicles"]),
    readFirstArray(sources, ["vehicleList"]),
    readFirstArray(sources, ["driverVehicles"]),
    readFirstArray(sources, ["additionalVehicles"]),
  ].filter((value): value is unknown[] => Array.isArray(value));

  const addVehicle = (source: unknown, index: number, isMain: boolean) => {
    const vehicleSources = [source, asRecord(source)?.vehicle].filter(Boolean);

    const description =
      readFirstString(vehicleSources, [
        "description",
        "vehicleDescription",
        "descripcion",
        "descripcionVehiculo",
        "detalle",
      ]) ??
      readFirstString(vehicleSources, [
        "name",
        "title",
      ]);

    const brand = readFirstString(vehicleSources, ["brand", "vehicleBrand", "marca"]);
    const model = readFirstString(vehicleSources, ["model", "vehicleModel", "modelo"]);
    const year = readFirstString(vehicleSources, ["year", "vehicleYear", "anio", "año"]);
    const plate = readFirstString(vehicleSources, ["plate", "vehiclePlate", "patente"]);
    const color = readFirstString(vehicleSources, ["color", "vehicleColor"]);
    const photoUrl = readFirstUrl(vehicleSources, buildFileKeyCandidates([
      "photoUrl",
      "vehiclePhotoUrl",
      "mainVehiclePhotoUrl",
      "driverVehiclePhotoUrl",
      "vehicleImageUrl",
      "carPhotoUrl",
      "autoPhotoUrl",
      "fotoVehiculoUrl",
      "vehiculoFotoUrl",
      "photo",
      "vehiclePhoto",
      "mainVehiclePhoto",
      "driverVehiclePhoto",
      "vehicleImage",
      "carPhoto",
      "autoPhoto",
      "fotoVehiculo",
      "vehiculoFoto",
      "vehiclePhotoDataUrl",
    ]));

    const composed = [brand, model, year ? `año ${year}` : null, plate ? `patente ${plate}` : null]
      .filter(Boolean)
      .join(", ");

    if (!description && !composed && !photoUrl) return;

    vehicles.push({
      id: `${isMain ? "main" : "extra"}-${index}`,
      title: isMain ? "Vehículo principal" : `Vehículo adicional ${index + 1}`,
      description: description ?? composed,
      brand,
      model,
      year,
      plate,
      color,
      photoUrl,
      isMain,
    });
  };

  // Vehículo principal desde campos planos de ApplicationData o desde payload.
  const mainDescription =
    readFirstString(sources, [
      "vehicleDescription",
      "descripcionVehiculo",
      "vehicleDetails",
      "mainVehicleDescription",
    ]) ??
    [
      readFirstString(sources, ["vehicleBrand", "brand", "marca"]),
      readFirstString(sources, ["vehicleModel", "model", "modelo"]),
      readFirstString(sources, ["vehicleYear", "year", "anio", "año"]),
      readFirstString(sources, ["vehiclePlate", "plate", "patente"]),
    ]
      .filter(Boolean)
      .join(", ");

  const mainPhoto =
    readFirstUrl(sources, buildFileKeyCandidates([
      "vehiclePhotoUrl",
      "mainVehiclePhotoUrl",
      "driverVehiclePhotoUrl",
      "vehicleImageUrl",
      "driverVehicleImageUrl",
      "carPhotoUrl",
      "autoPhotoUrl",
      "fotoVehiculoUrl",
      "vehiculoFotoUrl",
      "vehiclePhoto",
      "mainVehiclePhoto",
      "driverVehiclePhoto",
      "vehicleImage",
      "driverVehicleImage",
      "carPhoto",
      "autoPhoto",
      "fotoVehiculo",
      "vehiculoFoto",
      "vehiclePhotoDataUrl",
      "driverVehicleImageDataUrl",
    ])) ??
    readDirectApplicationFile(item, ["vehicle_photo", "foto_vehiculo"]).url;

  if (mainDescription || mainPhoto) {
    vehicles.push({
      id: "main-0",
      title: "Vehículo principal",
      description: mainDescription || "Vehículo principal informado.",
      brand: readFirstString(sources, ["vehicleBrand", "brand", "marca"]),
      model: readFirstString(sources, ["vehicleModel", "model", "modelo"]),
      year: readFirstString(sources, ["vehicleYear", "year", "anio", "año"]),
      plate: readFirstString(sources, ["vehiclePlate", "plate", "patente"]),
      color: readFirstString(sources, ["vehicleColor", "color"]),
      photoUrl: mainPhoto,
      isMain: true,
    });
  }

  for (const array of vehicleArrays) {
    array.forEach((entry, index) => addVehicle(entry, index, vehicles.length === 0 && index === 0));
  }

  // Fotos adicionales si fueron guardadas separadas como array.
  const photoArrays = [
    readFirstArray(sources, ["vehiclePhotos"]),
    readFirstArray(sources, ["vehiclePhotoUrls"]),
    readFirstArray(sources, ["driverVehiclePhotos"]),
    readFirstArray(sources, ["carPhotos"]),
    readFirstArray(sources, ["autoPhotos"]),
    readFirstArray(sources, ["vehicleImages"]),
    readFirstArray(sources, ["fotoVehiculo"]),
    readFirstArray(sources, ["fotosVehiculo"]),
  ].filter((value): value is unknown[] => Array.isArray(value));

  for (const photoArray of photoArrays) {
    photoArray.forEach((entry, index) => {
      const photoUrl = normalizeUrl(
        typeof entry === "string"
          ? entry
          : readStringByKeys(entry, ["url", "fileUrl", "publicUrl", "downloadUrl", "dataUrl", "previewUrl", "imageUrl", "photoUrl", "src", "base64", "data", "value"]),
      );

      if (!photoUrl) return;

      const alreadyExists = vehicles.some((vehicle) => vehicle.photoUrl === photoUrl);
      if (alreadyExists) return;

      vehicles.push({
        id: `photo-${index}`,
        title: vehicles.length === 0 ? "Vehículo principal" : `Vehículo adicional ${vehicles.length + 1}`,
        description: "Foto de vehículo adjunta.",
        brand: null,
        model: null,
        year: null,
        plate: null,
        color: null,
        photoUrl,
        isMain: vehicles.length === 0,
      });
    });
  }

  const unique = new Map<string, DriverVehicleView>();

  for (const vehicle of vehicles) {
    const key = `${vehicle.description ?? ""}-${vehicle.plate ?? ""}-${vehicle.photoUrl ?? ""}`;
    if (!unique.has(key)) unique.set(key, vehicle);
  }

  return Array.from(unique.values());
}

function AdminDocumentCard({ doc }: { doc: DocumentView }): JSX.Element {
  const hasFile = Boolean(doc.url);

  return (
    <IonItem lines="none" style={rowCardStyle}>
      <div
        style={{
          width: "100%",
          padding: "12px 0",
          display: "grid",
          gridTemplateColumns: hasFile && isImageUrl(doc.url) ? "82px 1fr" : "1fr",
          gap: "12px",
          alignItems: "center",
        }}
      >
        {hasFile && isImageUrl(doc.url) && (
          <a href={doc.url ?? "#"} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <img
              src={doc.url ?? ""}
              alt={doc.label}
              style={{
                width: "82px",
                height: "72px",
                objectFit: "cover",
                borderRadius: "14px",
                border: "1px solid rgba(210,164,58,.42)",
                background: "#eee",
              }}
            />
          </a>
        )}

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: ".94rem" }}>{doc.label}</div>
              <div style={{ color: "#666", fontSize: ".75rem", marginTop: 3 }}>{doc.helper}</div>
              {doc.fileName && (
                <div style={{ color: "#8a6418", fontSize: ".72rem", marginTop: 4, fontWeight: 800 }}>
                  {doc.fileName}
                </div>
              )}
            </div>

            <IonBadge color={hasFile ? "success" : "medium"}>
              {hasFile ? "Subido" : "No subido"}
            </IonBadge>
          </div>

          {hasFile && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <IonButton
                size="small"
                fill="outline"
                color="warning"
                href={doc.url ?? undefined}
                target="_blank"
                rel="noreferrer"
                style={{ "--border-radius": "999px", fontWeight: 900 } as CSSProperties}
              >
                <IonIcon icon={eyeOutline} slot="start" />
                Ver archivo
              </IonButton>
            </div>
          )}
        </div>
      </div>
    </IonItem>
  );
}

function AdminVehicleCard({ vehicle }: { vehicle: DriverVehicleView }): JSX.Element {
  return (
    <IonItem lines="none" style={rowCardStyle}>
      <div
        style={{
          width: "100%",
          padding: "12px 0",
          display: "grid",
          gridTemplateColumns: vehicle.photoUrl && isImageUrl(vehicle.photoUrl) ? "98px 1fr" : "1fr",
          gap: "12px",
          alignItems: "center",
        }}
      >
        {vehicle.photoUrl && isImageUrl(vehicle.photoUrl) && (
          <a href={vehicle.photoUrl} target="_blank" rel="noreferrer">
            <img
              src={vehicle.photoUrl}
              alt={vehicle.title}
              style={{
                width: "98px",
                height: "78px",
                objectFit: "cover",
                borderRadius: "16px",
                border: "1px solid rgba(210,164,58,.42)",
                background: "#eee",
              }}
            />
          </a>
        )}

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: ".94rem" }}>
                {vehicle.title}
              </div>
              {vehicle.description && (
                <div style={{ color: "#333", fontSize: ".82rem", marginTop: 4, fontWeight: 800 }}>
                  {vehicle.description}
                </div>
              )}
            </div>
            <IonBadge color={vehicle.isMain ? "warning" : "tertiary"}>
              {vehicle.isMain ? "Principal" : "Opcional"}
            </IonBadge>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
            {vehicle.brand && <IonBadge color="medium">Marca: {vehicle.brand}</IonBadge>}
            {vehicle.model && <IonBadge color="medium">Modelo: {vehicle.model}</IonBadge>}
            {vehicle.year && <IonBadge color="medium">Año: {vehicle.year}</IonBadge>}
            {vehicle.plate && <IonBadge color="medium">Patente: {vehicle.plate}</IonBadge>}
            {vehicle.color && <IonBadge color="medium">Color: {vehicle.color}</IonBadge>}
            {vehicle.photoUrl && <IonBadge color="success">Foto subida</IonBadge>}
          </div>

          {vehicle.photoUrl && (
            <IonButton
              size="small"
              fill="outline"
              color="warning"
              href={vehicle.photoUrl}
              target="_blank"
              rel="noreferrer"
              style={{ marginTop: 10, "--border-radius": "999px", fontWeight: 900 } as CSSProperties}
            >
              <IonIcon icon={imageOutline} slot="start" />
              Ver foto
            </IonButton>
          )}
        </div>
      </div>
    </IonItem>
  );
}

function AdminApplicationDetailModal({
  item,
  token,
  onClose,
  onUpdated,
}: {
  item: ApplicationData;
  token: string;
  onClose: () => void;
  onUpdated: (updated: ApplicationData) => void;
}): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApproveAlert, setShowApproveAlert] = useState(false);
  const [showRejectAlert, setShowRejectAlert] = useState(false);
  const [showReviewAlert, setShowReviewAlert] = useState(false);
  const [showHoldAlert, setShowHoldAlert] = useState(false);
  const [showPendingAlert, setShowPendingAlert] = useState(false);
  const [documentReviewStatus, setDocumentReviewStatus] = useState(
    item.documentReviewStatus || "pending",
  );
  const [trainingStatus, setTrainingStatus] = useState(
    item.trainingStatus || "pending",
  );
  const [reviewChecklist, setReviewChecklist] = useState<Record<string, boolean>>(
    item.reviewChecklist ?? {},
  );

  const isReviewable = item.status !== "approved" && item.status !== "rejected";
  const documents = buildDocumentViews(item);
  const vehicles = buildVehicleViews(item);
  const uploadedDocuments = documents.filter((doc) => doc.url).length;
  const requiredChecklistKeys = [
    "identity",
    "driverLicense",
    "profilePhoto",
    "vehicle",
    "residence",
    "taxDomicile",
    "restWindow",
  ];
  const checklistReady = requiredChecklistKeys.every(
    (key) => reviewChecklist[key] === true,
  );
  const driverApprovalReady =
    item.type !== "driver" ||
    (
      Boolean(item.driverContractAcceptedAt) &&
      documentReviewStatus === "approved" &&
      trainingStatus === "approved" &&
      checklistReady &&
      uploadedDocuments >= 6
    );

  async function doReview(
    status: string,
    rejectionReason?: string,
    notes?: string,
    workflow?: {
      documentReviewStatus?: "pending" | "approved" | "needs_information" | "rejected";
      trainingStatus?: "pending" | "approved" | "rejected";
      reviewChecklist?: Record<string, boolean>;
    },
  ) {
    setLoading(true);
    setError(null);

    try {
      const input: {
        status: string;
        rejectionReason?: string;
        notes?: string;
        documentReviewStatus?: "pending" | "approved" | "needs_information" | "rejected";
        trainingStatus?: "pending" | "approved" | "rejected";
        reviewChecklist?: Record<string, boolean>;
      } = { status };

      if (rejectionReason) input.rejectionReason = rejectionReason;
      if (notes) input.notes = notes;
      if (workflow?.documentReviewStatus) {
        input.documentReviewStatus = workflow.documentReviewStatus;
      }
      if (workflow?.trainingStatus) {
        input.trainingStatus = workflow.trainingStatus;
      }
      if (workflow?.reviewChecklist) {
        input.reviewChecklist = workflow.reviewChecklist;
      }

      const updated = await applicationsService.reviewApplication(
        token,
        item.id,
        input,
      );

      setDocumentReviewStatus(updated.documentReviewStatus);
      setTrainingStatus(updated.trainingStatus);
      setReviewChecklist(updated.reviewChecklist ?? {});
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la postulación.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadContract(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      await applicationsService.downloadContract(token, item.id);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "No se pudo descargar el contrato.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function resendContract(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const delivery = await applicationsService.resendContract(
        token,
        item.id,
      );

      if (delivery.status !== "sent") {
        throw new Error(
          "El servidor no confirmó el envío del contrato.",
        );
      }

      onUpdated({
        ...item,
        contractDeliveryStatus: delivery.status,
        contractDeliveredAt: delivery.deliveredAt,
        contractDeliveryError: null,
      });
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "No se pudo reenviar el contrato.",
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleChecklist(key: string, checked: boolean): void {
    setReviewChecklist((current) => ({
      ...current,
      [key]: checked,
    }));
  }

  return (
    <>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Detalle de postulación</IonTitle>
          <IonButtons slot="end">
            <IonButton fill="clear" color="light" onClick={onClose}>
              Cerrar
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent
        className="ion-padding"
        style={{
          "--background":
            "linear-gradient(180deg, rgba(15,15,15,.78), rgba(15,15,15,.92)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat",
        } as CSSProperties}
      >
        <IonCard style={detailSectionStyle}>
          <IonCardHeader>
            <IonCardTitle style={{ fontSize: "1.08rem", fontWeight: 950 }}>
              {item.firstName} {item.lastName}
            </IonCardTitle>
          </IonCardHeader>

          <IonCardContent>
            <div style={{ display: "grid", gap: 7, fontSize: ".92rem" }}>
              <div>
                <strong>Tipo:</strong> {TYPE_LABEL[item.type] ?? item.type}
              </div>

              <div>
                <strong>Estado:</strong>{" "}
                <IonBadge color={STATUS_COLOR[item.status] ?? "medium"}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </IonBadge>
              </div>

              <div>
                <strong>Email:</strong> {item.email}
              </div>

              <div>
                <strong>Teléfono:</strong> {item.phone}
              </div>

              {item.rut && (
                <div>
                  <strong>RUT:</strong> {item.rut}
                </div>
              )}

              {item.city && (
                <div>
                  <strong>Ciudad:</strong> {item.city}
                </div>
              )}

              {item.birthDate && (
                <div>
                  <strong>Nacimiento:</strong> {item.birthDate}
                </div>
              )}

              {item.emergencyContactName && (
                <div>
                  <strong>Contacto emergencia:</strong> {item.emergencyContactName}{" "}
                  {item.emergencyContactPhone ?? ""}
                </div>
              )}

              {item.type === "driver" && (
                <>
                  {item.licenseNumber && (
                    <div>
                      <strong>Licencia:</strong> {item.licenseNumber}
                    </div>
                  )}

                  {item.licenseExpiry && (
                    <div>
                      <strong>Vence licencia:</strong> {item.licenseExpiry}
                    </div>
                  )}
                </>
              )}

              {item.type === "guide" && (
                <>
                  {item.experienceYears !== null && (
                    <div>
                      <strong>Experiencia:</strong> {item.experienceYears} años
                    </div>
                  )}

                  {item.specialties && item.specialties.length > 0 && (
                    <div>
                      <strong>Especialidades:</strong> {item.specialties.join(", ")}
                    </div>
                  )}

                  {item.languages && item.languages.length > 0 && (
                    <div>
                      <strong>Idiomas:</strong> {item.languages.join(", ")}
                    </div>
                  )}

                  {item.maxGroupSize !== null && (
                    <div>
                      <strong>Grupo máximo:</strong> {item.maxGroupSize}
                    </div>
                  )}
                </>
              )}

              <div>
                <strong>Fecha postulación:</strong> {fmtDate(item.createdAt)}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <IonBadge color={uploadedDocuments > 0 ? "success" : "medium"}>
                {uploadedDocuments}/{documents.length} documentos
              </IonBadge>

              {item.type === "driver" && (
                <IonBadge color={vehicles.length > 0 ? "success" : "medium"}>
                  {vehicles.length} vehículo{vehicles.length !== 1 ? "s" : ""}
                </IonBadge>
              )}
            </div>

            {uploadedDocuments === 0 && vehicles.length === 0 && (
              <IonNote color="warning" style={{ display: "block", marginTop: "10px", fontWeight: 850 }}>
                No se encontraron archivos en esta respuesta del backend. El panel también revisa copias locales de registro, documentos, perfil y vehículo del postulante para mostrarlas automáticamente.
              </IonNote>
            )}

            {item.rejectionReason && (
              <IonNote color="danger" style={{ display: "block", marginTop: "12px", fontWeight: 800 }}>
                Motivo de rechazo: {item.rejectionReason}
              </IonNote>
            )}

            {item.notes && (
              <IonNote style={{ display: "block", marginTop: "10px", fontWeight: 700 }}>
                Notas: {item.notes}
              </IonNote>
            )}
          </IonCardContent>
        </IonCard>

        {item.type === "driver" && (
          <IonCard style={detailSectionStyle}>
            <IonCardHeader>
              <IonCardTitle style={{ fontSize: "1rem", fontWeight: 950 }}>
                Vehículos informados
              </IonCardTitle>
            </IonCardHeader>

            <IonCardContent>
              {vehicles.length === 0 && (
                <IonText color="medium">
                  <p style={{ margin: 0, fontWeight: 800 }}>
                    No hay vehículo registrado en esta postulación.
                  </p>
                </IonText>
              )}

              {vehicles.length > 0 && (
                <IonList style={{ background: "transparent", padding: 0 }}>
                  {vehicles.map((vehicle) => (
                    <AdminVehicleCard key={vehicle.id} vehicle={vehicle} />
                  ))}
                </IonList>
              )}
            </IonCardContent>
          </IonCard>
        )}

        <IonCard style={detailSectionStyle}>
          <IonCardHeader>
            <IonCardTitle style={{ fontSize: "1rem", fontWeight: 950 }}>
              Documentos e imágenes
            </IonCardTitle>
          </IonCardHeader>

          <IonCardContent>
            <IonList style={{ background: "transparent", padding: 0 }}>
              {documents.map((doc) => (
                <AdminDocumentCard key={doc.key} doc={doc} />
              ))}
            </IonList>
          </IonCardContent>
        </IonCard>

        {item.type === "driver" && (
          <IonCard style={detailSectionStyle}>
            <IonCardHeader>
              <IonCardTitle style={{ fontSize: "1rem", fontWeight: 950 }}>
                Contrato, documentos y capacitación
              </IonCardTitle>
              <IonNote>
                La aceptación del contrato no habilita por sí sola al
                conductor.
              </IonNote>
            </IonCardHeader>

            <IonCardContent>
              <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                <div>
                  <strong>Contrato:</strong>{" "}
                  {item.driverContractVersion
                    ? `Versión ${item.driverContractVersion}`
                    : "No registrado"}
                </div>
                <div>
                  <strong>Aceptado:</strong>{" "}
                  {item.driverContractAcceptedAt
                    ? new Date(item.driverContractAcceptedAt).toLocaleString("es-CL")
                    : "No"}
                </div>
                <div>
                  <strong>Desconexión:</strong>{" "}
                  {item.restWindowStart && item.restWindowEnd
                    ? `${item.restWindowStart} a ${item.restWindowEnd}`
                    : "No registrada"}
                </div>
                <div>
                  <strong>Entrega del PDF:</strong>{" "}
                  <IonBadge
                    color={
                      item.contractDeliveryStatus === "sent"
                        ? "success"
                        : item.contractDeliveryStatus === "failed"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {item.contractDeliveryStatus}
                  </IonBadge>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <IonButton
                  fill="outline"
                  color="warning"
                  disabled={!item.driverContractDocumentId || loading}
                  onClick={() => void downloadContract()}
                  style={{ "--border-radius": "14px", fontWeight: 900 } as CSSProperties}
                >
                  <IonIcon icon={downloadOutline} slot="start" />
                  Descargar contrato
                </IonButton>

                <IonButton
                  fill="outline"
                  color="tertiary"
                  disabled={!item.driverContractDocumentId || loading}
                  onClick={() => void resendContract()}
                  style={{ "--border-radius": "14px", fontWeight: 900 } as CSSProperties}
                >
                  <IonIcon icon={mailOutline} slot="start" />
                  Reenviar PDF
                </IonButton>
              </div>

              <h3 style={{ margin: "12px 0 8px", fontSize: ".95rem" }}>
                Checklist administrativo
              </h3>

              {[
                ["identity", "Identidad"],
                ["driverLicense", "Licencia de conducir"],
                ["profilePhoto", "Foto de perfil"],
                ["vehicle", "Vehículo y fotografías"],
                ["residence", "Residencia / habilitación territorial"],
                ["taxDomicile", "Domicilio tributario en Rapa Nui"],
                ["restWindow", "Franja de desconexión de 12 horas"],
                ["insurance", "Anexo de seguro, cuando corresponda"],
              ].map(([key, label]) => (
                <IonItem
                  key={key}
                  lines="none"
                  style={{
                    ...rowCardStyle,
                    "--min-height": "52px",
                    marginBottom: 7,
                  } as CSSProperties}
                >
                  <IonCheckbox
                    checked={reviewChecklist[key] === true}
                    onIonChange={(event) =>
                      toggleChecklist(key, event.detail.checked)
                    }
                    slot="start"
                  />
                  <IonLabel style={{ whiteSpace: "normal", fontWeight: 850 }}>
                    {label}
                  </IonLabel>
                </IonItem>
              ))}

              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <IonButton
                  color="success"
                  fill={documentReviewStatus === "approved" ? "solid" : "outline"}
                  disabled={loading}
                  onClick={() => {
                    setDocumentReviewStatus("approved");
                    void doReview("under_review", undefined, undefined, {
                      documentReviewStatus: "approved",
                      trainingStatus:
                        trainingStatus as "pending" | "approved" | "rejected",
                      reviewChecklist,
                    });
                  }}
                  style={{ "--border-radius": "14px", fontWeight: 900 } as CSSProperties}
                >
                  <IonIcon icon={shieldCheckmarkOutline} slot="start" />
                  Aprobar revisión documental
                </IonButton>

                <IonButton
                  color="warning"
                  fill={documentReviewStatus === "needs_information" ? "solid" : "outline"}
                  disabled={loading}
                  onClick={() => {
                    setDocumentReviewStatus("needs_information");
                    void doReview("on_hold", undefined, "Se solicitaron antecedentes adicionales.", {
                      documentReviewStatus: "needs_information",
                      trainingStatus:
                        trainingStatus as "pending" | "approved" | "rejected",
                      reviewChecklist,
                    });
                  }}
                  style={{ "--border-radius": "14px", fontWeight: 900 } as CSSProperties}
                >
                  Solicitar antecedentes
                </IonButton>

                <IonButton
                  color="tertiary"
                  fill={trainingStatus === "approved" ? "solid" : "outline"}
                  disabled={loading}
                  onClick={() => {
                    setTrainingStatus("approved");
                    void doReview("under_review", undefined, undefined, {
                      documentReviewStatus:
                        documentReviewStatus as "pending" | "approved" | "needs_information" | "rejected",
                      trainingStatus: "approved",
                      reviewChecklist,
                    });
                  }}
                  style={{ "--border-radius": "14px", fontWeight: 900 } as CSSProperties}
                >
                  <IonIcon icon={schoolOutline} slot="start" />
                  Marcar capacitación aprobada
                </IonButton>

                <IonButton
                  color="medium"
                  fill="outline"
                  disabled={loading}
                  onClick={() =>
                    void doReview("under_review", undefined, undefined, {
                      documentReviewStatus:
                        documentReviewStatus as "pending" | "approved" | "needs_information" | "rejected",
                      trainingStatus:
                        trainingStatus as "pending" | "approved" | "rejected",
                      reviewChecklist,
                    })
                  }
                  style={{ "--border-radius": "14px", fontWeight: 900 } as CSSProperties}
                >
                  Guardar checklist
                </IonButton>
              </div>

              {!driverApprovalReady && (
                <IonNote
                  color="warning"
                  style={{ display: "block", marginTop: 12, fontWeight: 900 }}
                >
                  Para aprobar faltan contrato aceptado, seis documentos,
                  revisión documental, capacitación o elementos obligatorios
                  del checklist.
                </IonNote>
              )}
            </IonCardContent>
          </IonCard>
        )}

        <IonCard style={detailSectionStyle}>
          <IonCardHeader>
            <IonCardTitle style={{ fontSize: "1rem", fontWeight: 950 }}>
              Decisión de administración
            </IonCardTitle>
          </IonCardHeader>

          <IonCardContent>
            <div style={{ display: "grid", gap: 9 }}>
              {item.status !== "pending" && (
                <IonButton
                  expand="block"
                  fill="outline"
                  color="warning"
                  onClick={() => setShowPendingAlert(true)}
                  disabled={loading}
                  style={{ "--border-radius": "16px", fontWeight: 950 } as CSSProperties}
                >
                  <IonIcon icon={timeOutline} slot="start" />
                  Volver a pendiente
                </IonButton>
              )}

              {isReviewable && (
                <IonButton
                  expand="block"
                  fill="outline"
                  color="tertiary"
                  onClick={() => setShowReviewAlert(true)}
                  disabled={loading}
                  style={{ "--border-radius": "16px", fontWeight: 950 } as CSSProperties}
                >
                  <IonIcon icon={hourglassOutline} slot="start" />
                  En revisión
                </IonButton>
              )}

              <IonButton
                expand="block"
                color="success"
                onClick={() => setShowApproveAlert(true)}
                disabled={loading || item.status === "approved" || !driverApprovalReady}
                style={{ "--border-radius": "16px", fontWeight: 950 } as CSSProperties}
              >
                <IonIcon icon={checkmarkCircleOutline} slot="start" />
                Aprobar conductor
              </IonButton>

              <IonButton
                expand="block"
                color="danger"
                onClick={() => setShowRejectAlert(true)}
                disabled={loading || item.status === "rejected"}
                style={{ "--border-radius": "16px", fontWeight: 950 } as CSSProperties}
              >
                <IonIcon icon={closeCircleOutline} slot="start" />
                Rechazar
              </IonButton>

              {isReviewable && (
                <IonButton
                  expand="block"
                  color="warning"
                  onClick={() => setShowHoldAlert(true)}
                  disabled={loading}
                  style={{ "--border-radius": "16px", "--color": "#111", fontWeight: 950 } as CSSProperties}
                >
                  En espera
                </IonButton>
              )}
            </div>

            {loading && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
                <IonSpinner name="crescent" />
              </div>
            )}

            {error && (
              <IonText color="danger">
                <p style={{ fontWeight: 900 }}>{error}</p>
              </IonText>
            )}
          </IonCardContent>
        </IonCard>

        <IonAlert
          isOpen={showApproveAlert}
          header="Aprobar postulación"
          message={`¿Confirmas que deseas aprobar la postulación de ${item.firstName} ${item.lastName}? Se creará o actualizará su cuenta como conductor.`}
          buttons={[
            { text: "Cancelar", role: "cancel" },
            {
              text: "Aprobar",
              handler: () =>
                void doReview("approved", undefined, undefined, {
                  documentReviewStatus:
                    documentReviewStatus as "pending" | "approved" | "needs_information" | "rejected",
                  trainingStatus:
                    trainingStatus as "pending" | "approved" | "rejected",
                  reviewChecklist,
                }),
            },
          ]}
          onDidDismiss={() => setShowApproveAlert(false)}
        />

        <IonAlert
          isOpen={showRejectAlert}
          header="Rechazar postulación"
          inputs={[{ name: "reason", type: "text", placeholder: "Motivo del rechazo obligatorio" }]}
          buttons={[
            { text: "Cancelar", role: "cancel" },
            {
              text: "Rechazar",
              handler: (data: { reason?: string }) => {
                if (!data.reason?.trim()) return false;
                void doReview("rejected", data.reason.trim());
                return true;
              },
            },
          ]}
          onDidDismiss={() => setShowRejectAlert(false)}
        />

        <IonAlert
          isOpen={showReviewAlert}
          header="Marcar en revisión"
          message="¿Marcar esta postulación como en revisión?"
          buttons={[
            { text: "Cancelar", role: "cancel" },
            { text: "Confirmar", handler: () => void doReview("under_review") },
          ]}
          onDidDismiss={() => setShowReviewAlert(false)}
        />

        <IonAlert
          isOpen={showHoldAlert}
          header="Poner en espera"
          inputs={[{ name: "notes", type: "text", placeholder: "Notas opcionales" }]}
          buttons={[
            { text: "Cancelar", role: "cancel" },
            {
              text: "Confirmar",
              handler: (data: { notes?: string }) =>
                void doReview("on_hold", undefined, data.notes?.trim()),
            },
          ]}
          onDidDismiss={() => setShowHoldAlert(false)}
        />

        <IonAlert
          isOpen={showPendingAlert}
          header="Volver a pendiente"
          message="¿Deseas volver esta postulación al estado pendiente?"
          buttons={[
            { text: "Cancelar", role: "cancel" },
            { text: "Confirmar", handler: () => void doReview("pending") },
          ]}
          onDidDismiss={() => setShowPendingAlert(false)}
        />
      </IonContent>
    </>
  );
}

export function AdminApplicationsPage(): JSX.Element {
  const { session } = useAuth();
  const [items, setItems] = useState<ApplicationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<ApplicationData | null>(null);
  const modal = useRef<HTMLIonModalElement>(null);

  async function load() {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const result = await applicationsService.listApplications(session.accessToken, { page: 1 });
      setItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar postulaciones.");
    } finally {
      setLoading(false);
    }
  }

  useIonViewWillEnter(() => {
    void load();
  });

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  const total = items.length;
  const pending = items.filter((i) => i.status === "pending").length;
  const inReview = items.filter((i) => i.status === "under_review").length;
  const approved = items.filter((i) => i.status === "approved").length;
  const rejected = items.filter((i) => i.status === "rejected").length;

  function handleUpdated(updated: ApplicationData) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelected(updated);
  }

  async function openApplication(item: ApplicationData): Promise<void> {
    if (!session?.accessToken) return;

    setError(null);

    try {
      const detail = await applicationsService.getApplication(
        session.accessToken,
        item.id,
      );

      setSelected(detail);
    } catch (openError) {
      setSelected(item);
      setError(
        openError instanceof Error
          ? openError.message
          : "No se pudo cargar el detalle completo de la postulación.",
      );
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Postulaciones</IonTitle>
          <IonButtons slot="end">
            <IonButton fill="clear" color="light" onClick={() => void load()} disabled={loading}>
              <IonIcon icon={refreshOutline} slot="start" />
              Actualizar
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent
        style={{
          "--background":
            "linear-gradient(180deg, rgba(15,15,15,.78), rgba(15,15,15,.92)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat",
        } as CSSProperties}
      >
        <IonRefresher
          slot="fixed"
          onIonRefresh={(e) => {
            void load().then(() => e.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", padding: "12px" }}>
          {[
            { label: "Total", count: total, color: "primary", icon: documentTextOutline },
            { label: "Pendientes", count: pending, color: "warning", icon: timeOutline },
            { label: "En revisión", count: inReview, color: "tertiary", icon: hourglassOutline },
            { label: "Aprobadas", count: approved, color: "success", icon: checkmarkCircleOutline },
            { label: "Rechazadas", count: rejected, color: "danger", icon: closeCircleOutline },
          ].map(({ label, count, color, icon }) => (
            <IonCard key={label} style={{ margin: 0, textAlign: "center", borderRadius: 18 }}>
              <IonCardContent style={{ padding: "10px 8px" }}>
                <IonIcon icon={icon} color={color} style={{ fontSize: 20 }} />
                <div style={{ fontSize: "1.4rem", fontWeight: 950, color: `var(--ion-color-${color})` }}>
                  {count}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", fontWeight: 800 }}>
                  {label}
                </div>
              </IonCardContent>
            </IonCard>
          ))}
        </div>

        <IonSegment
          value={filter}
          onIonChange={(e) => setFilter(String(e.detail.value ?? "all"))}
          style={{ padding: "0 12px 8px" }}
        >
          <IonSegmentButton value="all">
            <IonLabel>Todas</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="pending">
            <IonLabel>Pend.</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="under_review">
            <IonLabel>Revisión</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="approved">
            <IonLabel>Aprob.</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="rejected">
            <IonLabel>Rech.</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {error && (
          <IonText color="danger">
            <p style={{ padding: "0 16px", fontWeight: 900 }}>{error}</p>
          </IonText>
        )}

        {!loading && filtered.length === 0 && (
          <IonCard style={{ margin: "12px", borderRadius: 18 }}>
            <IonCardContent style={{ textAlign: "center", padding: "28px 18px" }}>
              <IonIcon icon={documentTextOutline} style={{ fontSize: 42, opacity: .45 }} />
              <div style={{ marginTop: 10, fontWeight: 950 }}>Sin postulaciones</div>
              <IonNote>No hay postulaciones para este filtro.</IonNote>
            </IonCardContent>
          </IonCard>
        )}

        <IonList style={{ padding: "8px 12px 90px", background: "transparent" }}>
          {filtered.map((item) => {
            const docs = buildDocumentViews(item);
            const vehicles = buildVehicleViews(item);
            const uploadedDocs = docs.filter((doc) => doc.url).length;

            return (
              <IonItem
                key={item.id}
                button
                onClick={() => {
                  void openApplication(item);
                }}
                detail
                style={{
                  ...rowCardStyle,
                  "--min-height": "92px",
                } as CSSProperties}
              >
                <IonIcon
                  icon={item.type === "driver" ? carOutline : documentTextOutline}
                  slot="start"
                  color={item.type === "driver" ? "warning" : "medium"}
                />
                <IonLabel>
                  <h3 style={{ fontWeight: 950 }}>
                    {item.firstName} {item.lastName}
                  </h3>
                  <p>
                    {TYPE_LABEL[item.type] ?? item.type} — {fmtDate(item.createdAt)}
                  </p>
                  <p>
                    Docs: {uploadedDocs}/{docs.length}
                    {item.type === "driver" ? ` · Vehículos: ${vehicles.length}` : ""}
                  </p>
                </IonLabel>
                <IonBadge slot="end" color={STATUS_COLOR[item.status] ?? "medium"}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </IonBadge>
              </IonItem>
            );
          })}
        </IonList>

        <IonModal ref={modal} isOpen={selected !== null} onDidDismiss={() => setSelected(null)}>
          {selected !== null && session?.accessToken && (
            <AdminApplicationDetailModal
              item={selected}
              token={session.accessToken}
              onClose={() => setSelected(null)}
              onUpdated={handleUpdated}
            />
          )}
        </IonModal>
      </IonContent>
    </IonPage>
  );
}

export default AdminApplicationsPage;
