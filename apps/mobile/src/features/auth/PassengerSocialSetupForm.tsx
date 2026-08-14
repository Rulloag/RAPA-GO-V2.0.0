import { useRef, type ChangeEvent, type CSSProperties } from "react";
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSpinner,
  IonText,
} from "@ionic/react";

type IonicStyle = CSSProperties &
  Record<`--${string}`, string | number | undefined>;

/**
 * Formulario social compartido de pasajero (Facebook / Apple / Google).
 *
 * Reutiliza EXACTAMENTE la estructura visual, clases CSS
 * (`facebook-step-modal`, `facebook-step-content`, `facebook-step-card`,
 * `facebook-step-header`, `facebook-step-body`) y paleta de colores del
 * formulario original de Facebook (ver theme/global.css). No renombrar estas
 * clases: son las mismas que estilizan ambos proveedores.
 */

export type PassengerCondition =
  | "turista_chileno"
  | "turista_extranjero"
  | "residente_rapa_nui"
  | "";

export type PassengerFareType = "resident" | "chilean" | "foreigner";

export type PassengerSocialProvider = "facebook" | "apple" | "google";

export function getPassengerFareType(
  condition: PassengerCondition,
): PassengerFareType {
  if (condition === "residente_rapa_nui") return "resident";
  if (condition === "turista_chileno") return "chilean";
  return "foreigner";
}

export function requiresRutForPassengerCondition(
  value: PassengerCondition,
): boolean {
  return value === "turista_chileno" || value === "residente_rapa_nui";
}

export function requiresPassportForPassengerCondition(
  value: PassengerCondition,
): boolean {
  return value === "turista_extranjero";
}

export function cleanRut(value: string): string {
  return value.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
}

export function formatRut(value: string): string {
  const cleaned = cleanRut(value);
  if (cleaned.length <= 1) return cleaned;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  return `${body}-${dv}`;
}

export function isValidRut(value: string): boolean {
  const cleaned = cleanRut(value);
  if (!/^\d{7,8}[0-9K]$/.test(cleaned)) return false;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expectedNumber = 11 - (sum % 11);
  const expectedDv =
    expectedNumber === 11 ? "0" : expectedNumber === 10 ? "K" : String(expectedNumber);

  return dv === expectedDv;
}

export function normalizePassportForAuth(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

export function isValidPassportForAuth(value: unknown): boolean {
  const clean = normalizePassportForAuth(value).replace(/-/g, "");
  return clean.length >= 5 && clean.length <= 15;
}

const primaryButtonStyle: IonicStyle = {
  "--border-radius": "18px",
  "--background": "linear-gradient(135deg,#F8D879 0%,#D6A640 48%,#B84F2E 100%)",
  "--background-activated": "linear-gradient(135deg,#C89B3C,#B84F2E)",
  "--box-shadow": "0 16px 32px rgba(214,166,64,.35)",
  color: "#111",
  height: "54px",
  fontWeight: 950,
  marginTop: "14px",
};

const outlineButtonStyle: IonicStyle = {
  "--border-radius": "18px",
  "--border-color": "rgba(29,29,27,.42)",
  "--color": "#1D1D1B",
  height: "50px",
  fontWeight: 900,
  marginTop: "10px",
};

const modalCardStyle: CSSProperties = {
  width: "min(92vw, 560px)",
  margin: "18px auto 24px",
  borderRadius: "30px",
  overflow: "hidden",
  background: "linear-gradient(180deg, rgba(246,242,236,.98), rgba(232,221,202,.98))",
  border: "1px solid rgba(214,166,64,.38)",
  boxShadow: "0 30px 80px rgba(0,0,0,.48)",
  color: "#111",
};

const modalHeaderStyle: CSSProperties = {
  // paddingTop respeta la Safe Area (notch/Dynamic Island) sin perder el
  // padding visual mínimo de 18px en dispositivos sin notch.
  paddingTop: "max(18px, env(safe-area-inset-top))",
  paddingRight: "20px",
  paddingBottom: "18px",
  paddingLeft: "20px",
  color: "#fff",
  background: "linear-gradient(135deg,#171717 0%,#5A241A 48%,#C89B3C 120%)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const modalBodyStyle: CSSProperties = {
  padding: "18px",
};

const modalItemStyle: IonicStyle = {
  "--background": "rgba(17,17,17,.93)",
  "--color": "#F6F2EC",
  "--border-color": "transparent",
  "--highlight-color-focused": "#D6A640",
  "--padding-start": "16px",
  "--inner-padding-end": "16px",
  border: "1px solid rgba(200,155,60,.35)",
  borderRadius: "18px",
  marginBottom: "12px",
  overflow: "hidden",
};

const modalInputStyle: IonicStyle = {
  "--color": "#F6F2EC",
  "--placeholder-color": "rgba(246,242,236,.55)",
  "--placeholder-opacity": "1",
  fontWeight: 850,
};

export const conditionOptions: Array<{
  value: Exclude<PassengerCondition, "">;
  title: string;
  subtitle: string;
  icon: string;
}> = [
  {
    value: "turista_chileno",
    title: "Turista chileno",
    subtitle: "Tarifa nacional para visitantes de Chile.",
    icon: "🇨🇱",
  },
  {
    value: "turista_extranjero",
    title: "Turista extranjero",
    subtitle: "Tarifa internacional para visitantes.",
    icon: "🌎",
  },
  {
    value: "residente_rapa_nui",
    title: "RAPA NUI / RESIDENTE RAPA NUI",
    subtitle:
      "La categoría se activa inmediatamente y queda sujeta a revisión administrativa.",
    icon: "🗿",
  },
];

const PROVIDER_LABEL: Record<PassengerSocialProvider, string> = {
  facebook: "Facebook",
  apple: "Apple",
  google: "Google",
};

export interface PassengerSocialSetupFormProps {
  provider: PassengerSocialProvider;
  isOpen: boolean;
  onClose: () => void;
  submitLabel?: string;
  visualVariant?: "default" | "apple-light";

  loading: boolean;
  error: string;
  successMessage?: string;

  passengerCondition: PassengerCondition;
  onPassengerConditionChange: (value: PassengerCondition) => void;

  displayName?: string;
  onDisplayNameChange?: (value: string) => void;

  email: string;
  /** Si se omite, el campo de correo se muestra de solo lectura (caso Apple). */
  onEmailChange?: (value: string) => void;

  phone: string;
  onPhoneChange: (value: string) => void;

  rut: string;
  onRutChange: (value: string) => void;
  onRutBlur?: () => void;

  passport: string;
  onPassportChange: (value: string) => void;

  residenceDocumentName: string;
  onResidenceDocumentChange: (event: ChangeEvent<HTMLInputElement>) => void;

  acceptTerms: boolean;
  onAcceptTermsChange: (value: boolean) => void;
  acceptPrivacy: boolean;
  onAcceptPrivacyChange: (value: boolean) => void;
  acceptUserConditions: boolean;
  onAcceptUserConditionsChange: (value: boolean) => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenUserConditions: () => void;

  onSubmit: () => void;
  setupCode?: string;
}

export function PassengerSocialSetupForm({
  provider,
  isOpen,
  onClose,
  submitLabel,
  visualVariant = "default",
  loading,
  error,
  successMessage,
  passengerCondition,
  onPassengerConditionChange,
  displayName,
  onDisplayNameChange,
  email,
  onEmailChange,
  phone,
  onPhoneChange,
  rut,
  onRutChange,
  onRutBlur,
  passport,
  onPassportChange,
  residenceDocumentName,
  onResidenceDocumentChange,
  acceptTerms,
  onAcceptTermsChange,
  acceptPrivacy,
  onAcceptPrivacyChange,
  acceptUserConditions,
  onAcceptUserConditionsChange,
  onOpenTerms,
  onOpenPrivacy,
  onOpenUserConditions,
  onSubmit,
}: PassengerSocialSetupFormProps): JSX.Element {
  const residenceDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const isResidentRapaNui = passengerCondition === "residente_rapa_nui";
  const emailReadOnly = onEmailChange === undefined;
  const resolvedSubmitLabel =
    submitLabel ?? `Continuar con ${PROVIDER_LABEL[provider]}`;
  const isAppleLight = visualVariant === "apple-light";

  const resolvedModalCardStyle: CSSProperties = isAppleLight
    ? {
        ...modalCardStyle,
        background:
          "linear-gradient(180deg,rgba(255,253,247,.99),rgba(247,239,225,.99))",
        border: "1px solid rgba(200,155,60,.52)",
        boxShadow: "0 28px 70px rgba(80,55,22,.24)",
        color: "#211A13",
      }
    : modalCardStyle;

  const resolvedModalHeaderStyle: CSSProperties = isAppleLight
    ? {
        ...modalHeaderStyle,
        color: "#2D2114",
        background:
          "linear-gradient(135deg,rgba(255,253,247,.98),rgba(239,224,198,.98))",
        borderBottom: "1px solid rgba(200,155,60,.30)",
      }
    : modalHeaderStyle;

  const resolvedModalItemStyle: IonicStyle = isAppleLight
    ? {
        ...modalItemStyle,
        "--background": "rgba(255,255,255,.94)",
        "--color": "#211A13",
        "--border-color": "transparent",
        "--highlight-color-focused": "#C89B3C",
        border: "1px solid rgba(200,155,60,.42)",
        boxShadow: "0 8px 22px rgba(70,48,21,.06)",
      }
    : modalItemStyle;

  const resolvedModalInputStyle: IonicStyle = isAppleLight
    ? {
        ...modalInputStyle,
        "--color": "#211A13",
        "--placeholder-color": "rgba(64,54,44,.55)",
        "--placeholder-opacity": "1",
      }
    : modalInputStyle;

  const resolvedPrimaryButtonStyle: IonicStyle = isAppleLight
    ? {
        ...primaryButtonStyle,
        "--background":
          "linear-gradient(135deg,#D7AA43 0%,#F1D68D 100%)",
        "--background-activated":
          "linear-gradient(135deg,#C89B3C,#E6C46F)",
        "--box-shadow": "0 16px 32px rgba(200,155,60,.30)",
        color: "#17120D",
      }
    : primaryButtonStyle;

  const resolvedOutlineButtonStyle: IonicStyle = isAppleLight
    ? {
        ...outlineButtonStyle,
        "--border-color": "rgba(64,45,24,.48)",
        "--color": "#2E2418",
      }
    : outlineButtonStyle;

  const canSubmit =
    acceptTerms && acceptPrivacy && acceptUserConditions && !loading;

  const legalAcceptances = [
    {
      key: "terms",
      label: "He leído y acepto los Términos y Condiciones Generales de Rapa Go, versión 4.0.",
      checked: acceptTerms,
      onChange: onAcceptTermsChange,
      onOpen: onOpenTerms,
    },
    {
      key: "user-conditions",
      label: "He leído y acepto las Condiciones de Usuarios, versión 1.1, como anexo subordinado a los Términos Generales.",
      checked: acceptUserConditions,
      onChange: onAcceptUserConditionsChange,
      onOpen: onOpenUserConditions,
    },
    {
      key: "privacy",
      label: "He leído la Política de Privacidad de Rapa Go, versión 1.0, y consiento el tratamiento de mis datos personales conforme a ella en los casos en que dicho tratamiento requiera mi consentimiento.",
      checked: acceptPrivacy,
      onChange: onAcceptPrivacyChange,
      onOpen: onOpenPrivacy,
    },
  ] as const;

  return (
    <IonModal
      className="facebook-step-modal"
      isOpen={isOpen}
      onDidDismiss={onClose}
      style={
        {
          "--width": "min(94vw, 620px)",
          "--height": "92vh",
          "--max-height": "92vh",
          "--border-radius": "30px",
        } as CSSProperties
      }
    >
      <IonContent className="facebook-step-content" scrollY={true}>
        <div className="facebook-step-card" style={resolvedModalCardStyle}>
          <div className="facebook-step-header" style={resolvedModalHeaderStyle}>
            <div>
              <div
                style={{
                  fontSize: ".72rem",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  color: isAppleLight ? "#9A6500" : "rgba(248,216,121,.95)",
                  fontWeight: 950,
                  marginBottom: 4,
                }}
              >
                Completa tu perfil
              </div>
              <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 950 }}>
                Datos del pasajero
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                border: isAppleLight
                  ? "1px solid rgba(154,101,0,.30)"
                  : "1px solid rgba(255,255,255,.26)",
                background: isAppleLight
                  ? "rgba(255,255,255,.80)"
                  : "rgba(255,255,255,.10)",
                color: isAppleLight ? "#704600" : "#fff",
                fontWeight: 950,
                fontSize: "1.25rem",
              }}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <div className="facebook-step-body" style={modalBodyStyle}>
            <p
              style={{
                margin: "0 0 14px",
                color: "#4A4237",
                fontSize: ".92rem",
                lineHeight: 1.38,
                fontWeight: 760,
              }}
            >
              Selecciona tu tipo de pasajero. Si eliges RAPA NUI / RESIDENTE
              RAPA NUI, debes adjuntar una acreditación; la categoría se
              activa inmediatamente y queda sujeta a revisión administrativa.
            </p>

            {error && (
              <IonText color="danger">
                <p
                  className="auth-error"
                  style={{
                    background: "rgba(239,68,68,.12)",
                    border: "1px solid rgba(239,68,68,.30)",
                    padding: "10px 12px",
                    borderRadius: 14,
                    fontWeight: 950,
                    margin: "0 0 12px",
                  }}
                >
                  {error}
                </p>
              </IonText>
            )}

            <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
              {conditionOptions.map((option) => {
                const active = passengerCondition === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onPassengerConditionChange(option.value)}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "46px 1fr 26px",
                      alignItems: "center",
                      gap: 12,
                      borderRadius: 20,
                      padding: "12px",
                      textAlign: "left",
                      border: active
                        ? "2px solid rgba(34,197,94,.72)"
                        : "1px solid rgba(200,155,60,.38)",
                      background: active
                        ? "linear-gradient(135deg,#ECFDF3,#FFFFFF)"
                        : "rgba(255,255,255,.74)",
                      boxShadow: active
                        ? "0 12px 28px rgba(34,197,94,.16)"
                        : "0 8px 20px rgba(0,0,0,.07)",
                      color: "#111",
                    }}
                  >
                    <span
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 16,
                        display: "grid",
                        placeItems: "center",
                        background: active ? "#22C55E" : "#1D1D1B",
                        color: "#fff",
                        fontSize: "1.25rem",
                      }}
                    >
                      {option.icon}
                    </span>

                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: ".95rem", fontWeight: 950 }}>
                        {option.title}
                      </strong>
                      <span style={{ display: "block", color: "#675A4A", fontSize: ".76rem", fontWeight: 760, marginTop: 2 }}>
                        {option.subtitle}
                      </span>
                    </span>

                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                        background: active ? "#22C55E" : "rgba(17,17,17,.10)",
                        color: active ? "#fff" : "#777",
                        fontWeight: 950,
                      }}
                    >
                      {active ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                margin: "2px 0 12px",
                padding: "12px",
                borderRadius: 18,
                background: "rgba(17,17,17,.08)",
                border: "1px solid rgba(200,155,60,.30)",
                color: "#372F28",
                fontWeight: 850,
                fontSize: ".82rem",
                lineHeight: 1.35,
              }}
            >
              🗿 Si eres Residente Rapa Nui, el documento quedará pendiente
              para revisión del administrador antes de aprobar la tarifa.
            </div>

            {displayName !== undefined && onDisplayNameChange && (
              <IonItem style={resolvedModalItemStyle}>
                <IonLabel position="stacked" style={{ color: isAppleLight ? "#8A5A00" : "#F8D879", fontWeight: 950 }}>
                  Nombre *
                </IonLabel>
                <IonInput
                  style={resolvedModalInputStyle}
                  type="text"
                  value={displayName}
                  onIonInput={(event) => {
                    onDisplayNameChange(String(event.detail.value ?? ""));
                  }}
                  placeholder="Nombre y apellido"
                  autocomplete="name"
                  maxlength={100}
                  required
                />
              </IonItem>
            )}

            <IonItem style={resolvedModalItemStyle}>
              <IonLabel position="stacked" style={{ color: isAppleLight ? "#8A5A00" : "#F8D879", fontWeight: 950 }}>
                Correo electrónico *
              </IonLabel>
              <IonInput
                style={resolvedModalInputStyle}
                type="email"
                value={email}
                readonly={emailReadOnly}
                disabled={emailReadOnly}
                onIonInput={(e) => {
                  onEmailChange?.(String(e.detail.value ?? ""));
                }}
                placeholder="tu@correo.com"
                autocomplete="email"
                inputmode="email"
                required
              />
            </IonItem>

            <IonItem style={resolvedModalItemStyle}>
              <IonLabel position="stacked" style={{ color: isAppleLight ? "#8A5A00" : "#F8D879", fontWeight: 950 }}>
                Celular *
              </IonLabel>
              <IonInput
                style={resolvedModalInputStyle}
                type="tel"
                value={phone}
                onIonInput={(e) => {
                  onPhoneChange(String(e.detail.value ?? ""));
                }}
                placeholder="+56 9 1234 5678"
                autocomplete="tel"
                inputmode="tel"
                required
              />
            </IonItem>

            {passengerCondition !== "turista_extranjero" && (
              <IonItem style={resolvedModalItemStyle}>
                <IonLabel position="stacked" style={{ color: isAppleLight ? "#8A5A00" : "#F8D879", fontWeight: 950 }}>
                  RUT *
                </IonLabel>
                <IonInput
                  style={resolvedModalInputStyle}
                  type="text"
                  value={rut}
                  onIonInput={(e) => {
                    onRutChange(String(e.detail.value ?? ""));
                  }}
                  onIonBlur={() => onRutBlur?.()}
                  placeholder="12345678-9"
                  autocomplete="off"
                  inputmode="text"
                  required
                />
              </IonItem>
            )}

            {passengerCondition === "turista_extranjero" && (
              <IonItem style={resolvedModalItemStyle}>
                <IonLabel position="stacked" style={{ color: isAppleLight ? "#8A5A00" : "#F8D879", fontWeight: 950 }}>
                  Pasaporte *
                </IonLabel>
                <IonInput
                  style={resolvedModalInputStyle}
                  type="text"
                  value={passport}
                  placeholder="Ej: A1234567"
                  autocomplete="off"
                  inputmode="text"
                  maxlength={20}
                  required
                  onIonInput={(event) => {
                    onPassportChange(normalizePassportForAuth(event.detail.value ?? ""));
                  }}
                />
              </IonItem>
            )}

            {isResidentRapaNui && (
              <div
                style={{
                  borderRadius: 20,
                  padding: 14,
                  background: "linear-gradient(135deg,#FFF8E6,#FFFFFF)",
                  border: residenceDocumentName
                    ? "2px solid rgba(34,197,94,.62)"
                    : "2px dashed rgba(200,155,60,.72)",
                  marginBottom: 12,
                }}
              >
                <strong style={{ display: "block", fontSize: ".9rem", color: "#111", fontWeight: 950 }}>
                  ACREDITACIÓN RESIDENCIA *
                </strong>
                <p style={{ margin: "4px 0 10px", color: "#675A4A", fontSize: ".78rem", fontWeight: 760 }}>
                  Si eres Rapanui, adjunta una foto clara de tu cédula de
                  identidad. Si eres residente, adjunta tu resolución de
                  residencia vigente emitida por la Delegación Presidencial
                  Provincial de Isla de Pascua. PDF, JPG, JPEG, PNG o WEBP;
                  máximo 1.5 MB.
                </p>

                <input
                  ref={residenceDocumentInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={onResidenceDocumentChange}
                  disabled={loading}
                />

                <IonButton
                  type="button"
                  expand="block"
                  fill="outline"
                  color="warning"
                  disabled={loading}
                  onClick={() => residenceDocumentInputRef.current?.click()}
                  style={{ "--border-radius": "14px", fontWeight: 950 } as CSSProperties}
                >
                  {residenceDocumentName ? "Cambiar acreditación" : "Adjuntar acreditación"}
                </IonButton>

                {residenceDocumentName && (
                  <IonText color="success">
                    <p style={{ fontSize: "0.84rem", margin: "8px 0 0", fontWeight: 950 }}>
                      ✓ Acreditación cargada: {residenceDocumentName}
                    </p>
                  </IonText>
                )}
              </div>
            )}

            <section
              aria-label="Divulgación de geolocalización"
              style={{
                margin: "4px 0 12px",
                padding: "13px 14px",
                borderRadius: 18,
                background: "rgba(255,248,230,.94)",
                border: "1px solid rgba(200,155,60,.34)",
                color: "#4A3520",
                fontSize: ".82rem",
                fontWeight: 760,
                lineHeight: 1.45,
              }}
            >
              <strong style={{ display: "block", marginBottom: 4 }}>
                Geolocalización
              </strong>
              Rapa Go utiliza tu ubicación al confirmar el origen o solicitar
              un viaje para mostrar tu posición, buscar conductores y calcular
              la ruta. Puedes ingresar origen y destino manualmente si no
              autorizas la ubicación. La solicitud del permiso del sistema deberá efectuarse después de la
              divulgación y no dentro de una casilla contractual genérica.
            </section>

            <section
              aria-labelledby={`${provider}-legal-title`}
              style={{
                margin: "4px 0 14px",
                padding: "14px",
                borderRadius: 20,
                background: "linear-gradient(135deg,#FFF8E6,#FFFFFF)",
                border: "1px solid rgba(200,155,60,.42)",
              }}
            >
              <h3
                id={`${provider}-legal-title`}
                style={{
                  margin: "0 0 12px",
                  color: "#211A13",
                  fontSize: ".95rem",
                  fontWeight: 950,
                }}
              >
                Documentos legales obligatorios
              </h3>

              <div style={{ display: "grid", gap: 10 }}>
                {legalAcceptances.map((document) => (
                  <div
                    key={document.key}
                    className="facebook-legal-card"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "34px minmax(0,1fr)",
                      alignItems: "start",
                      gap: 12,
                      padding: "14px",
                      borderRadius: 18,
                      background: "rgba(255,255,255,.96)",
                      border: document.checked
                        ? "2px solid rgba(34,197,94,.68)"
                        : "1px solid rgba(200,155,60,.42)",
                      boxShadow: document.checked
                        ? "0 10px 24px rgba(34,197,94,.12)"
                        : "0 8px 20px rgba(70,48,21,.06)",
                    }}
                  >
                    <IonCheckbox
                      checked={document.checked}
                      disabled={loading}
                      aria-label={document.label}
                      onIonChange={(event) => {
                        document.onChange(event.detail.checked);
                      }}
                      style={
                        {
                          "--size": "30px",
                          "--border-radius": "9px",
                          "--border-color": "#8A5A00",
                          "--border-color-checked": "#22C55E",
                          "--checkbox-background-checked": "#22C55E",
                          "--checkmark-color": "#FFFFFF",
                          marginTop: 1,
                        } as IonicStyle
                      }
                    />

                    <div style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: "block",
                          color: "#2A2119",
                          fontSize: ".94rem",
                          fontWeight: 950,
                          lineHeight: 1.35,
                        }}
                      >
                        {document.label}
                      </strong>

                      <button
                        className="facebook-legal-link"
                        type="button"
                        disabled={loading}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          document.onOpen();
                        }}
                        style={{
                          marginTop: 8,
                          padding: "7px 13px",
                          borderRadius: 999,
                          border: "1px solid rgba(138,90,0,.28)",
                          background:
                            "linear-gradient(135deg,#FFF6D8,#F7E7B0)",
                          color: "#6F4700",
                          fontSize: ".78rem",
                          fontWeight: 950,
                          cursor: loading ? "not-allowed" : "pointer",
                          opacity: loading ? 0.62 : 1,
                        }}
                      >
                        Ver documento
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {successMessage && (
              <div
                role="status"
                style={{
                  margin: "4px 0 12px",
                  padding: "12px 14px",
                  borderRadius: 16,
                  background: "rgba(34,197,94,.12)",
                  border: "1px solid rgba(34,197,94,.38)",
                  color: "#14532D",
                  fontSize: ".84rem",
                  fontWeight: 850,
                  lineHeight: 1.4,
                }}
              >
                {successMessage}
              </div>
            )}

            <IonButton
              expand="block"
              style={resolvedPrimaryButtonStyle}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSubmit();
              }}
              type="button"
              disabled={!canSubmit}
            >
              {loading ? (
                <>
                  <IonSpinner name="crescent" style={{ marginRight: 8 }} />
                  Validando datos...
                </>
              ) : (
                resolvedSubmitLabel
              )}
            </IonButton>

            <IonButton
              expand="block"
              fill="outline"
              onClick={onClose}
              type="button"
              style={resolvedOutlineButtonStyle}
            >
              Volver
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
}
