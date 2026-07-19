import { useState } from "react";
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonList,
  IonRadioGroup,
  IonRadio,
  IonItem,
  IonLabel,
  IonSpinner,
} from "@ionic/react";
import { ROLE_LABELS, type PublicRole } from "./roles.js";

export interface AppleRoleSelectionModalProps {
  isOpen: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (role: PublicRole) => void;
}

/**
 * Shown when the backend reports it needs a role to finish creating a new
 * account signed in with Apple. Only offers the same public roles
 * registration already allows — "admin" is never an option (not just
 * blocked server-side, the UI never renders it).
 */
export function AppleRoleSelectionModal({ isOpen, loading, onCancel, onConfirm }: AppleRoleSelectionModalProps): JSX.Element {
  const [role, setRole] = useState<PublicRole | undefined>(undefined);

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onCancel}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Elige tu tipo de cuenta</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onCancel} disabled={loading}>Cancelar</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <p>Para completar tu registro con Apple, indícanos cómo usarás Rapa Go.</p>
        <IonList>
          <IonRadioGroup
            value={role}
            onIonChange={(e) => { setRole(e.detail.value as PublicRole); }}
          >
            {(Object.entries(ROLE_LABELS) as [PublicRole, string][]).map(([value, label]) => (
              <IonItem key={value}>
                <IonRadio value={value} disabled={loading}>{label}</IonRadio>
                <IonLabel className="ion-hide">{label}</IonLabel>
              </IonItem>
            ))}
          </IonRadioGroup>
        </IonList>
        <IonButton
          expand="block"
          disabled={!role || loading}
          style={{ marginTop: "1rem" }}
          onClick={() => { if (role) onConfirm(role); }}
        >
          {loading ? <IonSpinner name="crescent" /> : "Continuar"}
        </IonButton>
      </IonContent>
    </IonModal>
  );
}
