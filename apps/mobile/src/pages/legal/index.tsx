import React, { useEffect, useState } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton,
  IonButtons, IonNote, IonSpinner,
} from "@ionic/react";
import { useParams } from "react-router-dom";
import { legalService, type LegalDocumentData } from "../../features/legal/legal.service.js";

const TYPE_TITLES: Record<string, string> = {
  "terms-and-conditions":   "Términos y Condiciones",
  "privacy-policy":         "Política de Privacidad",
  "intellectual-property":  "Propiedad Intelectual",
  "software-license":       "Licencia de Software",
  "data-providers":         "Proveedores de Datos",
  "user-conditions":        "Condiciones para Usuarios",
  "driver-conditions":      "Condiciones para Conductores",
  "guide-conditions":       "Condiciones para Guías",
  "event-conditions":       "Condiciones para Eventos",
};

function toDbType(slug: string): string {
  return slug.replace(/-/g, "_");
}

export function LegalPage(): React.ReactElement {
  const { type } = useParams<{ type: string }>();
  const [doc, setDoc] = useState<LegalDocumentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    legalService.getActive()
      .then(items => {
        const found = items.find(d => d.type === toDbType(type ?? ""));
        setDoc(found ?? null);
      })
      .catch(() => setDoc(null))
      .finally(() => setLoading(false));
  }, [type]);

  const title = TYPE_TITLES[type ?? ""] ?? "Documento Legal";
  const unavailable = "Este documento legal no está disponible en este momento. No puedes aceptarlo ni continuar una operación que lo requiera. Comunícate con privacidad@rapago.cl o soporte@rapago.cl.";

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/" /></IonButtons>
          <IonTitle>{title}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading ? (
          <div style={{ textAlign: "center", paddingTop: "2rem" }}><IonSpinner /></div>
        ) : (
          <>
            {doc && (
              <div style={{ marginBottom: "1rem" }}>
                <IonNote>Versión {doc.version} — Vigente desde {doc.effectiveDate}</IonNote>
              </div>
            )}
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {doc?.content ?? unavailable}
            </div>
            {doc && (
              <p style={{ marginTop: "2rem", textAlign: "center" }}>
                <IonNote>Última actualización: {new Date(doc.updatedAt ?? doc.createdAt).toLocaleDateString("es-CL")}</IonNote>
              </p>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
