import { IonButton, IonIcon, IonNote, IonSpinner } from "@ionic/react";
import {
  callOutline,
  logoWhatsapp,
  mailOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { RAPAGO_CONTACT } from "@rapa-go/shared";
import { legalService, type LegalDocumentData } from "../../features/legal/legal.service.js";

import {
  PublicSiteShell,
  publicSiteStyles,
} from "./PublicSiteShell.js";

const UPDATED_AT = "29 de julio de 2026";


const LEGAL_TYPE_LABELS: Record<string, string> = {
  terms_and_conditions: "Términos y Condiciones Generales",
  privacy_policy: "Política de Privacidad",
  user_conditions: "Condiciones de Usuarios",
};

function ActiveLegalDocumentPage({
  type,
  fallbackTitle,
}: {
  type: "terms_and_conditions" | "privacy_policy" | "user_conditions";
  fallbackTitle: string;
}): JSX.Element {
  const [document, setDocument] = useState<LegalDocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    legalService
      .getActive()
      .then((items) => {
        if (!active) return;

        const current =
          items.find((item) => item.type === type && item.isActive) ?? null;

        setDocument(current);
        setLoadError(
          current
            ? ""
            : "El documento vigente no está disponible. Comunícate con soporte antes de continuar.",
        );
      })
      .catch(() => {
        if (!active) return;
        setDocument(null);
        setLoadError(
          "No fue posible cargar el documento vigente. Revisa tu conexión y vuelve a intentarlo.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [type]);

  const title =
    document?.title ??
    LEGAL_TYPE_LABELS[type] ??
    fallbackTitle;

  return (
    <PublicSiteShell
      title={title}
      subtitle={
        document
          ? `Versión ${document.version} · Vigente desde ${document.effectiveDate}`
          : `Documento legal de RAPA GO · ${UPDATED_AT}`
      }
    >
      <section style={publicSiteStyles.card}>
        {loading ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              display: "grid",
              justifyItems: "center",
              gap: 12,
              padding: "28px 12px",
            }}
          >
            <IonSpinner name="crescent" />
            <IonNote>Cargando versión legal vigente…</IonNote>
          </div>
        ) : document ? (
          <>
            <div
              style={{
                marginBottom: 18,
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(214,166,64,.42)",
                background: "rgba(248,216,121,.10)",
                color: "#f8d879",
                fontWeight: 850,
              }}
            >
              Versión {document.version} · Vigente desde {document.effectiveDate}
            </div>

            <article
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: 1.75,
                color: "#f4efe7",
              }}
            >
              {document.content}
            </article>
          </>
        ) : (
          <div
            role="alert"
            style={{
              padding: 18,
              borderRadius: 16,
              border: "1px solid rgba(239,68,68,.45)",
              background: "rgba(127,29,29,.28)",
              color: "#fee2e2",
              fontWeight: 800,
              lineHeight: 1.55,
            }}
          >
            {loadError}
          </div>
        )}
      </section>
    </PublicSiteShell>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section style={publicSiteStyles.card}>
      <h2
        style={{
          margin: "0 0 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "#f8d879",
          fontSize: "1.14rem",
          fontWeight: 900,
          lineHeight: 1.25,
          letterSpacing: "0.01em",
        }}
      >
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 20,
            height: 4,
            borderRadius: 2,
            background: "linear-gradient(90deg,#f8d879,#d6a640)",
            boxShadow: "0 2px 8px rgba(214,166,64,.40)",
          }}
        />
        {title}
      </h2>
      <div style={publicSiteStyles.muted}>{children}</div>
    </section>
  );
}

function List({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ul
      className="rapago-public-list"
      style={{ margin: "10px 0 0", paddingLeft: 22, lineHeight: 1.75 }}
    >
      {children}
    </ul>
  );
}

export function PrivacyPublicPage(): JSX.Element {
  return (
    <ActiveLegalDocumentPage
      type="privacy_policy"
      fallbackTitle="Política de Privacidad"
    />
  );
}

export function TermsPublicPage(): JSX.Element {
  return (
    <ActiveLegalDocumentPage
      type="terms_and_conditions"
      fallbackTitle="Términos y Condiciones Generales"
    />
  );
}

export function UserConditionsPublicPage(): JSX.Element {
  return (
    <ActiveLegalDocumentPage
      type="user_conditions"
      fallbackTitle="Condiciones de Usuarios"
    />
  );
}

export function EulaPublicPage(): JSX.Element {
  return (
    <PublicSiteShell
      title="Licencia de uso de RAPA GO"
      subtitle={`Información sobre la licencia. Última actualización: ${UPDATED_AT}.`}
    >
      <Section title="EULA estándar de Apple">
        <p>
          La versión de RAPA GO distribuida mediante App Store utiliza la
          EULA estándar de Apple. Esta página es únicamente informativa y no
          reemplaza, modifica ni duplica esa licencia.
        </p>
        <p>
          Consulta el texto vigente en
          <a
            style={publicSiteStyles.link}
            href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
            target="_blank"
            rel="noreferrer"
          >
            {" "}la EULA estándar de Apple
          </a>.
        </p>
      </Section>

      <Section title="Servicio de movilidad">
        <p>
          Los Términos y Condiciones de RAPA GO regulan la cuenta, los viajes,
          las tarifas, cancelaciones, pagos, soporte y demás servicios de
          movilidad. No se presentan como una EULA personalizada de Apple.
        </p>
      </Section>

      <Section title="Soporte y privacidad">
        <p>
          El tratamiento de datos se rige por la Política de Privacidad. Para
          soporte consulta
          <a style={publicSiteStyles.link} href="/soporte"> api.rapago.cl/soporte</a>.
        </p>
      </Section>
    </PublicSiteShell>
  );
}

export function SupportPublicPage(): JSX.Element {
  const whatsappUrl = `https://wa.me/${RAPAGO_CONTACT.supportPhone}?text=${encodeURIComponent(
    "Hola, necesito ayuda con RAPA GO.",
  )}`;

  const actionStyle = {
    "--border-radius": "16px",
    "--box-shadow": "0 10px 26px rgba(0,0,0,.28)",
    height: "50px",
    fontWeight: 900,
    letterSpacing: "0.02em",
    textTransform: "none",
  } as CSSProperties;

  return (
    <PublicSiteShell
      title="Soporte RAPA GO"
      subtitle="Ayuda para pasajeros, conductores, reservas, pagos y seguridad."
    >
      <Section title="Contacto oficial">
        <div style={{ display: "grid", gap: 10 }}>
          <IonButton href={whatsappUrl} target="_blank" style={actionStyle}>
            <IonIcon icon={logoWhatsapp} slot="start" />
            WhatsApp {RAPAGO_CONTACT.supportPhoneDisplay}
          </IonButton>
          <IonButton href={`tel:+${RAPAGO_CONTACT.supportPhone}`} fill="outline" style={actionStyle}>
            <IonIcon icon={callOutline} slot="start" />
            Llamar a soporte
          </IonButton>
          <IonButton href={`mailto:${RAPAGO_CONTACT.supportEmail}`} fill="outline" style={actionStyle}>
            <IonIcon icon={mailOutline} slot="start" />
            Soporte: {RAPAGO_CONTACT.supportEmail}
          </IonButton>
          <IonButton href={`mailto:${RAPAGO_CONTACT.claimsEmail}`} fill="outline" style={actionStyle}>
            <IonIcon icon={mailOutline} slot="start" />
            Reclamos: {RAPAGO_CONTACT.claimsEmail}
          </IonButton>
          <IonButton href={`mailto:${RAPAGO_CONTACT.privacyEmail}`} fill="outline" style={actionStyle}>
            <IonIcon icon={mailOutline} slot="start" />
            Privacidad: {RAPAGO_CONTACT.privacyEmail}
          </IonButton>
        </div>
      </Section>

      <Section title="Horario de atención">
        <p>
          Atención humana todos los días de <strong>{RAPAGO_CONTACT.supportHours}</strong>,
          {" "}{RAPAGO_CONTACT.supportTimeZone}. No anunciamos atención humana 24/7.
        </p>
        <p>{RAPAGO_CONTACT.afterHoursMessage}</p>
      </Section>

      <Section title="Antes de contactar">
        <List>
          <li>Indica tu nombre y rol: pasajero o conductor.</li>
          <li>Adjunta el folio o ID del viaje cuando exista.</li>
          <li>Explica fecha, hora, origen, destino y forma de pago.</li>
          <li>No envíes contraseñas, códigos de acceso ni datos completos de tarjetas.</li>
        </List>
      </Section>

      <Section title="Emergencias">
        <p>
          <IonIcon icon={shieldCheckmarkOutline} /> En una emergencia real, prioriza
          los servicios públicos de emergencia correspondientes. El canal de RAPA GO
          sirve para registrar y coordinar apoyo relacionado con el viaje, pero no
          reemplaza a policía, bomberos o atención médica.
        </p>
      </Section>

      <Section title="Objetos perdidos y reclamos">
        <p>
          Envía el folio del viaje y una descripción del objeto o problema. RAPA GO
          revisará el caso y protegerá los datos de contacto de las partes. No se
          garantiza la recuperación del objeto, pero se facilitará la coordinación
          disponible.
        </p>
      </Section>

      <Section title="Eliminación de cuenta">
        <p>
          Para solicitarla fuera de la aplicación utiliza
          <a style={publicSiteStyles.link} href="/eliminar-cuenta"> api.rapago.cl/eliminar-cuenta</a>.
        </p>
      </Section>
    </PublicSiteShell>
  );
}
