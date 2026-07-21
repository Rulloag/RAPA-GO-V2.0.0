  import {
    IonAlert,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCheckbox,
    IonChip,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonItemDivider,
    IonLabel,
    IonList,
    IonNote,
    IonPage,
    IonSpinner,
    IonText,
    IonTextarea,
    IonTitle,
    IonToggle,
    IonToolbar,
    useIonViewWillEnter,
  } from "@ionic/react";
  import { useEffect, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
  import { useHistory } from "react-router-dom";
  import { useAuth } from "../../features/auth/index.js";
  import { applicationsService, type ApplicationData } from "../../features/applications/applications.service.js";

  const SPECIALTIES = ["Arqueología", "Botánica", "Astronomía", "Historia", "Cultura Rapa Nui", "Senderismo"];
  const OFFERED_TOURS = ["Ahu Tongariki", "Rano Raraku", "Anakena", "Orongo", "Tahai", "Custom"];
  const LANGUAGES = ["Español", "Inglés", "Rapa Nui", "Francés", "Alemán", "Portugués"];

  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  type SessionUserForApplication = {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    rut?: string | null;
    birthDate?: string | null;
  };

  function splitName(user?: SessionUserForApplication): { firstName: string; lastName: string } {
    const fullName = user?.name?.trim() ?? "";
    const parts = fullName.split(/\s+/).filter(Boolean);

    const firstName = user?.firstName?.trim() || parts[0] || "";
    const lastName =
      user?.lastName?.trim() ||
      (parts.length > 1 ? parts.slice(1).join(" ") : "");

    return { firstName, lastName };
  }

  function fileLabel(file: File | null): string {
    return file ? `✓ ${file.name}` : "Sin archivo seleccionado";
  }

  function getSelectedFile(event: Event): File | null {
    const input = event.target as HTMLInputElement;
    return input.files?.[0] ?? null;
  }

  function normalizeRut(value: string): string {
    return formatRut(value);
  }

  function isEmailValid(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

function readStoredRegistrationProfile(): SessionUserForApplication {
  try {
    const raw = localStorage.getItem("rapago_registration_profile");
    const parsed = raw ? (JSON.parse(raw) as SessionUserForApplication) : {};

    return {
      ...parsed,
      phone:
        parsed.phone ??
        localStorage.getItem("rapago_profile_phone") ??
        localStorage.getItem("rapago_driver_phone") ??
        "",
      rut:
        parsed.rut ??
        localStorage.getItem("rapago_profile_rut") ??
        localStorage.getItem("rapago_driver_rut") ??
        "",
    };
  } catch {
    return {};
  }
}

function getAutoAccountData(user?: SessionUserForApplication): {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rut: string;
  birthDate: string;
} {
  const stored = readStoredRegistrationProfile();
  const names = splitName({
    ...stored,
    ...user,
    name: user?.name || stored.name,
    firstName: user?.firstName || stored.firstName,
    lastName: user?.lastName || stored.lastName,
  });

  return {
    firstName: names.firstName,
    lastName: names.lastName,
    email: user?.email?.trim() || stored.email?.trim() || "",
    phone: user?.phone?.trim() || stored.phone?.trim() || "",
    rut: user?.rut?.trim() || stored.rut?.trim() || "",
    birthDate: user?.birthDate?.trim() || stored.birthDate?.trim() || "",
  };
}

function onlyNumbers(value: string, maxLength = 12): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function cleanPhone(value: string): string {
  const digits = onlyNumbers(value, 11);
  return digits;
}

function cleanRut(value: string): string {
  return onlyNumbers(value, 9);
}

function formatRut(value: string): string {
  const clean = cleanRut(value);
  if (clean.length <= 1) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  const grouped =
    body
      .split("")
      .reverse()
      .join("")
      .match(/.{1,3}/g)
      ?.map((part) => part.split("").reverse().join(""))
      .reverse()
      .join(".") ?? body;

  return `${grouped}-${dv}`;
}

function cleanNumber(value: string, maxLength = 3): string {
  return onlyNumbers(value, maxLength);
}

function persistApplicationAutofill(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rut: string;
  birthDate?: string;
}): void {
  try {
    const current = readStoredRegistrationProfile();
    const next = {
      ...current,
      name: `${data.firstName} ${data.lastName}`.trim(),
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      rut: data.rut,
      birthDate: data.birthDate ?? current.birthDate ?? "",
    };

    localStorage.setItem("rapago_registration_profile", JSON.stringify(next));
    if (data.phone) {
      localStorage.setItem("rapago_profile_phone", data.phone);
      localStorage.setItem("rapago_driver_phone", data.phone);
    }
    if (data.rut) {
      localStorage.setItem("rapago_profile_rut", data.rut);
      localStorage.setItem("rapago_driver_rut", data.rut);
    }
  } catch {
    // No bloquea la inscripción.
  }
}

function isPhoneValid(value: string): boolean {
  const digits = cleanPhone(value);
  return /^9\d{8}$/.test(digits) || /^569\d{8}$/.test(digits);
}

function isRutValid(value: string): boolean {
  const digits = cleanRut(value);
  return digits.length >= 8 && digits.length <= 9;
}


  function makeApplicationStyles() {
    const cardStyle: CSSProperties = {
      margin: "0 0 14px",
      borderRadius: "22px",
      background: "#F6F2EC",
      color: "#111111",
      border: "2px solid rgba(200,155,60,.26)",
      boxShadow: "0 14px 34px rgba(0,0,0,.26)",
    };

    const cardTitleStyle: CSSProperties = {
      color: "#111111",
      fontSize: "1rem",
      fontWeight: 950,
    };

    const noteStyle: CSSProperties = {
      color: "#404040",
      display: "block",
      marginTop: "4px",
      fontWeight: 650,
      lineHeight: 1.45,
    };

    const itemStyle: CSSProperties = {
      "--background": "#ffffff",
      "--color": "#111111",
      "--border-color": "transparent",
      "--highlight-color-focused": "#C89B3C",
      "--padding-start": "14px",
      "--inner-padding-end": "14px",
      border: "2px solid #E6D4B4",
      borderRadius: "18px",
      marginBottom: "12px",
      color: "#111111",
    } as CSSProperties;

    const labelStyle: CSSProperties = {
      color: "#111111",
      fontWeight: 950,
      fontSize: ".9rem",
    };

    const inputStyle: CSSProperties = {
      "--color": "#111111",
      "--placeholder-color": "#777777",
      "--placeholder-opacity": "1",
      color: "#111111",
      fontWeight: 800,
    } as CSSProperties;

    const fileButtonStyle: CSSProperties = {
      width: "100%",
      display: "block",
      border: "2px dashed rgba(200,155,60,.85)",
      background: "#ffffff",
      color: "#111111",
      borderRadius: "18px",
      padding: "14px",
      textAlign: "left",
      fontWeight: 950,
      cursor: "pointer",
    };

    const sectionTextStyle: CSSProperties = {
      color: "#404040",
      fontWeight: 650,
      lineHeight: 1.45,
    };

    return {
      cardStyle,
      cardTitleStyle,
      noteStyle,
      itemStyle,
      labelStyle,
      inputStyle,
      fileButtonStyle,
      sectionTextStyle,
    };
  }

  type DriverVehicleKind = "own" | "optional";

  type DriverVehicleForm = {
    id: string;
    kind: DriverVehicleKind;
    brand: string;
    model: string;
    year: string;
    plate: string;
    color: string;
    photoFile: File | null;
    expiresAt: string;
  };

  type DriverApplicationVehiclePayload = {
    id: string;
    order: number;
    primary: boolean;
    ownership: DriverVehicleKind;
    brand: string;
    model: string;
    year: string;
    plate: string;
    color: string;
    label: string;
    imageDataUrl: string | null;
    photoDataUrl: string | null;
    photoUrl: string | null;
    vehiclePhotoUrl: string | null;
    vehicleImageUrl: string | null;
    imageName: string | null;
    expiresAt: string | null;
    createdAt: string;
    approvedStatus: "pending_admin_review";
    photoProvided: boolean;
    photoFileName?: string;
    photoFileType?: string;
    photoFileSize?: number;
  };

  type ApplicationFilePayload = {
    provided: boolean;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    dataUrl: string | null;
    url: string | null;
    previewUrl: string | null;
    uploadedAt: string | null;
  };

  function createDriverVehicle(index: number, kind: DriverVehicleKind = "optional"): DriverVehicleForm {
    return {
      id: `vehicle-${Date.now()}-${index}`,
      kind,
      brand: "",
      model: "",
      year: "",
      plate: "",
      color: "",
      photoFile: null,
      expiresAt: "",
    };
  }

  function cleanVehicleText(value: string, maxLength = 40): string {
    return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  function cleanVehicleYear(value: string): string {
    return onlyNumbers(value, 4);
  }

  function cleanVehiclePlate(value: string): string {
    return value
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "")
      .slice(0, 12);
  }

  function isVehicleComplete(vehicle: DriverVehicleForm): boolean {
    const requiredFieldsReady =
      cleanVehicleText(vehicle.brand).length > 0 &&
      cleanVehicleText(vehicle.model).length > 0 &&
      cleanVehicleYear(vehicle.year).length === 4 &&
      cleanVehiclePlate(vehicle.plate).length >= 5 &&
      cleanVehicleText(vehicle.color).length > 0 &&
      vehicle.photoFile != null;

    if (!requiredFieldsReady) return false;

    if (vehicle.kind === "optional") {
      return vehicle.expiresAt.trim().length > 0;
    }

    return true;
  }

  function vehicleLabel(vehicle: Pick<DriverVehicleForm, "brand" | "model" | "year" | "color" | "plate">): string {
    return [
      cleanVehicleText(vehicle.brand),
      cleanVehicleText(vehicle.model),
      cleanVehicleYear(vehicle.year),
      cleanVehicleText(vehicle.color),
      cleanVehiclePlate(vehicle.plate),
    ]
      .filter(Boolean)
      .join(" ");
  }

  function getApplicationOwnerKey(source?: unknown): string {
    if (!source || typeof source !== "object") return "driver-global";

    const data = source as Record<string, unknown>;
    const candidates = [
      data.ownerKey,
      data.driverOwnerKey,
      data.driverEmail,
      data.email,
      data.userEmail,
      data.driverUserEmail,
      data.id,
      data.userId,
      data.driverId,
      data.driverUserId,
      data.driverFullName,
      data.driverName,
      data.fullName,
      data.name,
    ];

    for (const value of candidates) {
      const text = String(value ?? "").trim();
      if (text) return text.toLowerCase();
    }

    return "driver-global";
  }

  function getApplicationScopedStorageKey(baseKey: string, source?: unknown): string {
    return `${baseKey}__${encodeURIComponent(getApplicationOwnerKey(source))}`;
  }

  function safeSetApplicationStorageItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // No bloquea la postulación si el navegador no permite guardar.
    }

    try {
      sessionStorage.setItem(key, value);
    } catch {
      // No bloquea la postulación.
    }
  }

  function writeApplicationScopedStorageItem(baseKey: string, value: string, source?: unknown): void {
    const clean = value.trim();
    const scopedKey = getApplicationScopedStorageKey(baseKey, source);
    const ownerKey = getApplicationOwnerKey(source);

    if (!clean) return;

    safeSetApplicationStorageItem(scopedKey, clean);
    safeSetApplicationStorageItem(baseKey, clean);
    safeSetApplicationStorageItem(`${baseKey}_owner_key`, ownerKey);
  }

  function readImageFileAsDataUrl(file: File | null, maxSide = 520, quality = 0.5): Promise<string | null> {
    return new Promise((resolve) => {
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const reader = new FileReader();

        reader.onload = () => {
          const raw = typeof reader.result === "string" ? reader.result : "";
          if (!raw.startsWith("data:image/")) {
            resolve(raw || null);
            return;
          }

          const img = new Image();

          img.onload = () => {
            try {
              const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
              const width = Math.max(1, Math.round(img.width * ratio));
              const height = Math.max(1, Math.round(img.height * ratio));

              const canvas = document.createElement("canvas");
              canvas.width = width;
              canvas.height = height;

              const ctx = canvas.getContext("2d");
              if (!ctx) {
                resolve(raw);
                return;
              }

              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL("image/jpeg", quality));
            } catch {
              resolve(raw);
            }
          };

          img.onerror = () => resolve(raw);
          img.src = raw;
        };

        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      } catch {
        resolve(null);
      }
    });
  }

  async function buildApplicationFilePayload(
    file: File | null,
    options: { maxSide?: number; quality?: number } = {},
  ): Promise<ApplicationFilePayload> {
    const dataUrl = await readImageFileAsDataUrl(
      file,
      options.maxSide ?? 520,
      options.quality ?? 0.48,
    );

    return {
      provided: file != null,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      dataUrl,
      url: dataUrl,
      previewUrl: dataUrl,
      uploadedAt: file ? new Date().toISOString() : null,
    };
  }

  function applicationFileUrl(file: ApplicationFilePayload | null | undefined): string | null {
    return file?.dataUrl ?? file?.url ?? file?.previewUrl ?? null;
  }

  function safeRemoveApplicationStorageItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // No bloquea la postulación.
    }

    try {
      sessionStorage.removeItem(key);
    } catch {
      // No bloquea la postulación.
    }
  }

  function cleanupOldApplicationMirrors(): void {
    try {
      const keysToRemove: string[] = [];

      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) continue;

        if (
          key.startsWith("rapago_driver_application") ||
          key.startsWith("rapago_application_driver") ||
          key.startsWith("rapago_applications_driver") ||
          key.startsWith("rapago_pending_driver_application") ||
          key.startsWith("rapago_registration_driver_application") ||
          key.startsWith("rapago_driver_document_") ||
          key.startsWith("rapago_driver_documents_bundle_") ||
          key === "rapago_driver_public_profile_v1" ||
          key === "rapago_driver_profile_v1" ||
          key === "rapago_driver_document_images_v1" ||
          key === "rapago_driver_vehicle_images_v1" ||
          key === "rapago_driver_vehicle_photo_v1"
        ) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(safeRemoveApplicationStorageItem);
    } catch {
      // No bloquea la postulación.
    }
  }

  function stripUndefinedDeep(value: unknown, depth = 0): unknown {
    if (depth > 8) return undefined;
    if (value === undefined) return undefined;
    if (value === null) return null;

    if (Array.isArray(value)) {
      return value
        .map((entry) => stripUndefinedDeep(entry, depth + 1))
        .filter((entry) => entry !== undefined);
    }

    if (typeof value === "object") {
      const source = value as Record<string, unknown>;
      const output: Record<string, unknown> = {};

      for (const [key, entry] of Object.entries(source)) {
        const cleaned = stripUndefinedDeep(entry, depth + 1);
        if (cleaned !== undefined) output[key] = cleaned;
      }

      return output;
    }

    return value;
  }

  function buildLocalAdminApplicationMirror(application: Record<string, unknown>, user?: unknown): Record<string, unknown> {
    const ownerKey = getApplicationOwnerKey(user ?? application);
    const now = new Date().toISOString();
    const record = application as Record<string, unknown>;
    const vehicle = record.vehicle && typeof record.vehicle === "object"
      ? (record.vehicle as Record<string, unknown>)
      : {};
    const documents = record.documents && typeof record.documents === "object"
      ? (record.documents as Record<string, unknown>)
      : {};

    return stripUndefinedDeep({
      id: record.id,
      applicationId: record.applicationId ?? record.id,
      type: record.type ?? "driver",
      status: record.status ?? "pending",
      firstName: record.firstName,
      lastName: record.lastName,
      email: record.email,
      userEmail: record.email,
      contactEmail: record.email,
      driverEmail: record.email,
      phone: record.phone,
      rut: record.rut,
      birthDate: record.birthDate,
      createdAt: record.createdAt ?? now,
      updatedAt: record.updatedAt ?? now,
      ownerKey,
      driverOwnerKey: ownerKey,
      localMirrorUpdatedAt: now,
      localMirrorForAdmin: true,

      idFrontUrl: record.idFrontUrl,
      identityFrontUrl: record.identityFrontUrl,
      carnetFrenteUrl: record.carnetFrenteUrl,
      idFrontFileName: record.idFrontFileName,
      identityFrontFileName: record.identityFrontFileName,

      idBackUrl: record.idBackUrl,
      identityBackUrl: record.identityBackUrl,
      carnetReversoUrl: record.carnetReversoUrl,
      idBackFileName: record.idBackFileName,
      identityBackFileName: record.identityBackFileName,

      licenseFrontUrl: record.licenseFrontUrl,
      driverLicenseFrontUrl: record.driverLicenseFrontUrl,
      licenciaFrenteUrl: record.licenciaFrenteUrl,
      licenseFrontFileName: record.licenseFrontFileName,
      driverLicenseFrontFileName: record.driverLicenseFrontFileName,

      licenseBackUrl: record.licenseBackUrl,
      driverLicenseBackUrl: record.driverLicenseBackUrl,
      licenciaReversoUrl: record.licenciaReversoUrl,
      licenseBackFileName: record.licenseBackFileName,
      driverLicenseBackFileName: record.driverLicenseBackFileName,

      profilePhotoUrl: record.profilePhotoUrl,
      profileImageUrl: record.profileImageUrl,
      avatarUrl: record.avatarUrl,
      photoUrl: record.photoUrl,
      profilePhotoFileName: record.profilePhotoFileName,

      vehiclePhotoUrl: record.vehiclePhotoUrl,
      vehicleImageUrl: record.vehicleImageUrl,
      carPhotoUrl: record.carPhotoUrl,
      autoPhotoUrl: record.autoPhotoUrl,
      vehiclePhotoFileName: record.vehiclePhotoFileName,

      vehicle: {
        ...vehicle,
        photoDataUrl: vehicle.photoDataUrl ?? record.vehiclePhotoUrl,
        imageDataUrl: vehicle.imageDataUrl ?? record.vehicleImageUrl,
        photoUrl: vehicle.photoUrl ?? record.vehiclePhotoUrl,
        vehiclePhotoUrl: vehicle.vehiclePhotoUrl ?? record.vehiclePhotoUrl,
        vehicleImageUrl: vehicle.vehicleImageUrl ?? record.vehicleImageUrl,
      },
      vehicles: record.vehicles,
      driverVehicles: record.driverVehicles,
      documents,
      localDocumentKeys: Object.keys(documents),
    }, 0) as Record<string, unknown>;
  }


  function collectDirectApplicationFileEntries(mirror: Record<string, unknown>): Array<{
    suffix: string;
    url: string;
    fileName?: string;
  }> {
    const documents = mirror.documents && typeof mirror.documents === "object"
      ? (mirror.documents as Record<string, unknown>)
      : {};

    function getUrl(...values: unknown[]): string | null {
      for (const value of values) {
        if (typeof value === "string" && value.trim().startsWith("data:")) return value.trim();
        if (value && typeof value === "object") {
          const record = value as Record<string, unknown>;
          const nested = getUrl(
            record.dataUrl,
            record.url,
            record.previewUrl,
            record.fileUrl,
            record.imageUrl,
            record.photoUrl,
            record.base64,
            record.value,
          );
          if (nested) return nested;
        }
      }
      return null;
    }

    function getName(...values: unknown[]): string | undefined {
      for (const value of values) {
        if (typeof value === "string" && value.trim() && !value.startsWith("data:")) return value.trim();
        if (value && typeof value === "object") {
          const record = value as Record<string, unknown>;
          const nested = getName(record.fileName, record.name, record.originalName, record.imageName);
          if (nested) return nested;
        }
      }
      return undefined;
    }

    const identityFront = documents.identityFront ?? documents.identityCardFront ?? documents.idFront ?? documents.carnetFrente ?? documents.cedulaFrente;
    const identityBack = documents.identityBack ?? documents.identityCardBack ?? documents.idBack ?? documents.carnetReverso ?? documents.cedulaReverso;
    const licenseFront = documents.licenseFront ?? documents.driverLicenseFront ?? documents.licenciaFrente ?? (documents.driverLicense as Record<string, unknown> | undefined)?.front;
    const licenseBack = documents.licenseBack ?? documents.driverLicenseBack ?? documents.licenciaReverso ?? (documents.driverLicense as Record<string, unknown> | undefined)?.back;
    const profilePhoto = documents.profilePhoto ?? documents.profileImage ?? documents.avatar ?? documents.photo;
    const vehiclePhoto = documents.vehiclePhoto ?? documents.vehicleImage ?? mirror.vehiclePhotoUrl ?? (mirror.vehicle as Record<string, unknown> | undefined)?.vehiclePhotoUrl;

    const entries = [
      {
        suffix: "identity_front",
        url: getUrl(mirror.idFrontUrl, mirror.identityFrontUrl, mirror.carnetFrenteUrl, identityFront),
        fileName: getName(mirror.idFrontFileName, mirror.identityFrontFileName, identityFront),
      },
      {
        suffix: "identity_back",
        url: getUrl(mirror.idBackUrl, mirror.identityBackUrl, mirror.carnetReversoUrl, identityBack),
        fileName: getName(mirror.idBackFileName, mirror.identityBackFileName, identityBack),
      },
      {
        suffix: "license_front",
        url: getUrl(mirror.licenseFrontUrl, mirror.driverLicenseFrontUrl, mirror.licenciaFrenteUrl, licenseFront),
        fileName: getName(mirror.licenseFrontFileName, mirror.driverLicenseFrontFileName, licenseFront),
      },
      {
        suffix: "license_back",
        url: getUrl(mirror.licenseBackUrl, mirror.driverLicenseBackUrl, mirror.licenciaReversoUrl, licenseBack),
        fileName: getName(mirror.licenseBackFileName, mirror.driverLicenseBackFileName, licenseBack),
      },
      {
        suffix: "profile_photo",
        url: getUrl(mirror.profilePhotoUrl, mirror.profileImageUrl, mirror.avatarUrl, mirror.photoUrl, profilePhoto),
        fileName: getName(mirror.profilePhotoFileName, profilePhoto),
      },
      {
        suffix: "vehicle_photo",
        url: getUrl(mirror.vehiclePhotoUrl, mirror.vehicleImageUrl, mirror.carPhotoUrl, mirror.autoPhotoUrl, vehiclePhoto),
        fileName: getName(mirror.vehiclePhotoFileName, vehiclePhoto),
      },
    ];

    return entries.filter((entry): entry is { suffix: string; url: string; fileName: string } => Boolean(entry.url));
  }

  function persistDirectApplicationFilesForAdmin(mirror: Record<string, unknown>): void {
    const email = String(mirror.email ?? "").trim().toLowerCase();
    const rut = String(mirror.rut ?? "").replace(/[.\s-]/g, "").toLowerCase();
    const phone = String(mirror.phone ?? "").replace(/\D/g, "");
    const id = String(mirror.id ?? mirror.applicationId ?? "").trim();
    const identityParts = [
      "latest",
      email ? `email_${email}` : "",
      email ? `email_${encodeURIComponent(email)}` : "",
      rut ? `rut_${rut}` : "",
      phone ? `phone_${phone}` : "",
      id ? `id_${id}` : "",
    ].filter(Boolean);

    const entries = collectDirectApplicationFileEntries(mirror);
    const bundle: Record<string, unknown> = {
      id,
      email,
      rut,
      phone,
      type: mirror.type ?? "driver",
      firstName: mirror.firstName,
      lastName: mirror.lastName,
      updatedAt: new Date().toISOString(),
      documents: {},
    };

    for (const entry of entries) {
      (bundle.documents as Record<string, unknown>)[entry.suffix] = {
        url: entry.url,
        dataUrl: entry.url,
        previewUrl: entry.url,
        fileName: entry.fileName ?? "archivo-adjunto.jpg",
      };

      for (const identityPart of identityParts) {
        const baseKey = `rapago_driver_document_${entry.suffix}_${identityPart}`;
        try {
          localStorage.setItem(baseKey, entry.url);
          sessionStorage.setItem(baseKey, entry.url);
          if (entry.fileName) {
            localStorage.setItem(`${baseKey}_fileName`, entry.fileName);
            sessionStorage.setItem(`${baseKey}_fileName`, entry.fileName);
          }
        } catch {
          // Si el navegador está lleno, igual intentamos con el siguiente documento.
        }
      }
    }

    const bundleJson = JSON.stringify(bundle);
    for (const identityPart of identityParts) {
      const bundleKey = `rapago_driver_documents_bundle_${identityPart}`;
      try {
        localStorage.setItem(bundleKey, bundleJson);
        sessionStorage.setItem(bundleKey, bundleJson);
      } catch {
        // No bloquea la postulación.
      }
    }
  }

  function persistSubmittedDriverApplicationForAdmin(
    application: Record<string, unknown>,
    user?: unknown,
  ): void {
    try {
      cleanupOldApplicationMirrors();

      const mirror = buildLocalAdminApplicationMirror(application, user);

      // Primero guardamos cada documento por separado. Así no se pierden si el
      // JSON completo queda muy pesado para localStorage.
      persistDirectApplicationFilesForAdmin(mirror);

      const email = String(mirror.email ?? "").trim().toLowerCase();
      const rut = String(mirror.rut ?? "").replace(/[.\s-]/g, "").toLowerCase();
      const phone = String(mirror.phone ?? "").replace(/\D/g, "");
      const lightMirror = {
        ...(buildApiSafeApplicationInput(mirror) as Record<string, unknown>),
        id: mirror.id,
        applicationId: mirror.applicationId ?? mirror.id,
        type: mirror.type ?? "driver",
        status: mirror.status ?? "pending",
        firstName: mirror.firstName,
        lastName: mirror.lastName,
        email: mirror.email,
        userEmail: mirror.email,
        contactEmail: mirror.email,
        driverEmail: mirror.email,
        phone: mirror.phone,
        rut: mirror.rut,
        birthDate: mirror.birthDate,
        createdAt: mirror.createdAt,
        updatedAt: mirror.updatedAt,
        ownerKey: mirror.ownerKey,
        driverOwnerKey: mirror.driverOwnerKey,
        localMirrorForAdmin: true,
        localDocumentsSaved: true,
      };
      const json = JSON.stringify(lightMirror);

      const keys = new Set<string>([
        "rapago_driver_application_latest",
        "rapago_driver_application_submitted",
        "rapago_pending_driver_application",
        email ? `rapago_driver_application_${email}` : "",
        email ? `rapago_driver_application_${encodeURIComponent(email)}` : "",
        email ? `rapago_application_driver_${email}` : "",
        email ? `rapago_application_driver_${encodeURIComponent(email)}` : "",
        rut ? `rapago_driver_application_${rut}` : "",
        phone ? `rapago_driver_application_${phone}` : "",
      ].filter(Boolean));

      for (const key of keys) {
        try {
          localStorage.setItem(key, json);
          sessionStorage.setItem(key, json);
        } catch {
          // Si una copia falla por cuota, seguimos con las siguientes.
        }
      }

      window.dispatchEvent(new CustomEvent("rapago:applications-updated", { detail: { application: lightMirror } }));
      window.dispatchEvent(new CustomEvent("rapago:admin-applications-updated", { detail: { application: lightMirror } }));
      window.dispatchEvent(new CustomEvent("rapago:driver-application-submitted", { detail: { application: lightMirror } }));
    } catch {
      // No bloquea el envío. La API también recibe la postulación liviana.
    }
  }


  function stripHeavyApplicationPayload(value: unknown, depth = 0): unknown {
    if (depth > 8) return undefined;

    if (value == null) return undefined;

    if (typeof value === "string") {
      if (value.startsWith("data:image/") || value.startsWith("data:application/")) return undefined;
      if (value.length > 5000) return undefined;
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .map((entry) => stripHeavyApplicationPayload(entry, depth + 1))
        .filter((entry) => entry !== undefined);
    }

    if (typeof value !== "object") return value;

    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(source)) {
      const lowerKey = key.toLowerCase();

      if (
        lowerKey.includes("dataurl") ||
        lowerKey === "url" ||
        lowerKey === "previewurl" ||
        lowerKey === "photourl" ||
        lowerKey === "imageurl" ||
        lowerKey === "vehiclephotourl" ||
        lowerKey === "vehicleimageurl" ||
        lowerKey === "profilephotourl" ||
        lowerKey === "avatarurl"
      ) {
        if (typeof entry === "string" && entry.startsWith("data:")) {
          // No mandamos base64 a la API. Tampoco dejamos null porque el backend
          // valida varios campos como string opcional, no nullable.
          continue;
        }
      }

      const cleaned = stripHeavyApplicationPayload(entry, depth + 1);
      if (cleaned !== undefined) output[key] = cleaned;
    }

    return output;
  }

  function removeNullishForApi(value: unknown, depth = 0): unknown {
    if (depth > 8) return undefined;
    if (value === null || value === undefined) return undefined;

    if (Array.isArray(value)) {
      return value
        .map((entry) => removeNullishForApi(entry, depth + 1))
        .filter((entry) => entry !== undefined);
    }

    if (typeof value === "object") {
      const output: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        const cleaned = removeNullishForApi(entry, depth + 1);
        if (cleaned !== undefined) output[key] = cleaned;
      }
      return output;
    }

    return value;
  }

  function buildApiSafeApplicationInput(input: Record<string, unknown>): Record<string, unknown> {
    const safe = removeNullishForApi(stripHeavyApplicationPayload(input)) as Record<string, unknown>;

    // La API queda liviana: recibe datos y metadatos. Las fotos reales quedan
    // guardadas localmente para Admin Applications.
    safe.localDocumentsSaved = true;
    safe.localDocumentsNotice =
      "Documentos e imágenes guardados localmente para el panel Admin. API recibe solo metadatos para evitar corte por payload pesado.";

    return safe;
  }

  function isConnectionResetError(error: unknown): boolean {
    const message = String(error instanceof Error ? error.message : error ?? "").toLowerCase();

    return (
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("err_connection_reset") ||
      message.includes("load failed") ||
      message.includes("network request failed")
    );
  }

  function isRecoverableApplicationApiError(error: unknown): boolean {
    const message = String(error instanceof Error ? error.message : error ?? "").toLowerCase();

    return (
      isConnectionResetError(error) ||
      message.includes("expected string, received null") ||
      message.includes("expected string") ||
      message.includes("bad request") ||
      message.includes("400")
    );
  }


  async function buildDriverVehiclePayloads(
    vehicles: DriverVehicleForm[],
  ): Promise<DriverApplicationVehiclePayload[]> {
    const now = new Date().toISOString();

    return Promise.all(
      vehicles.map(async (vehicle, index) => {
        const imageDataUrl = await readImageFileAsDataUrl(vehicle.photoFile, 520, 0.5);

        return {
          id: vehicle.id,
          order: index + 1,
          primary: index === 0,
          ownership: vehicle.kind,
          brand: cleanVehicleText(vehicle.brand),
          model: cleanVehicleText(vehicle.model),
          year: cleanVehicleYear(vehicle.year),
          plate: cleanVehiclePlate(vehicle.plate),
          color: cleanVehicleText(vehicle.color),
          label: vehicleLabel(vehicle),
          imageDataUrl,
          photoDataUrl: imageDataUrl,
          photoUrl: imageDataUrl,
          vehiclePhotoUrl: imageDataUrl,
          vehicleImageUrl: imageDataUrl,
          imageName: vehicle.photoFile?.name ?? null,
          expiresAt: vehicle.kind === "optional" ? vehicle.expiresAt || null : null,
          createdAt: now,
          approvedStatus: "pending_admin_review",
          photoProvided: vehicle.photoFile != null,
          photoFileName: vehicle.photoFile?.name,
          photoFileType: vehicle.photoFile?.type,
          photoFileSize: vehicle.photoFile?.size,
        };
      }),
    );
  }

  function persistDriverApplicationToProfile(input: {
    user?: unknown;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    rut: string;
    birthDate?: string;
    vehicles: DriverApplicationVehiclePayload[];
    profilePhotoDataUrl?: string | null;
    profilePhotoName?: string | null;
  }): void {
    const ownerKey = getApplicationOwnerKey(input.user);
    const primaryVehicle = input.vehicles[0] ?? null;
    const fullName = `${input.firstName} ${input.lastName}`.trim();
    const now = new Date().toISOString();

    const registrationProfile = {
      ownerKey,
      driverOwnerKey: ownerKey,
      name: fullName,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      rut: input.rut,
      birthDate: input.birthDate ?? "",
      profilePhotoDataUrl: input.profilePhotoDataUrl ?? "",
      profilePhotoUrl: input.profilePhotoDataUrl ?? "",
      profileImageDataUrl: input.profilePhotoDataUrl ?? "",
      driverProfileImageDataUrl: input.profilePhotoDataUrl ?? "",
      profilePhotoName: input.profilePhotoName ?? "",
      vehicleBrand: primaryVehicle?.brand ?? "",
      vehicleModel: primaryVehicle?.model ?? "",
      vehicleYear: primaryVehicle?.year ?? "",
      vehiclePlate: primaryVehicle?.plate ?? "",
      vehicleColor: primaryVehicle?.color ?? "",
      vehicleImageDataUrl: primaryVehicle?.imageDataUrl ?? "",
      vehicleImageName: primaryVehicle?.imageName ?? "",
      driverApplicationStatus: "pending_admin_review",
      updatedAt: now,
    };

    const publicVehicleSnapshot = {
      ...(primaryVehicle ?? {}),
      ownerKey,
      driverOwnerKey: ownerKey,
      driverName: fullName,
      driverFullName: fullName,
      driverEmail: input.email,
      driverPhone: input.phone,
      driverProfileImageDataUrl: input.profilePhotoDataUrl ?? null,
      driverProfilePhotoUrl: input.profilePhotoDataUrl ?? null,
      driverProfilePhotoName: input.profilePhotoName ?? null,
      profilePhotoDataUrl: input.profilePhotoDataUrl ?? null,
      profilePhotoUrl: input.profilePhotoDataUrl ?? null,
      profileImageDataUrl: input.profilePhotoDataUrl ?? null,
      avatarUrl: input.profilePhotoDataUrl ?? null,
      photoUrl: input.profilePhotoDataUrl ?? null,
      driverVehicleBrand: primaryVehicle?.brand ?? null,
      driverVehicleModel: primaryVehicle?.model ?? null,
      driverVehicleYear: primaryVehicle?.year ?? null,
      driverVehicleColor: primaryVehicle?.color ?? null,
      driverVehiclePlate: primaryVehicle?.plate ?? null,
      driverVehicleOwnership: primaryVehicle?.ownership ?? "own",
      driverVehicleImageDataUrl: primaryVehicle?.imageDataUrl ?? null,
      driverVehicleImageName: primaryVehicle?.imageName ?? null,
      vehicleBrand: primaryVehicle?.brand ?? null,
      vehicleModel: primaryVehicle?.model ?? null,
      vehicleYear: primaryVehicle?.year ?? null,
      vehicleColor: primaryVehicle?.color ?? null,
      vehiclePlate: primaryVehicle?.plate ?? null,
      vehicleImageDataUrl: primaryVehicle?.imageDataUrl ?? null,
      vehiclePhotoDataUrl: primaryVehicle?.imageDataUrl ?? null,
      applicationStatus: "pending_admin_review",
      updatedAt: now,
    };

    try {
      const registrationJson = JSON.stringify(registrationProfile);
      const vehiclesJson = JSON.stringify(input.vehicles);
      const publicVehicleJson = JSON.stringify(publicVehicleSnapshot);

      writeApplicationScopedStorageItem("rapago_registration_profile", registrationJson, input.user);
      writeApplicationScopedStorageItem("rapago_driver_registration_profile", registrationJson, input.user);

      writeApplicationScopedStorageItem("rapago_profile_phone", input.phone, input.user);
      writeApplicationScopedStorageItem("rapago_driver_phone", input.phone, input.user);
      writeApplicationScopedStorageItem("rapago_profile_rut", input.rut, input.user);
      writeApplicationScopedStorageItem("rapago_driver_rut", input.rut, input.user);

      if (input.profilePhotoDataUrl) {
        writeApplicationScopedStorageItem("rapago_driver_profile_photo", input.profilePhotoDataUrl, input.user);
        writeApplicationScopedStorageItem("rapago_driver_profile_image_data_url", input.profilePhotoDataUrl, input.user);
        writeApplicationScopedStorageItem("rapago_driver_profile_photo_url", input.profilePhotoDataUrl, input.user);
        writeApplicationScopedStorageItem("rapago_profile_photo", input.profilePhotoDataUrl, input.user);
        writeApplicationScopedStorageItem("rapago_profile_image_data_url", input.profilePhotoDataUrl, input.user);
        writeApplicationScopedStorageItem("rapago_public_driver_profile_photo", input.profilePhotoDataUrl, input.user);
      }

      if (primaryVehicle) {
        writeApplicationScopedStorageItem("rapago_driver_vehicle_brand", primaryVehicle.brand, input.user);
        writeApplicationScopedStorageItem("rapago_driver_vehicle_model", primaryVehicle.model, input.user);
        writeApplicationScopedStorageItem("rapago_driver_vehicle_year", primaryVehicle.year, input.user);
        writeApplicationScopedStorageItem("rapago_driver_vehicle_plate", primaryVehicle.plate, input.user);
        writeApplicationScopedStorageItem("rapago_driver_vehicle_color", primaryVehicle.color, input.user);

        if (primaryVehicle.imageDataUrl) {
          writeApplicationScopedStorageItem("rapago_driver_vehicle_photo", primaryVehicle.imageDataUrl, input.user);
          writeApplicationScopedStorageItem("rapago_vehicle_photo_data_url", primaryVehicle.imageDataUrl, input.user);
          writeApplicationScopedStorageItem("rapago_driver_vehicle_image_data_url", primaryVehicle.imageDataUrl, input.user);
        }

        if (primaryVehicle.imageName) {
          writeApplicationScopedStorageItem("rapago_driver_vehicle_image_name", primaryVehicle.imageName, input.user);
        }
      }

      writeApplicationScopedStorageItem("rapago_driver_vehicles_v1", vehiclesJson, input.user);
      writeApplicationScopedStorageItem("rapago_driver_selected_vehicle_v1", primaryVehicle?.id ?? "", input.user);
      writeApplicationScopedStorageItem("rapago_driver_active_vehicle_v1", publicVehicleJson, input.user);
      writeApplicationScopedStorageItem("rapago_driver_public_vehicle_v1", publicVehicleJson, input.user);
      writeApplicationScopedStorageItem("rapago_driver_public_profile_v1", publicVehicleJson, input.user);
      writeApplicationScopedStorageItem("rapago_driver_public_snapshot_v1", publicVehicleJson, input.user);
      writeApplicationScopedStorageItem("rapago_selected_vehicle_v1", publicVehicleJson, input.user);
      writeApplicationScopedStorageItem("rapago_selected_driver_vehicle_v1", publicVehicleJson, input.user);

      const profilesRaw = localStorage.getItem("rapago_driver_public_profiles_v1");
      const profiles = profilesRaw ? (JSON.parse(profilesRaw) as Record<string, unknown>) : {};
      profiles[ownerKey] = publicVehicleSnapshot;
      safeSetApplicationStorageItem("rapago_driver_public_profiles_v1", JSON.stringify(profiles));

      window.dispatchEvent(new CustomEvent("rapago:driver-public-profile-updated", { detail: publicVehicleSnapshot }));
      window.dispatchEvent(new CustomEvent("rapago:driver-selected-vehicle-updated", { detail: publicVehicleSnapshot }));
      window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));
    } catch {
      // No bloquea el envío al admin.
    }
  }

  export function ApplicationDriverPage(): JSX.Element {
    const { session } = useAuth();
    const history = useHistory();
    const styles = makeApplicationStyles();

    const sessionUser = session?.user as SessionUserForApplication | undefined;

    const [firstName, setFirstName] = useState("");
    const [lastName,  setLastName]  = useState("");
    const [email,     setEmail]     = useState("");
    const [phone,     setPhone]     = useState("");
    const [rut,       setRut]       = useState("");
    const [birthDate, setBirthDate] = useState("");

    const [belongsToRapaNuiEthnicity, setBelongsToRapaNuiEthnicity] = useState<"yes" | "no" | "">("");

    const [identityFrontFile,       setIdentityFrontFile]       = useState<File | null>(null);
    const [identityBackFile,        setIdentityBackFile]        = useState<File | null>(null);
    const [driverLicenseFrontFile,  setDriverLicenseFrontFile]  = useState<File | null>(null);
    const [driverLicenseBackFile,   setDriverLicenseBackFile]   = useState<File | null>(null);
    const [profilePhotoFile,        setProfilePhotoFile]        = useState<File | null>(null);

    const [vehicles, setVehicles] = useState<DriverVehicleForm[]>([
      {
        id: "vehicle-primary",
        kind: "own",
        brand: "",
        model: "",
        year: "",
        plate: "",
        color: "",
        photoFile: null,
        expiresAt: "",
      },
    ]);
    const [confirmOwnVehicle, setConfirmOwnVehicle] = useState(false);

    const [acceptDataTreatment, setAcceptDataTreatment] = useState(false);
    const [acceptDeclaration,   setAcceptDeclaration]   = useState(false);

    const [loading,        setLoading]        = useState(false);
    const [showSuccess,    setShowSuccess]    = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [error,          setError]          = useState<string | null>(null);

    useEffect(() => {
      const auto = getAutoAccountData(sessionUser);

      setFirstName((current) => current || auto.firstName);
      setLastName((current) => current || auto.lastName);
      setEmail((current) => current || auto.email);
      setPhone((current) => current || cleanPhone(auto.phone));
      setRut((current) => current || formatRut(auto.rut));
      setBirthDate((current) => current || auto.birthDate);
    }, [
      sessionUser?.name,
      sessionUser?.firstName,
      sessionUser?.lastName,
      sessionUser?.email,
      sessionUser?.phone,
      sessionUser?.rut,
      sessionUser?.birthDate,
    ]);

    function persistDirectRequiredFileNow(file: File | null, suffix: string): void {
      if (!file) return;

      void readImageFileAsDataUrl(
        file,
        suffix === "profile_photo" ? 480 : 520,
        suffix === "profile_photo" ? 0.5 : 0.52,
      ).then((dataUrl) => {
        if (!dataUrl) return;

        const cleanEmailKey = email.trim().toLowerCase();
        const cleanRutKey = formatRut(rut).replace(/[.\s-]/g, "").toLowerCase();
        const cleanPhoneKey = cleanPhone(phone);
        const identityParts = [
          "latest",
          cleanEmailKey ? `email_${cleanEmailKey}` : "",
          cleanEmailKey ? `email_${encodeURIComponent(cleanEmailKey)}` : "",
          cleanRutKey ? `rut_${cleanRutKey}` : "",
          cleanPhoneKey ? `phone_${cleanPhoneKey}` : "",
        ].filter(Boolean);

        for (const identityPart of identityParts) {
          const key = `rapago_driver_document_${suffix}_${identityPart}`;
          safeSetApplicationStorageItem(key, dataUrl);
          safeSetApplicationStorageItem(`${key}_fileName`, file.name);
        }
      });
    }

    function handleRequiredDocumentChange(
      event: Event,
      setter: Dispatch<SetStateAction<File | null>>,
      suffix: string,
    ): void {
      const file = getSelectedFile(event);
      setter(file);
      persistDirectRequiredFileNow(file, suffix);
    }

    function updateVehicle(vehicleId: string, changes: Partial<DriverVehicleForm>): void {
      setVehicles((current) =>
        current.map((vehicle) =>
          vehicle.id === vehicleId ? { ...vehicle, ...changes } : vehicle,
        ),
      );
    }

    function addOptionalVehicle(): void {
      setVehicles((current) => [...current, createDriverVehicle(current.length + 1, "optional")]);
    }

    function removeVehicle(vehicleId: string): void {
      setVehicles((current) =>
        current.length <= 1
          ? current
          : current.filter((vehicle) => vehicle.id !== vehicleId),
      );
    }

    const primaryVehicle = vehicles[0];
    const primaryVehicleReady = primaryVehicle ? isVehicleComplete(primaryVehicle) : false;
    const vehiclesReady = vehicles.length > 0 && vehicles.every(isVehicleComplete);
    const vehicleReady = confirmOwnVehicle && primaryVehicleReady && vehiclesReady;
    const termsAccepted = acceptDataTreatment && acceptDeclaration;

    const canSubmit =
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      isEmailValid(email) &&
      isPhoneValid(phone) &&
      isRutValid(rut) &&
      belongsToRapaNuiEthnicity !== "" &&
      identityFrontFile != null &&
      identityBackFile != null &&
      driverLicenseFrontFile != null &&
      driverLicenseBackFile != null &&
      profilePhotoFile != null &&
      vehicleReady &&
      termsAccepted &&
      !loading;

    async function handleSubmit() {
      if (!canSubmit) {
        if (!acceptDataTreatment || !acceptDeclaration) {
          setError("Debes aceptar los términos y la declaración antes de enviar la solicitud.");
          return;
        }

        if (driverLicenseBackFile == null) {
          setError("Debes adjuntar el reverso/parte trasera de la licencia de conducir.");
          return;
        }

        if (!confirmOwnVehicle) {
          setError("Debes confirmar que cuentas con vehículo propio para prestar servicios en Rapa Go.");
          return;
        }

        if (!primaryVehicleReady) {
          setError("Debes completar el vehículo principal con marca, modelo, año, patente, color y foto clara.");
          return;
        }

        if (!vehiclesReady) {
          setError("Completa o elimina los vehículos opcionales. Cada vehículo opcional debe tener todos los datos y fecha de expiración.");
          return;
        }

        setError("Completa los datos requeridos. Teléfono y RUT se toman automáticamente desde el registro, pero deben ser válidos.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const cleanFirstName = firstName.trim();
        const cleanLastName = lastName.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhoneValue = cleanPhone(phone);
        const cleanRutValue = formatRut(rut);

        persistApplicationAutofill({
          firstName: cleanFirstName,
          lastName: cleanLastName,
          email: cleanEmail,
          phone: cleanPhoneValue,
          rut: cleanRutValue,
          birthDate,
        });

        const vehiclePayloads = await buildDriverVehiclePayloads(vehicles);
        const nowIso = new Date().toISOString();
        const applicationId = `driver-${cleanEmail || cleanRutValue.replace(/\W/g, "")}-${Date.now()}`;

        const identityFrontDoc = await buildApplicationFilePayload(identityFrontFile, { maxSide: 520, quality: 0.52 });
        const identityBackDoc = await buildApplicationFilePayload(identityBackFile, { maxSide: 520, quality: 0.52 });
        const licenseFrontDoc = await buildApplicationFilePayload(driverLicenseFrontFile, { maxSide: 520, quality: 0.52 });
        const licenseBackDoc = await buildApplicationFilePayload(driverLicenseBackFile, { maxSide: 520, quality: 0.52 });
        const profilePhotoDoc = await buildApplicationFilePayload(profilePhotoFile, { maxSide: 480, quality: 0.5 });
        const primaryVehiclePhotoUrl = vehiclePayloads[0]?.imageDataUrl ?? null;

        persistDriverApplicationToProfile({
          user: session?.user,
          firstName: cleanFirstName,
          lastName: cleanLastName,
          email: cleanEmail,
          phone: cleanPhoneValue,
          rut: cleanRutValue,
          birthDate,
          vehicles: vehiclePayloads,
          profilePhotoDataUrl: applicationFileUrl(profilePhotoDoc),
          profilePhotoName: profilePhotoDoc.fileName ?? null,
        });

        const input: Record<string, unknown> = {
          id: applicationId,
          applicationId,
          type: "driver",
          firstName: cleanFirstName,
          lastName: cleanLastName,
          email: cleanEmail,
          phone: cleanPhoneValue,
          rut: normalizeRut(rut),
          ...(birthDate ? { birthDate } : {}),
          createdAt: nowIso,
          updatedAt: nowIso,

          belongsToRapaNuiEthnicity: belongsToRapaNuiEthnicity === "yes",
          ethnicityDeclaration: belongsToRapaNuiEthnicity,

          // Aliases directos para que el admin los lea aunque el backend aplane el payload.
          idFrontUrl: applicationFileUrl(identityFrontDoc),
          identityFrontUrl: applicationFileUrl(identityFrontDoc),
          identityDocumentFrontUrl: applicationFileUrl(identityFrontDoc),
          cedulaFrenteUrl: applicationFileUrl(identityFrontDoc),
          carnetFrenteUrl: applicationFileUrl(identityFrontDoc),
          idFrontFileName: identityFrontDoc.fileName,
          identityFrontFileName: identityFrontDoc.fileName,

          idBackUrl: applicationFileUrl(identityBackDoc),
          identityBackUrl: applicationFileUrl(identityBackDoc),
          identityDocumentBackUrl: applicationFileUrl(identityBackDoc),
          cedulaReversoUrl: applicationFileUrl(identityBackDoc),
          carnetReversoUrl: applicationFileUrl(identityBackDoc),
          idBackFileName: identityBackDoc.fileName,
          identityBackFileName: identityBackDoc.fileName,

          licenseFrontUrl: applicationFileUrl(licenseFrontDoc),
          driverLicenseFrontUrl: applicationFileUrl(licenseFrontDoc),
          licenciaFrenteUrl: applicationFileUrl(licenseFrontDoc),
          licenseFrontFileName: licenseFrontDoc.fileName,
          driverLicenseFrontFileName: licenseFrontDoc.fileName,

          licenseBackUrl: applicationFileUrl(licenseBackDoc),
          driverLicenseBackUrl: applicationFileUrl(licenseBackDoc),
          drivingLicenseBackUrl: applicationFileUrl(licenseBackDoc),
          licenciaReversoUrl: applicationFileUrl(licenseBackDoc),
          licenciaBackUrl: applicationFileUrl(licenseBackDoc),
          licenciaTraseraUrl: applicationFileUrl(licenseBackDoc),
          licenseBackDataUrl: applicationFileUrl(licenseBackDoc),
          driverLicenseBackDataUrl: applicationFileUrl(licenseBackDoc),
          licenciaReversoDataUrl: applicationFileUrl(licenseBackDoc),
          licenseBackFileName: licenseBackDoc.fileName,
          driverLicenseBackFileName: licenseBackDoc.fileName,

          profilePhotoUrl: applicationFileUrl(profilePhotoDoc),
          profileImageUrl: applicationFileUrl(profilePhotoDoc),
          avatarUrl: applicationFileUrl(profilePhotoDoc),
          photoUrl: applicationFileUrl(profilePhotoDoc),
          profilePhotoFileName: profilePhotoDoc.fileName,

          vehiclePhotoUrl: primaryVehiclePhotoUrl,
          vehicleImageUrl: primaryVehiclePhotoUrl,
          carPhotoUrl: primaryVehiclePhotoUrl,
          autoPhotoUrl: primaryVehiclePhotoUrl,
          vehiclePhotoFileName: vehiclePayloads[0]?.photoFileName,

          vehicles: vehiclePayloads,
          driverVehicles: vehiclePayloads,

          vehicle: {
            hasOwnVehicle: confirmOwnVehicle,
            principalVehicleRequired: true,
            selectedVehicleId: vehiclePayloads[0]?.id ?? null,
            description: vehiclePayloads[0]?.label ?? "",
            brand: vehiclePayloads[0]?.brand ?? "",
            model: vehiclePayloads[0]?.model ?? "",
            year: vehiclePayloads[0]?.year ?? "",
            plate: vehiclePayloads[0]?.plate ?? "",
            color: vehiclePayloads[0]?.color ?? "",
            photoProvided: vehiclePayloads[0]?.photoProvided ?? false,
            photoFileName: vehiclePayloads[0]?.photoFileName,
            photoFileType: vehiclePayloads[0]?.photoFileType,
            photoFileSize: vehiclePayloads[0]?.photoFileSize,
            photoDataUrl: primaryVehiclePhotoUrl,
            imageDataUrl: primaryVehiclePhotoUrl,
            photoUrl: primaryVehiclePhotoUrl,
            vehiclePhotoUrl: primaryVehiclePhotoUrl,
            vehicleImageUrl: primaryVehiclePhotoUrl,
            totalVehicles: vehiclePayloads.length,
            vehicles: vehiclePayloads,
          },

          documents: {
            idFront: identityFrontDoc,
            identityFront: identityFrontDoc,
            identityDocumentFront: identityFrontDoc,
            cedulaFrente: identityFrontDoc,
            carnetFrente: identityFrontDoc,
            identityCardFront: identityFrontDoc,

            idBack: identityBackDoc,
            identityBack: identityBackDoc,
            identityDocumentBack: identityBackDoc,
            cedulaReverso: identityBackDoc,
            carnetReverso: identityBackDoc,
            identityCardBack: identityBackDoc,

            licenseFront: licenseFrontDoc,
            driverLicenseFront: licenseFrontDoc,
            licenciaFrente: licenseFrontDoc,

            licenseBack: licenseBackDoc,
            driverLicenseBack: licenseBackDoc,
            drivingLicenseBack: licenseBackDoc,
            licenciaReverso: licenseBackDoc,
            licenciaBack: licenseBackDoc,
            licenciaTrasera: licenseBackDoc,

            driverLicense: {
              ...licenseFrontDoc,
              front: licenseFrontDoc,
              back: licenseBackDoc,
              reverso: licenseBackDoc,
              trasera: licenseBackDoc,
              frontUrl: applicationFileUrl(licenseFrontDoc),
              backUrl: applicationFileUrl(licenseBackDoc),
              backDataUrl: applicationFileUrl(licenseBackDoc),
            },

            profilePhoto: profilePhotoDoc,
            profileImage: profilePhotoDoc,
            avatar: profilePhotoDoc,
            photo: profilePhotoDoc,

            vehiclePhoto: {
              provided: vehiclePayloads[0]?.photoProvided ?? false,
              fileName: vehiclePayloads[0]?.photoFileName,
              fileType: vehiclePayloads[0]?.photoFileType,
              fileSize: vehiclePayloads[0]?.photoFileSize,
              dataUrl: primaryVehiclePhotoUrl,
              url: primaryVehiclePhotoUrl,
              previewUrl: primaryVehiclePhotoUrl,
              uploadedAt: nowIso,
            },
            vehicleImage: {
              dataUrl: primaryVehiclePhotoUrl,
              url: primaryVehiclePhotoUrl,
              previewUrl: primaryVehiclePhotoUrl,
              fileName: vehiclePayloads[0]?.photoFileName,
              provided: vehiclePayloads[0]?.photoProvided ?? false,
            },
            vehiclePhotos: vehiclePayloads.map((vehicle) => ({
              provided: vehicle.photoProvided,
              fileName: vehicle.photoFileName,
              fileType: vehicle.photoFileType,
              fileSize: vehicle.photoFileSize,
              primary: vehicle.primary,
              order: vehicle.order,
              ownership: vehicle.ownership,
              expiresAt: vehicle.expiresAt,
              dataUrl: vehicle.imageDataUrl,
              url: vehicle.imageDataUrl,
              previewUrl: vehicle.imageDataUrl,
            })),
          },

          legalAcceptance: {
            acceptedDataTreatment: acceptDataTreatment,
            acceptedTruthDeclaration: acceptDeclaration,
            acceptedVehicleOwnership: confirmOwnVehicle,
            acceptedAt: nowIso,
            text: "Autorizo a Rapa Go a revisar mi cédula de identidad, licencia de conducir, foto de perfil y foto de cada vehículo únicamente para validar mi inscripción como conductor. Declaro que cuento con vehículo propio principal para prestar servicios en Rapa Go y que los vehículos opcionales registrados serán usados solo si se encuentran vigentes y aprobados.",
          },
        };

        persistSubmittedDriverApplicationForAdmin(input, session?.user);

        try {
          const apiInput = buildApiSafeApplicationInput(input);
          const result = await applicationsService.createApplication(apiInput, session?.accessToken);
          setSuccessMessage(result.message || "Tu solicitud fue enviada correctamente. Cuando el admin la apruebe, tu perfil de conductor quedará listo con estos datos.");
        } catch (apiError) {
          if (!isRecoverableApplicationApiError(apiError)) {
            throw apiError;
          }

          setSuccessMessage(
            "Tu solicitud quedó guardada para revisión del admin. La API rechazó algunos metadatos, pero el panel Admin tomará los documentos desde Inscripción.",
          );
        }

        setShowSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado al enviar la postulación.");
      } finally {
        setLoading(false);
      }
    }

    return (
      <IonPage className="driver-registration-page">
        <IonHeader>
          <IonToolbar style={{ "--background": "linear-gradient(135deg,#C89B3C,#8f3c24)", "--color": "#fff" } as CSSProperties}>
            <IonTitle>Inscripción como Conductor</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding driver-registration-page">
          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Datos de tu cuenta</IonCardTitle>
              <IonNote style={styles.noteStyle}>
                Estos datos se completan automáticamente desde tu perfil. Revisa que estén correctos antes de enviar.
              </IonNote>
            </IonCardHeader>

            <IonCardContent>
              <IonItem lines="full" style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Nombre *</IonLabel>
                <IonInput
                  style={styles.inputStyle}
                  value={firstName}
                  onIonInput={(e) => setFirstName(String(e.detail.value ?? ""))}
                  placeholder="Tu nombre"
                />
              </IonItem>

              <IonItem lines="full" style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Apellido *</IonLabel>
                <IonInput
                  style={styles.inputStyle}
                  value={lastName}
                  onIonInput={(e) => setLastName(String(e.detail.value ?? ""))}
                  placeholder="Tu apellido"
                />
              </IonItem>

              <IonItem lines="full" style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Email *</IonLabel>
                <IonInput
                  style={styles.inputStyle}
                  type="email"
                  value={email}
                  onIonInput={(e) => setEmail(String(e.detail.value ?? ""))}
                  placeholder="correo@ejemplo.com"
                />
              </IonItem>

              <IonItem lines="full" style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Teléfono *</IonLabel>
                <IonInput
                  style={styles.inputStyle}
                  type="tel"
                  value={phone}
                  onIonInput={(e) => setPhone(cleanPhone(String(e.detail.value ?? "")))}
                  placeholder="56912345678"
                  inputmode="numeric"
                  maxlength={11}
                />
              </IonItem>

              <IonItem lines="full" style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>RUT *</IonLabel>
                <IonInput
                  style={styles.inputStyle}
                  value={rut}
                  onIonInput={(e) => setRut(formatRut(String(e.detail.value ?? "")))}
                  placeholder="12.345.678-9"
                  inputmode="numeric"
                  maxlength={12}
                />
              </IonItem>

              <IonItem lines="none" style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Fecha de nacimiento</IonLabel>
                <IonInput
                  style={styles.inputStyle}
                  type="date"
                  value={birthDate}
                  onIonInput={(e) => setBirthDate(String(e.detail.value ?? ""))}
                />
              </IonItem>
            </IonCardContent>
          </IonCard>

          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Validación Rapa Nui</IonCardTitle>
            </IonCardHeader>

            <IonCardContent>
              <IonLabel style={{ ...styles.labelStyle, display: "block", marginBottom: "10px" }}>
                ¿Perteneces a la etnia Rapa Nui? *
              </IonLabel>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <IonButton
                  expand="block"
                  color={belongsToRapaNuiEthnicity === "yes" ? "warning" : "medium"}
                  fill={belongsToRapaNuiEthnicity === "yes" ? "solid" : "outline"}
                  onClick={() => setBelongsToRapaNuiEthnicity("yes")}
                >
                  Sí
                </IonButton>

                <IonButton
                  expand="block"
                  color={belongsToRapaNuiEthnicity === "no" ? "warning" : "medium"}
                  fill={belongsToRapaNuiEthnicity === "no" ? "solid" : "outline"}
                  onClick={() => setBelongsToRapaNuiEthnicity("no")}
                >
                  No
                </IonButton>
              </div>

              <IonNote style={styles.noteStyle}>
                Esta información ayuda a priorizar conductores locales y validar antecedentes de forma responsable.
              </IonNote>
            </IonCardContent>
          </IonCard>

          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Documentación requerida</IonCardTitle>
              <IonNote style={styles.noteStyle}>
                Adjunta documentos claros. El admin verá estas imágenes en la postulación para aprobar o rechazar al conductor.
              </IonNote>
            </IonCardHeader>

            <IonCardContent>
              {[
                ["Cédula de identidad — Frente *", identityFrontFile, setIdentityFrontFile, "image/*,.pdf", "identity_front"],
                ["Cédula de identidad — Reverso *", identityBackFile, setIdentityBackFile, "image/*,.pdf", "identity_back"],
                ["Licencia de conducir — Frente *", driverLicenseFrontFile, setDriverLicenseFrontFile, "image/*,.pdf", "license_front"],
                ["Licencia de conducir — Reverso *", driverLicenseBackFile, setDriverLicenseBackFile, "image/*,.pdf", "license_back"],
                ["Foto de perfil del conductor *", profilePhotoFile, setProfilePhotoFile, "image/*", "profile_photo"],
              ].map(([label, file, setter, accept, suffix]) => (
                <label
                  key={String(label)}
                  className="upload-box"
                  style={{
                    ...styles.fileButtonStyle,
                    marginBottom: 10,
                    border: file
                      ? "2px solid rgba(34,197,94,.75)"
                      : "2px dashed rgba(200,155,60,.85)",
                    background: file ? "linear-gradient(135deg,#ecfdf3,#ffffff)" : "#ffffff",
                  }}
                >
                  {String(label)}
                  <input
                    type="file"
                    accept={String(accept)}
                    style={{ display: "none" }}
                    onChange={(e) => handleRequiredDocumentChange(
                      e.nativeEvent,
                      setter as Dispatch<SetStateAction<File | null>>,
                      String(suffix),
                    )}
                  />
                  <div
                    className="selected-file"
                    style={{
                      color: file ? "#167A35" : "#4A4A4A",
                      marginTop: "6px",
                      fontSize: ".78rem",
                      fontWeight: 900,
                    }}
                  >
                    {fileLabel(file as File | null)}
                  </div>
                </label>
              ))}
            </IonCardContent>
          </IonCard>

          <IonCard
            style={{
              ...styles.cardStyle,
              border: vehicleReady
                ? "2px solid rgba(34,197,94,.55)"
                : "2px solid rgba(200,155,60,.38)",
            }}
          >
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Vehículo propio</IonCardTitle>
              <IonNote style={styles.noteStyle}>
                Para validar tu inscripción como conductor, debes indicar tu vehículo principal y adjuntar una foto clara. Si tienes más vehículos, puedes agregarlos de forma opcional.
              </IonNote>
            </IonCardHeader>

            <IonCardContent>
              {vehicles.map((vehicle, index) => {
                const complete = isVehicleComplete(vehicle);
                const isPrimary = index === 0;

                return (
                  <div
                    key={vehicle.id}
                    style={{
                      marginBottom: "14px",
                      padding: "12px",
                      borderRadius: "20px",
                      background: complete
                        ? "linear-gradient(135deg,#ecfdf3,#ffffff)"
                        : "#FFFDF7",
                      border: complete
                        ? "2px solid rgba(34,197,94,.55)"
                        : "2px solid rgba(200,155,60,.32)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        alignItems: "center",
                        marginBottom: "10px",
                      }}
                    >
                      <div>
                        <strong style={{ color: "#111", fontWeight: 950 }}>
                          {isPrimary ? "Vehículo principal" : `Vehículo opcional ${index}`}
                        </strong>
                        <IonNote style={{ ...styles.noteStyle, marginTop: 2 }}>
                          {isPrimary
                            ? "Obligatorio para enviar la solicitud."
                            : "Opcional. Si lo agregas, debes completar todos los datos y una fecha de expiración."}
                        </IonNote>
                      </div>

                      {!isPrimary && (
                        <IonButton
                          size="small"
                          fill="outline"
                          color="danger"
                          onClick={() => removeVehicle(vehicle.id)}
                          style={{ "--border-radius": "999px", fontWeight: 900 } as CSSProperties}
                        >
                          Eliminar
                        </IonButton>
                      )}
                    </div>

                    <IonItem lines="full" style={styles.itemStyle}>
                      <IonLabel position="stacked" style={styles.labelStyle}>
                        Marca *
                      </IonLabel>
                      <IonInput
                        style={styles.inputStyle}
                        value={vehicle.brand}
                        onIonInput={(e) => updateVehicle(vehicle.id, { brand: cleanVehicleText(String(e.detail.value ?? ""), 32) })}
                        placeholder="Toyota"
                      />
                    </IonItem>

                    <IonItem lines="full" style={styles.itemStyle}>
                      <IonLabel position="stacked" style={styles.labelStyle}>
                        Modelo *
                      </IonLabel>
                      <IonInput
                        style={styles.inputStyle}
                        value={vehicle.model}
                        onIonInput={(e) => updateVehicle(vehicle.id, { model: cleanVehicleText(String(e.detail.value ?? ""), 32) })}
                        placeholder="Yaris, Corolla, Hilux..."
                      />
                    </IonItem>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <IonItem lines="full" style={styles.itemStyle}>
                        <IonLabel position="stacked" style={styles.labelStyle}>
                          Año *
                        </IonLabel>
                        <IonInput
                          style={styles.inputStyle}
                          type="tel"
                          inputmode="numeric"
                          value={vehicle.year}
                          onIonInput={(e) => updateVehicle(vehicle.id, { year: cleanVehicleYear(String(e.detail.value ?? "")) })}
                          placeholder="2020"
                          maxlength={4}
                        />
                      </IonItem>

                      <IonItem lines="full" style={styles.itemStyle}>
                        <IonLabel position="stacked" style={styles.labelStyle}>
                          Patente *
                        </IonLabel>
                        <IonInput
                          style={styles.inputStyle}
                          value={vehicle.plate}
                          onIonInput={(e) => updateVehicle(vehicle.id, { plate: cleanVehiclePlate(String(e.detail.value ?? "")) })}
                          placeholder="ABCD12"
                          maxlength={12}
                        />
                      </IonItem>
                    </div>

                    <IonItem lines="full" style={styles.itemStyle}>
                      <IonLabel position="stacked" style={styles.labelStyle}>
                        Color *
                      </IonLabel>
                      <IonInput
                        style={styles.inputStyle}
                        value={vehicle.color}
                        onIonInput={(e) => updateVehicle(vehicle.id, { color: cleanVehicleText(String(e.detail.value ?? ""), 24) })}
                        placeholder="Blanco, rojo, gris..."
                      />
                    </IonItem>

                    {!isPrimary && (
                      <IonItem lines="full" style={styles.itemStyle}>
                        <IonLabel position="stacked" style={styles.labelStyle}>
                          Fecha de expiración del vehículo opcional *
                        </IonLabel>
                        <IonInput
                          style={styles.inputStyle}
                          type="date"
                          value={vehicle.expiresAt}
                          onIonInput={(e) => updateVehicle(vehicle.id, { expiresAt: String(e.detail.value ?? "") })}
                        />
                        <IonNote slot="helper" style={{ fontWeight: 750 }}>
                          Al vencer esta fecha, el vehículo opcional debe dejar de aparecer para solicitudes o reservas hasta renovarlo.
                        </IonNote>
                      </IonItem>
                    )}

                    <label
                      className="upload-box"
                      style={{
                        ...styles.fileButtonStyle,
                        border: vehicle.photoFile
                          ? "2px solid rgba(34,197,94,.75)"
                          : "2px dashed rgba(200,155,60,.85)",
                        background: vehicle.photoFile
                          ? "linear-gradient(135deg,#ecfdf3,#ffffff)"
                          : "#ffffff",
                      }}
                    >
                      Foto del vehículo *
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: "none" }}
                        onChange={(e) =>
                          updateVehicle(vehicle.id, {
                            photoFile: getSelectedFile(e.nativeEvent),
                          })
                        }
                      />
                      <div
                        className="selected-file"
                        style={{
                          color: vehicle.photoFile ? "#167A35" : "#4A4A4A",
                          marginTop: "6px",
                          fontSize: ".78rem",
                          fontWeight: 900,
                        }}
                      >
                        {fileLabel(vehicle.photoFile)}
                      </div>
                    </label>
                  </div>
                );
              })}

              <IonButton
                expand="block"
                fill="outline"
                color="warning"
                onClick={addOptionalVehicle}
                style={{
                  "--border-radius": "18px",
                  height: "48px",
                  fontWeight: 950,
                  marginBottom: "12px",
                } as CSSProperties}
              >
                + Agregar vehículo opcional
              </IonButton>

              <IonItem
                lines="none"
                style={{
                  ...styles.itemStyle,
                  alignItems: "flex-start",
                  marginTop: "12px",
                  border: confirmOwnVehicle
                    ? "2px solid rgba(34,197,94,.75)"
                    : "2px solid rgba(184,79,46,.38)",
                  "--background": confirmOwnVehicle ? "#ECFDF3" : "#FFF8F2",
                } as CSSProperties}
              >
                <IonCheckbox
                  color="warning"
                  checked={confirmOwnVehicle}
                  onIonChange={(e) => setConfirmOwnVehicle(e.detail.checked)}
                  slot="start"
                />
                <IonLabel
                  style={{
                    ...styles.labelStyle,
                    marginLeft: "12px",
                    whiteSpace: "normal",
                    lineHeight: 1.35,
                  }}
                >
                  Confirmo que cuento con vehículo propio para prestar servicios en Rapa Go.
                </IonLabel>
              </IonItem>

              <IonNote style={{ ...styles.noteStyle, marginTop: 8 }}>
                El vehículo principal quedará precargado automáticamente en el perfil del conductor. Los vehículos opcionales solo se mostrarán si están completos, vigentes y aprobados.
              </IonNote>
            </IonCardContent>
          </IonCard>

          <IonCard
            style={{
              ...styles.cardStyle,
              border: termsAccepted
                ? "2px solid rgba(34,197,94,.65)"
                : "2px solid rgba(184,79,46,.34)",
            }}
          >
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Términos y autorización</IonCardTitle>
              <IonNote style={styles.noteStyle}>
                Debes aceptar ambos puntos para habilitar el botón de envío.
              </IonNote>
            </IonCardHeader>

            <IonCardContent>
              <IonItem
                lines="none"
                style={{
                  ...styles.itemStyle,
                  alignItems: "flex-start",
                  border: acceptDataTreatment
                    ? "2px solid rgba(34,197,94,.75)"
                    : "2px solid rgba(200,155,60,.5)",
                  "--background": acceptDataTreatment ? "#ECFDF3" : "#FFFDF7",
                } as CSSProperties}
              >
                <IonCheckbox
                  color="warning"
                  checked={acceptDataTreatment}
                  onIonChange={(e) => setAcceptDataTreatment(e.detail.checked)}
                  slot="start"
                />
                <IonLabel style={{ ...styles.labelStyle, marginLeft: "12px", whiteSpace: "normal", lineHeight: 1.35 }}>
                  Autorizo a Rapa Go a revisar mi cédula de identidad, licencia de conducir y foto de cada vehículo registrado únicamente para validar mi inscripción como conductor.
                </IonLabel>
              </IonItem>

              <IonItem
                lines="none"
                style={{
                  ...styles.itemStyle,
                  alignItems: "flex-start",
                  border: acceptDeclaration
                    ? "2px solid rgba(34,197,94,.75)"
                    : "2px solid rgba(200,155,60,.5)",
                  "--background": acceptDeclaration ? "#ECFDF3" : "#FFFDF7",
                } as CSSProperties}
              >
                <IonCheckbox
                  color="warning"
                  checked={acceptDeclaration}
                  onIonChange={(e) => setAcceptDeclaration(e.detail.checked)}
                  slot="start"
                />
                <IonLabel style={{ ...styles.labelStyle, marginLeft: "12px", whiteSpace: "normal", lineHeight: 1.35 }}>
                  Declaro que la información, documentación enviada y fotos de los vehículos son verdaderas y corresponden a mi identidad.
                </IonLabel>
              </IonItem>

              {!termsAccepted && (
                <IonNote
                  style={{
                    display: "block",
                    marginTop: "8px",
                    color: "#B84F2E",
                    fontWeight: 950,
                  }}
                >
                  Sin aceptar los términos y condiciones no se puede enviar la solicitud.
                </IonNote>
              )}
            </IonCardContent>
          </IonCard>

          {error && (
            <IonText color="danger">
              <p style={{ padding: "0 4px", fontWeight: 900, color: "#B84F2E" }}>{error}</p>
            </IonText>
          )}

          <div style={{ padding: "8px 0 18px" }}>
            <IonButton
              expand="block"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
              style={{
                "--border-radius": "18px",
                "--background": canSubmit
                  ? "linear-gradient(135deg,#F8D879 0%,#C89B3C 45%,#C5532F 100%)"
                  : "linear-gradient(135deg,#C9C2B5,#8D877D)",
                "--background-activated": "linear-gradient(135deg,#C5532F,#C89B3C)",
                "--box-shadow": canSubmit
                  ? "0 16px 32px rgba(200,155,60,.42)"
                  : "none",
                height: "56px",
                fontWeight: 950,
                color: "#111111",
                letterSpacing: ".01em",
              } as CSSProperties}
            >
              {loading
                ? <IonSpinner name="crescent" />
                : canSubmit
                  ? "Enviar solicitud"
                  : "Completa documentos, vehículo y términos"}
            </IonButton>

            <IonButton
              expand="block"
              fill="outline"
              color="medium"
              onClick={() => history.goBack()}
              style={{ marginTop: "8px", "--border-radius": "16px" } as CSSProperties}
            >
              Cancelar
            </IonButton>
          </div>

          <IonAlert
            isOpen={showSuccess}
            header="Solicitud enviada"
            message={successMessage}
            buttons={[{
              text: "OK",
              handler: () => {
                setShowSuccess(false);
                history.push("/passenger/home");
              },
            }]}
            onDidDismiss={() => setShowSuccess(false)}
          />
        </IonContent>
      </IonPage>
    );
  }

  export function ApplicationGuidePage(): JSX.Element {
    const { session } = useAuth();
    const history = useHistory();
    const styles = makeApplicationStyles();

    const sessionUser = session?.user as SessionUserForApplication | undefined;

    const [firstName, setFirstName] = useState("");
    const [lastName,  setLastName]  = useState("");
    const [email,     setEmail]     = useState("");
    const [phone,     setPhone]     = useState("");
    const [rut,       setRut]       = useState("");
    const [birthDate, setBirthDate] = useState("");

    const [experienceYears, setExperienceYears] = useState("");
    const [specialties, setSpecialties] = useState<string[]>([]);
    const [offeredTours, setOfferedTours] = useState<string[]>([]);
    const [hasVehicle, setHasVehicle] = useState(false);
    const [vehicleDescription, setVehicleDescription] = useState("");
    const [maxGroupSize, setMaxGroupSize] = useState("");
    const [languages, setLanguages] = useState<string[]>([]);

    const [identityFrontFile, setIdentityFrontFile] = useState<File | null>(null);
    const [identityBackFile,  setIdentityBackFile]  = useState<File | null>(null);
    const [profilePhotoFile,  setProfilePhotoFile]  = useState<File | null>(null);
    const [guideCertFile,     setGuideCertFile]     = useState<File | null>(null);

    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptDeclaration, setAcceptDeclaration] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const auto = getAutoAccountData(sessionUser);

      setFirstName((current) => current || auto.firstName);
      setLastName((current) => current || auto.lastName);
      setEmail((current) => current || auto.email);
      setPhone((current) => current || cleanPhone(auto.phone));
      setRut((current) => current || formatRut(auto.rut));
      setBirthDate((current) => current || auto.birthDate);
    }, [
      sessionUser?.name,
      sessionUser?.firstName,
      sessionUser?.lastName,
      sessionUser?.email,
      sessionUser?.phone,
      sessionUser?.rut,
      sessionUser?.birthDate,
    ]);

    const canSubmitGuide =
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      isEmailValid(email) &&
      isPhoneValid(phone) &&
      isRutValid(rut) &&
      identityFrontFile != null &&
      identityBackFile != null &&
      profilePhotoFile != null &&
      guideCertFile != null &&
      acceptTerms &&
      acceptDeclaration &&
      !loading;

    async function handleSubmit() {
      if (!canSubmitGuide) {
        setError("Completa los datos requeridos. Teléfono y RUT se toman automáticamente desde el registro, pero deben ser válidos.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        persistApplicationAutofill({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: cleanPhone(phone),
          rut: formatRut(rut),
          birthDate,
        });

        const input: Record<string, unknown> = {
          type: "guide",
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: cleanPhone(phone),
          rut: normalizeRut(rut),
          ...(birthDate ? { birthDate } : {}),
          ...(experienceYears ? { experienceYears: Number(experienceYears) } : {}),
          ...(specialties.length > 0 ? { specialties } : {}),
          ...(offeredTours.length > 0 ? { offeredTours } : {}),
          hasVehicle,
          ...(hasVehicle && vehicleDescription ? { vehicleDescription } : {}),
          ...(maxGroupSize ? { maxGroupSize: Number(maxGroupSize) } : {}),
          ...(languages.length > 0 ? { languages } : {}),

          documents: {
            identityCardFront: {
              provided: true,
              fileName: identityFrontFile?.name,
              fileType: identityFrontFile?.type,
              fileSize: identityFrontFile?.size,
            },
            identityCardBack: {
              provided: true,
              fileName: identityBackFile?.name,
              fileType: identityBackFile?.type,
              fileSize: identityBackFile?.size,
            },
            profilePhoto: {
              provided: true,
              fileName: profilePhotoFile?.name,
              fileType: profilePhotoFile?.type,
              fileSize: profilePhotoFile?.size,
            },
            guideCertification: {
              provided: true,
              fileName: guideCertFile?.name,
              fileType: guideCertFile?.type,
              fileSize: guideCertFile?.size,
            },
          },

          legalAcceptance: {
            acceptedDataTreatment: acceptTerms,
            acceptedTruthDeclaration: acceptDeclaration,
            acceptedAt: new Date().toISOString(),
            text: "Autorizo a Rapa Go a revisar mi documentación únicamente para validar mi inscripción como guía.",
          },
        };

        const result = await applicationsService.createApplication(input, session?.accessToken);
        setSuccessMessage(result.message || "Tu postulación fue enviada correctamente.");
        setShowSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado al enviar la postulación.");
      } finally {
        setLoading(false);
      }
    }

    return (
      <IonPage className="driver-registration-page">
        <IonHeader>
          <IonToolbar style={{ "--background": "linear-gradient(135deg,#C89B3C,#8f3c24)", "--color": "#fff" } as CSSProperties}>
            <IonTitle>Inscripción como Guía</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding driver-registration-page">
          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Datos de tu cuenta</IonCardTitle>
              <IonNote style={styles.noteStyle}>
                Estos datos se completan automáticamente desde tu perfil.
              </IonNote>
            </IonCardHeader>

            <IonCardContent>
              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Nombre *</IonLabel>
                <IonInput style={styles.inputStyle} value={firstName} onIonInput={(e) => setFirstName(String(e.detail.value ?? ""))} placeholder="Tu nombre" />
              </IonItem>

              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Apellido *</IonLabel>
                <IonInput style={styles.inputStyle} value={lastName} onIonInput={(e) => setLastName(String(e.detail.value ?? ""))} placeholder="Tu apellido" />
              </IonItem>

              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Email *</IonLabel>
                <IonInput style={styles.inputStyle} type="email" value={email} onIonInput={(e) => setEmail(String(e.detail.value ?? ""))} placeholder="correo@ejemplo.com" />
              </IonItem>

              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Teléfono *</IonLabel>
                <IonInput style={styles.inputStyle} type="tel" value={phone} onIonInput={(e) => setPhone(String(e.detail.value ?? ""))} placeholder="+56912345678" />
              </IonItem>

              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>RUT *</IonLabel>
                <IonInput style={styles.inputStyle} value={rut} onIonInput={(e) => setRut(String(e.detail.value ?? "").toUpperCase())} placeholder="12.345.678-9" />
              </IonItem>

              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Fecha de nacimiento</IonLabel>
                <IonInput style={styles.inputStyle} type="date" value={birthDate} onIonInput={(e) => setBirthDate(String(e.detail.value ?? ""))} />
              </IonItem>
            </IonCardContent>
          </IonCard>

          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Experiencia</IonCardTitle>
            </IonCardHeader>

            <IonCardContent>
              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Años de experiencia</IonLabel>
                <IonInput style={styles.inputStyle} type="tel" inputmode="numeric" value={experienceYears} onIonInput={(e) => setExperienceYears(cleanNumber(String(e.detail.value ?? ""), 2))} placeholder="0" maxlength={2} />
              </IonItem>

              <IonLabel style={{ ...styles.labelStyle, display: "block", margin: "12px 0 8px" }}>
                Especialidades
              </IonLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {SPECIALTIES.map((s) => (
                  <IonChip key={s} color={specialties.includes(s) ? "primary" : "medium"} onClick={() => setSpecialties(toggleArrayItem(specialties, s))}>
                    <IonLabel>{s}</IonLabel>
                  </IonChip>
                ))}
              </div>

              <IonLabel style={{ ...styles.labelStyle, display: "block", margin: "14px 0 8px" }}>
                Tipos de tours
              </IonLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {OFFERED_TOURS.map((t) => (
                  <IonChip key={t} color={offeredTours.includes(t) ? "secondary" : "medium"} onClick={() => setOfferedTours(toggleArrayItem(offeredTours, t))}>
                    <IonLabel>{t}</IonLabel>
                  </IonChip>
                ))}
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Vehículo y capacidad</IonCardTitle>
            </IonCardHeader>

            <IonCardContent>
              <IonItem style={styles.itemStyle}>
                <IonLabel style={styles.labelStyle}>¿Cuentas con vehículo?</IonLabel>
                <IonToggle checked={hasVehicle} onIonChange={(e) => setHasVehicle(e.detail.checked)} />
              </IonItem>

              {hasVehicle && (
                <IonItem style={styles.itemStyle}>
                  <IonLabel position="stacked" style={styles.labelStyle}>Descripción del vehículo</IonLabel>
                  <IonTextarea style={styles.inputStyle} value={vehicleDescription} onIonInput={(e) => setVehicleDescription(String(e.detail.value ?? ""))} placeholder="Marca, modelo, color, año..." rows={3} />
                </IonItem>
              )}

              <IonItem style={styles.itemStyle}>
                <IonLabel position="stacked" style={styles.labelStyle}>Tamaño máximo de grupo</IonLabel>
                <IonInput style={styles.inputStyle} type="tel" inputmode="numeric" value={maxGroupSize} onIonInput={(e) => setMaxGroupSize(cleanNumber(String(e.detail.value ?? ""), 3))} placeholder="10" maxlength={3} />
              </IonItem>

              <IonLabel style={{ ...styles.labelStyle, display: "block", margin: "14px 0 8px" }}>
                Idiomas
              </IonLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {LANGUAGES.map((l) => (
                  <IonChip key={l} color={languages.includes(l) ? "success" : "medium"} onClick={() => setLanguages(toggleArrayItem(languages, l))}>
                    <IonLabel>{l}</IonLabel>
                  </IonChip>
                ))}
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Documentación requerida</IonCardTitle>
              <IonNote style={styles.noteStyle}>
                Adjunta documentos claros. Se usarán solo para validar tu inscripción.
              </IonNote>
            </IonCardHeader>

            <IonCardContent>
              {[
                ["Cédula de identidad — Frente *", identityFrontFile, setIdentityFrontFile],
                ["Cédula de identidad — Reverso *", identityBackFile, setIdentityBackFile],
                ["Foto de perfil *", profilePhotoFile, setProfilePhotoFile],
                ["Certificación de guía *", guideCertFile, setGuideCertFile],
              ].map(([label, file, setter]) => (
                <label key={String(label)} className="upload-box" style={{ ...styles.fileButtonStyle, marginBottom: 10 }}>
                  {String(label)}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    style={{ display: "none" }}
                    onChange={(e) => (setter as Dispatch<SetStateAction<File | null>>)(getSelectedFile(e.nativeEvent))}
                  />
                  <div className="selected-file" style={{ color: "#4A4A4A", marginTop: "6px", fontSize: ".78rem", fontWeight: 800 }}>
                    {fileLabel(file as File | null)}
                  </div>
                </label>
              ))}
            </IonCardContent>
          </IonCard>

          <IonCard style={styles.cardStyle}>
            <IonCardHeader>
              <IonCardTitle style={styles.cardTitleStyle}>Declaración</IonCardTitle>
            </IonCardHeader>

            <IonCardContent>
              <IonItem style={{ ...styles.itemStyle, alignItems: "flex-start" }}>
                <IonCheckbox checked={acceptTerms} onIonChange={(e) => setAcceptTerms(e.detail.checked)} slot="start" />
                <IonLabel style={{ ...styles.labelStyle, marginLeft: "12px", whiteSpace: "normal", lineHeight: 1.35 }}>
                  Acepto que mis datos y documentos serán verificados únicamente para validar mi postulación como guía.
                </IonLabel>
              </IonItem>

              <IonItem style={{ ...styles.itemStyle, alignItems: "flex-start" }}>
                <IonCheckbox checked={acceptDeclaration} onIonChange={(e) => setAcceptDeclaration(e.detail.checked)} slot="start" />
                <IonLabel style={{ ...styles.labelStyle, marginLeft: "12px", whiteSpace: "normal", lineHeight: 1.35 }}>
                  Declaro que la información enviada es verdadera y corresponde a mi identidad.
                </IonLabel>
              </IonItem>
            </IonCardContent>
          </IonCard>

          {error && (
            <IonText color="danger">
              <p style={{ padding: "0 4px", fontWeight: 900, color: "#B84F2E" }}>{error}</p>
            </IonText>
          )}

          <div style={{ padding: "8px 0 18px" }}>
            <IonButton
              expand="block"
              color="warning"
              disabled={!canSubmitGuide}
              onClick={() => void handleSubmit()}
              style={{ "--border-radius": "16px", height: "52px", fontWeight: 950 } as CSSProperties}
            >
              {loading ? <IonSpinner name="crescent" /> : "Enviar postulación"}
            </IonButton>

            <IonButton expand="block" fill="outline" color="medium" onClick={() => history.goBack()} style={{ marginTop: "8px", "--border-radius": "16px" } as CSSProperties}>
              Cancelar
            </IonButton>
          </div>

          <IonAlert
            isOpen={showSuccess}
            header="¡Postulación enviada!"
            message={successMessage}
            buttons={[{ text: "OK", handler: () => { setShowSuccess(false); history.push("/passenger/home"); } }]}
            onDidDismiss={() => setShowSuccess(false)}
          />
        </IonContent>
      </IonPage>
    );
  }

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

  export function ApplicationStatusPage(): JSX.Element {
    const { session } = useAuth();
    const history = useHistory();
    const [items, setItems] = useState<ApplicationData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useIonViewWillEnter(() => {
      if (!session?.accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      void applicationsService.getMyApplications(session.accessToken)
        .then(setItems)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error"))
        .finally(() => setLoading(false));
    });

    return (
      <IonPage className="driver-registration-page">
        <IonHeader>
          <IonToolbar style={{ "--background": "linear-gradient(135deg,#C89B3C,#8f3c24)", "--color": "#fff" } as CSSProperties}>
            <IonTitle>Estado de mi postulación</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding driver-registration-page">
          {loading && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>
              <IonSpinner name="crescent" />
            </div>
          )}

          {error && <IonText color="danger"><p>{error}</p></IonText>}

          {!loading && items.length === 0 && (
            <IonCard>
              <IonCardContent style={{ textAlign: "center", padding: 18 }}>
                <p style={{ color: "#111", fontWeight: 800 }}>No tienes postulaciones activas.</p>
                <IonButton routerLink="/apply/driver" color="primary" style={{ marginTop: "16px" }}>
                  Inscríbete como conductor
                </IonButton>
              </IonCardContent>
            </IonCard>
          )}

          {items.map((item) => (
            <IonCard key={item.id} style={item.status === "approved" ? { border: "2px solid var(--ion-color-success)" } : {}}>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: "1rem", color: "#111", fontWeight: 950 }}>
                  {TYPE_LABEL[item.type] ?? item.type}
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span
                    style={{
                      background: `var(--ion-color-${STATUS_COLOR[item.status] ?? "medium"})`,
                      color: "#fff",
                      borderRadius: "12px",
                      padding: "2px 10px",
                      fontSize: "0.8rem",
                      fontWeight: 800,
                    }}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: "0.82rem", color: "#444", fontWeight: 700 }}>
                  Última actualización: {new Date(item.updatedAt).toLocaleDateString("es-CL")}
                </p>

                {item.status === "rejected" && item.rejectionReason && (
                  <IonNote color="danger" style={{ display: "block", marginTop: "8px", fontWeight: 900 }}>
                    Motivo de rechazo: {item.rejectionReason}
                  </IonNote>
                )}

                {item.status === "approved" && (
                  <IonText color="success">
                    <p style={{ fontWeight: 900, marginTop: "8px" }}>
                      ¡Tu postulación fue aprobada! Ya puedes usar tu cuenta con el rol aprobado.
                    </p>
                  </IonText>
                )}
              </IonCardContent>
            </IonCard>
          ))}

          <IonButton expand="block" fill="outline" onClick={() => history.goBack()} style={{ marginTop: "16px" }}>
            Volver
          </IonButton>
        </IonContent>
      </IonPage>
    );
  }
