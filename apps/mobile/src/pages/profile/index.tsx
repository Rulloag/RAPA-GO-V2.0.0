import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useState, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { useAuth } from "../../features/auth";
import { profileService, type ProfileData } from "../../features/profile/profile.service";
import { ROLE_HOME } from "../../navigation/RouteGuard";

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

export function ProfileIndexPage(): JSX.Element {
  const { session } = useAuth();
  const history = useHistory();

  const [profile,    setProfile]    = useState<ProfileData | null>(null);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);

  const [nameInput,      setNameInput]      = useState("");
  const [avatarInput,    setAvatarInput]    = useState("");
  const [saving,         setSaving]         = useState(false);
  const [saveError,      setSaveError]      = useState<string | null>(null);
  const [saveSuccess,    setSaveSuccess]    = useState(false);

  const loadProfile = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await profileService.getProfile(session.accessToken);
      setProfile(data);
      setNameInput(data.name);
      setAvatarInput(data.avatarUrl ?? "");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar el perfil.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  async function handleSave() {
    if (!session?.accessToken || !profile) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const payload: { name?: string; avatarUrl?: string | null } = {};
      const trimmedName = nameInput.trim();
      if (trimmedName && trimmedName !== profile.name) {
        payload.name = trimmedName;
      }
      const trimmedAvatar = avatarInput.trim();
      const avatarChanged = trimmedAvatar !== (profile.avatarUrl ?? "");
      if (avatarChanged) {
        payload.avatarUrl = trimmedAvatar === "" ? null : trimmedAvatar;
      }
      if (Object.keys(payload).length === 0) {
        setSaveError("No hay cambios para guardar.");
        setSaving(false);
        return;
      }
      const updated = await profileService.updateProfile(session.accessToken, payload);
      setProfile(updated);
      setNameInput(updated.name);
      setAvatarInput(updated.avatarUrl ?? "");
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  const roleHome = profile?.role ? ROLE_HOME[profile.role as keyof typeof ROLE_HOME] : undefined;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mi Perfil</IonTitle>
          {roleHome && (
            <IonButtons slot="start">
              <IonButton onClick={() => history.push(roleHome)}>Inicio</IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && (
          <IonText color="danger">
            <p>{loadError}</p>
          </IonText>
        )}

        {!loading && profile && (
          <>
            {/* Account info */}
            <IonCard style={{ marginBottom: "16px" }}>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: "1rem" }}>Datos de la cuenta</IonCardTitle>
              </IonCardHeader>
              <IonCardContent style={{ paddingTop: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem" }}>
                  <div><strong>Email:</strong> {profile.email}</div>
                  <div><strong>Rol:</strong> {ROLE_LABEL[profile.role] ?? profile.role}</div>
                  <div>
                    <strong>Estado:</strong>{" "}
                    <span style={{ color: profile.status === "active" ? "var(--ion-color-success)" : "var(--ion-color-warning)" }}>
                      {STATUS_LABEL[profile.status] ?? profile.status}
                    </span>
                  </div>
                  <div>
                    <strong>Verificado:</strong>{" "}
                    <span style={{ color: profile.isVerified ? "var(--ion-color-success)" : "var(--ion-color-medium)" }}>
                      {profile.isVerified ? "Sí" : "No"}
                    </span>
                  </div>
                  <div style={{ color: "var(--ion-color-medium)", fontSize: "0.75rem" }}>
                    Miembro desde {new Date(profile.createdAt).toLocaleDateString("es-CL")}
                  </div>
                </div>
              </IonCardContent>
            </IonCard>

            {/* Edit form */}
            <IonCard>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: "1rem" }}>Editar perfil</IonCardTitle>
              </IonCardHeader>
              <IonCardContent style={{ paddingTop: 0 }}>
                <IonItem lines="full">
                  <IonLabel position="stacked">Nombre</IonLabel>
                  <IonInput
                    value={nameInput}
                    onIonInput={(e) => setNameInput(String(e.detail.value ?? ""))}
                    placeholder="Tu nombre completo"
                    maxlength={100}
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" style={{ marginTop: "8px" }}>
                  <IonLabel position="stacked">URL de avatar (opcional)</IonLabel>
                  <IonInput
                    value={avatarInput}
                    onIonInput={(e) => setAvatarInput(String(e.detail.value ?? ""))}
                    placeholder="https://..."
                    type="url"
                    clearInput
                  />
                  <IonNote slot="helper" style={{ fontSize: "0.7rem" }}>
                    Carga de imágenes disponible en una versión futura.
                  </IonNote>
                </IonItem>

                {saveSuccess && (
                  <IonText color="success">
                    <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>✓ Cambios guardados correctamente.</p>
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
                  {saving ? <IonSpinner name="dots" /> : "Guardar cambios"}
                </IonButton>
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}

export function ProfileDocumentsPage(): JSX.Element {
  const m = meta("/profile/documents");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function ProfileBankAccountPage(): JSX.Element {
  const m = meta("/profile/bank-account");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function ProfileSecurityPage(): JSX.Element {
  const m = meta("/profile/security");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
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
