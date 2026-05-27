import { IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonPage, IonRefresher, IonRefresherContent, IonSelect, IonSelectOption, IonSpinner, IonText, IonTitle, IonToggle, IonToolbar } from "@ionic/react";
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "../../../features/auth/index.js";
import { passengerProfileService, type PassengerProfileData, type UpsertPassengerProfilePayload } from "../../../features/passengers/passengerProfile.service.js";
import { legalService, type LegalDocumentData, type UserAcceptanceData } from "../../../features/legal/legal.service.js";

function LegalStatusSection({ token }: { token: string }): React.ReactElement {
  const [docs,        setDocs]        = useState<LegalDocumentData[]>([]);
  const [acceptances, setAcceptances] = useState<UserAcceptanceData[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([legalService.getActive(), legalService.getMyAcceptances(token)])
      .then(([d, a]) => { setDocs(d); setAcceptances(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const getStatus = (doc: LegalDocumentData) => {
    const acc = acceptances.find((a) => a.legalDocumentId === doc.id);
    if (!acc) return "not_accepted";
    if (acc.versionAccepted !== doc.version) return "new_version";
    return "accepted";
  };

  const handleAccept = (doc: LegalDocumentData) => {
    void legalService.accept(token, doc.id, doc.version).then(() => {
      legalService.getMyAcceptances(token).then(setAcceptances).catch(() => {});
    });
  };

  return (
    <IonCard style={{ marginTop: "24px" }}>
      <IonCardHeader>
        <IonCardTitle style={{ fontSize: "1rem" }}>Documentos Legales</IonCardTitle>
      </IonCardHeader>
      <IonCardContent style={{ padding: 0 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}><IonSpinner name="dots" /></div>
        ) : (
          <IonList>
            {docs.map((doc) => {
              const status = getStatus(doc);
              return (
                <IonItem key={doc.id}>
                  <IonLabel><h3>{doc.title}</h3><p>v{doc.version}</p></IonLabel>
                  {status === "accepted"     && <IonBadge color="success" slot="end">Aceptado</IonBadge>}
                  {status === "new_version"  && <IonBadge color="warning" slot="end">Nueva versión</IonBadge>}
                  {status === "not_accepted" && <IonBadge color="danger"  slot="end">Pendiente</IonBadge>}
                  {(status === "not_accepted" || status === "new_version") && (
                    <IonButton fill="clear" size="small" slot="end" onClick={() => handleAccept(doc)}>Aceptar</IonButton>
                  )}
                </IonItem>
              );
            })}
          </IonList>
        )}
      </IonCardContent>
    </IonCard>
  );
}

export default function ProfilePage(): JSX.Element {
  const { session } = useAuth();
  const [profile,   setProfile]   = useState<PassengerProfileData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk,    setSaveOk]    = useState(false);
  const [phone,                 setPhone]                 = useState("");
  const [preferredLanguage,     setPreferredLanguage]     = useState("es");
  const [notificationEnabled,   setNotificationEnabled]   = useState(true);
  const [emailNotifications,    setEmailNotifications]    = useState(true);
  const [smsNotifications,      setSmsNotifications]      = useState(false);
  const [emergencyContactName,  setEmergencyContactName]  = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  const loadProfile = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true); setLoadError(null);
    try {
      const data = await passengerProfileService.getMyProfile(session.accessToken);
      setProfile(data);
      setPhone(data.phone ?? "");
      setPreferredLanguage(data.preferredLanguage);
      setNotificationEnabled(data.notificationEnabled);
      setEmailNotifications(data.emailNotifications);
      setSmsNotifications(data.smsNotifications);
      setEmergencyContactName(data.emergencyContactName ?? "");
      setEmergencyContactPhone(data.emergencyContactPhone ?? "");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar el perfil.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  async function handleSave() {
    if (!session?.accessToken) return;
    setSaving(true); setSaveError(null); setSaveOk(false);
    try {
      const payload: UpsertPassengerProfilePayload = { preferredLanguage, notificationEnabled, emailNotifications, smsNotifications };
      const trimPhone   = phone.trim();
      const trimEmName  = emergencyContactName.trim();
      const trimEmPhone = emergencyContactPhone.trim();
      if (trimPhone)   payload.phone                = trimPhone;
      if (trimEmName)  payload.emergencyContactName = trimEmName;
      if (trimEmPhone) payload.emergencyContactPhone = trimEmPhone;
      const updated = await passengerProfileService.upsertMyProfile(session.accessToken, payload);
      setProfile(updated);
      setSaveOk(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  const userName = session?.user?.name ?? "";
  const initials = userName.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary"><IonTitle>Mi Perfil</IonTitle></IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void loadProfile().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}><IonSpinner name="crescent" /></div>}
        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && profile && (
          <>
            {!profile.phone && (
              <IonCard style={{ margin: "0 0 12px", background: "#fff3cd", border: "1px solid #ffc107" }}>
                <IonCardContent style={{ padding: "8px 14px" }}>
                  <IonText><p style={{ margin: 0, fontSize: "0.82rem", color: "#6b4700" }}>Complete su teléfono para solicitar viajes</p></IonText>
                </IonCardContent>
              </IonCard>
            )}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "var(--ion-color-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", fontWeight: 700, color: "#fff" }}>
                {initials || "?"}
              </div>
            </div>
            <IonList>
              <IonListHeader><IonLabel><strong>Datos personales</strong></IonLabel></IonListHeader>
              <IonItem lines="full"><IonLabel position="stacked">Nombre</IonLabel><IonInput value={userName} readonly /></IonItem>
              <IonItem lines="full"><IonLabel position="stacked">Email</IonLabel><IonInput value={session?.user?.email ?? ""} readonly /></IonItem>
              <IonItem lines="full">
                <IonLabel position="stacked">Teléfono</IonLabel>
                <IonInput value={phone} onIonInput={(e) => setPhone(String(e.detail.value ?? ""))} placeholder="+56 9 1234 5678" type="tel" maxlength={20} clearInput />
              </IonItem>
            </IonList>
            <IonList style={{ marginTop: "16px" }}>
              <IonListHeader><IonLabel><strong>Idioma preferido</strong></IonLabel></IonListHeader>
              <IonItem lines="none">
                <IonLabel>Idioma</IonLabel>
                <IonSelect interface="action-sheet" value={preferredLanguage} onIonChange={(e) => setPreferredLanguage(e.detail.value as string)}>
                  <IonSelectOption value="es">Español</IonSelectOption>
                  <IonSelectOption value="en">English</IonSelectOption>
                  <IonSelectOption value="rapa_nui">Rapa Nui</IonSelectOption>
                </IonSelect>
              </IonItem>
            </IonList>
            <IonList style={{ marginTop: "16px" }}>
              <IonListHeader><IonLabel><strong>Notificaciones</strong></IonLabel></IonListHeader>
              <IonItem lines="full"><IonLabel>Notificaciones activas</IonLabel><IonToggle slot="end" checked={notificationEnabled} onIonChange={(e) => setNotificationEnabled(e.detail.checked)} /></IonItem>
              <IonItem lines="full"><IonLabel>Notificaciones por email</IonLabel><IonToggle slot="end" checked={emailNotifications} onIonChange={(e) => setEmailNotifications(e.detail.checked)} /></IonItem>
              <IonItem lines="none"><IonLabel>Notificaciones por SMS</IonLabel><IonToggle slot="end" checked={smsNotifications} onIonChange={(e) => setSmsNotifications(e.detail.checked)} /></IonItem>
            </IonList>
            <IonList style={{ marginTop: "16px" }}>
              <IonListHeader><IonLabel><strong>Contacto de emergencia</strong></IonLabel></IonListHeader>
              <IonItem lines="full"><IonLabel position="stacked">Nombre</IonLabel><IonInput value={emergencyContactName} onIonInput={(e) => setEmergencyContactName(String(e.detail.value ?? ""))} placeholder="Nombre del contacto" maxlength={100} clearInput /></IonItem>
              <IonItem lines="none"><IonLabel position="stacked">Teléfono</IonLabel><IonInput value={emergencyContactPhone} onIonInput={(e) => setEmergencyContactPhone(String(e.detail.value ?? ""))} placeholder="+56 9 1234 5678" type="tel" maxlength={20} clearInput /></IonItem>
            </IonList>
            {saveOk    && <IonText color="success"><p style={{ margin: "12px 0 0", fontSize: "0.85rem" }}>Perfil guardado correctamente.</p></IonText>}
            {saveError && <IonText color="danger"><p style={{ margin: "12px 0 0", fontSize: "0.85rem" }}>{saveError}</p></IonText>}
            <IonButton expand="block" style={{ marginTop: "20px" }} onClick={() => void handleSave()} disabled={saving}>
              {saving ? <IonSpinner name="dots" /> : "Guardar cambios"}
            </IonButton>
            {session?.accessToken && <LegalStatusSection token={session.accessToken} />}
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
