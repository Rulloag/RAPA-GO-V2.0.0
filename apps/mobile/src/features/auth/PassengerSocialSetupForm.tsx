import type { ChangeEvent, CSSProperties } from "react";
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

/**
 * Formulario social compartido de pasajero (Facebook / Apple).
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

export type PassengerSocialProvider = "facebook" | "apple";

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

const primaryButtonStyle = {
  "--border-radius": "18px",
  "--background": "linear-gradient(135deg,#F8D879 0%,#D6A640 48%,#B84F2E 100%)",
  "--background-activated": "linear-gradient(135deg,#C89B3C,#B84F2E)",
  "--box-shadow": "0 16px 32px rgba(214,166,64,.35)",
  color: "#111",
  height: "54px",
  fontWeight: 950,
  marginTop: "14px",
} as CSSProperties;

const outlineButtonStyle = {
  "--border-radius": "18px",
  "--border-color": "rgba(29,29,27,.42)",
  "--color": "#1D1D1B",
  height: "50px",
  fontWeight: 900,
  marginTop: "10px",
} as CSSProperties;

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
  padding: "18px 20px",
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

const modalItemStyle = {
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
} as CSSProperties;

const modalInputStyle = {
  "--color": "#F6F2EC",
  "--placeholder-color": "rgba(246,242,236,.55)",
  "--placeholder-opacity": "1",
  fontWeight: 850,
} as CSSProperties;

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
};

export interface PassengerSocialSetupFormProps {
  provider: PassengerSocialProvider;
  isOpen: boolean;
  onClose: () => void;
  submitLabel?: string;

  loading: boolean;
  error: string;
  successMessage?: string;

  passengerCondition: PassengerCondition;
  onPassengerConditionChange: (value: PassengerCondition) => void;

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

  onSubmit: () => void;
  setupCode?: string;
}

export function PassengerSocialSetupForm({
  provider,
  isOpen,
  onClose,
  submitLabel,
  loading,
  error,
  successMessage,
  passengerCondition,
  onPassengerConditionChange,
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
  onSubmit,
}: PassengerSocialSetupFormProps): JSX.Element {
  const isResidentRapaNui = passengerCondition === "residente_rapa_nui";
  const emailReadOnly = onEmailChange === undefined;
  const resolvedSubmitLabel =
    submitLabel ?? `Continuar con ${PROVIDER_LABEL[provider]}`;

  const canSubmit =
    acceptTerms && acceptPrivacy && acceptUserConditions && !loading;

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
        <div className="facebook-step-card" style={modalCardStyle}>
          <div className="facebook-step-header" style={modalHeaderStyle}>
            <div>
              <div
                style={{
                  fontSize: ".72rem",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  color: "rgba(248,216,121,.95)",
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
                border: "1px solid rgba(255,255,255,.26)",
                background: "rgba(255,255,255,.10)",
                color: "#fff",
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

            <IonItem style={modalItemStyle}>
              <IonLabel position="stacked" style={{ color: "#F8D879", fontWeight: 950 }}>
                Correo electrónico *
              </IonLabel>
              <IonInput
                style={modalInputStyle}
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

            <IonItem style={modalItemStyle}>
              <IonLabel position="stacked" style={{ color: "#F8D879", fontWeight: 950 }}>
                Celular *
              </IonLabel>
              <IonInput
                style={modalInputStyle}
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
              <IonItem style={modalItemStyle}>
                <IonLabel position="stacked" style={{ color: "#F8D879", fontWeight: 950 }}>
                  RUT *
                </IonLabel>
                <IonInput
                  style={modalInputStyle}
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
              <IonItem style={modalItemStyle}>
                <IonLabel position="stacked" style={{ color: "#F8D879", fontWeight: 950 }}>
                  Pasaporte *
                </IonLabel>
                <IonInput
                  style={modalInputStyle}
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
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={onResidenceDocumentChange}
                  style={{ width: "100%", fontWeight: 850, color: "#111" }}
                />

                {residenceDocumentName && (
                  <IonText color="success">
                    <p style={{ fontSize: "0.84rem", margin: "8px 0 0", fontWeight: 950 }}>
                      ✓ Acreditación cargada: {residenceDocumentName}
                    </p>
                  </IonText>
                )}
              </div>
            )}

            <div
              style={{
                margin: "4px 0 14px",
                padding: "14px",
                borderRadius: 20,
                background: "linear-gradient(135deg,#FFF8E6,#FFFFFF)",
                border: "1px solid rgba(200,155,60,.42)",
              }}
            >
              <div
                style={{
                  marginBottom: 10,
                  color: "#111",
                  fontSize: ".9rem",
                  fontWeight: 950,
                }}
              >
                Documentos legales obligatorios
              </div>

              <IonItem
                className="facebook-legal-card"
                lines="none"
                style={{
                  "--background": "transparent",
                  "--padding-start": "0",
                  "--inner-padding-end": "0",
                  alignItems: "flex-start",
                } as CSSProperties}
              >
                <IonCheckbox
                  slot="start"
                  checked={acceptTerms}
                  onIonChange={(event) => {
                    onAcceptTermsChange(event.detail.checked);
                  }}
                />
                <IonLabel
                  style={{
                    color: "#30271F",
                    whiteSpace: "normal",
                    lineHeight: 1.35,
                    fontWeight: 800,
                  }}
                >
                  Acepto los Términos y Condiciones.
                  <button
                    className="facebook-legal-link"
                    type="button"
                    onClick={onOpenTerms}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "#8A5A00",
                      fontWeight: 950,
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                  >
                    Ver documento
                  </button>
                </IonLabel>
              </IonItem>

              <IonItem
                className="facebook-legal-card"
                lines="none"
                style={{
                  "--background": "transparent",
                  "--padding-start": "0",
                  "--inner-padding-end": "0",
                  alignItems: "flex-start",
                } as CSSProperties}
              >
                <IonCheckbox
                  slot="start"
                  checked={acceptPrivacy}
                  onIonChange={(event) => {
                    onAcceptPrivacyChange(event.detail.checked);
                  }}
                />
                <IonLabel
                  style={{
                    color: "#30271F",
                    whiteSpace: "normal",
                    lineHeight: 1.35,
                    fontWeight: 800,
                  }}
                >
                  Acepto la Política de Privacidad.
                  <button
                    className="facebook-legal-link"
                    type="button"
                    onClick={onOpenPrivacy}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "#8A5A00",
                      fontWeight: 950,
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                  >
                    Ver documento
                  </button>
                </IonLabel>
              </IonItem>

              <IonItem
                className="facebook-legal-card"
                lines="none"
                style={{
                  "--background": "transparent",
                  "--padding-start": "0",
                  "--inner-padding-end": "0",
                  alignItems: "flex-start",
                } as CSSProperties}
              >
                <IonCheckbox
                  slot="start"
                  checked={acceptUserConditions}
                  onIonChange={(event) => {
                    onAcceptUserConditionsChange(event.detail.checked);
                  }}
                />
                <IonLabel
                  style={{
                    color: "#30271F",
                    whiteSpace: "normal",
                    lineHeight: 1.35,
                    fontWeight: 800,
                  }}
                >
                  Acepto las Condiciones para Usuarios.
                </IonLabel>
              </IonItem>

              <p
                style={{
                  margin: "8px 0 0",
                  color: "#675A4A",
                  fontSize: ".76rem",
                  fontWeight: 760,
                  lineHeight: 1.4,
                }}
              >
                Las Condiciones para Conductores no se solicitan a pasajeros.
                Solo corresponden al proceso de postulación de conductor.
              </p>
            </div>

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
              style={primaryButtonStyle}
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
              style={outlineButtonStyle}
            >
              Volver
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
}
