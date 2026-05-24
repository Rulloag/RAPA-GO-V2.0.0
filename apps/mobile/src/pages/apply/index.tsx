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
import { useState } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../../features/auth/index.js";
import { applicationsService, type ApplicationData } from "../../features/applications/applications.service.js";

const SPECIALTIES = ["Arqueología", "Botánica", "Astronomía", "Historia", "Cultura Rapa Nui", "Senderismo"];
const OFFERED_TOURS = ["Ahu Tongariki", "Rano Raraku", "Anakena", "Orongo", "Tahai", "Custom"];
const LANGUAGES = ["Español", "Inglés", "Rapa Nui", "Francés", "Alemán", "Portugués"];

function toggleArrayItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function isExpiryWithin6Months(dateStr: string): boolean {
  const expiry = new Date(dateStr);
  const sixMonthsLater = new Date();
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
  return expiry < sixMonthsLater;
}

export function ApplicationDriverPage(): JSX.Element {
  const { session } = useAuth();
  const history = useHistory();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rut, setRut] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  const [hasOwnVehicle, setHasOwnVehicle] = useState(false);
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");

  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptDeclaration, setAcceptDeclaration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const input: Record<string, unknown> = {
        type: "driver",
        firstName, lastName, email, phone,
        ...(rut ? { rut } : {}),
        ...(birthDate ? { birthDate } : {}),
        ...(city ? { city } : {}),
        ...(emergencyContactName ? { emergencyContactName } : {}),
        ...(emergencyContactPhone ? { emergencyContactPhone } : {}),
        hasOwnVehicle,
        ...(hasOwnVehicle && vehicleBrand ? { vehicleBrand } : {}),
        ...(hasOwnVehicle && vehicleModel ? { vehicleModel } : {}),
        ...(hasOwnVehicle && vehicleYear ? { vehicleYear: Number(vehicleYear) } : {}),
        ...(hasOwnVehicle && vehiclePlate ? { vehiclePlate } : {}),
        ...(hasOwnVehicle && vehicleColor ? { vehicleColor } : {}),
        ...(licenseNumber ? { licenseNumber } : {}),
        ...(licenseExpiry ? { licenseExpiry } : {}),
      };
      const result = await applicationsService.createApplication(input, session?.accessToken);
      setSuccessMessage(result.message);
      setShowSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Inscripción como Conductor</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonList>
          <IonItemDivider><IonLabel>Datos Personales</IonLabel></IonItemDivider>
          <IonItem>
            <IonLabel position="stacked">Nombre *</IonLabel>
            <IonInput value={firstName} onIonInput={(e) => setFirstName(e.detail.value ?? "")} placeholder="Tu nombre" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Apellido *</IonLabel>
            <IonInput value={lastName} onIonInput={(e) => setLastName(e.detail.value ?? "")} placeholder="Tu apellido" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Email *</IonLabel>
            <IonInput type="email" value={email} onIonInput={(e) => setEmail(e.detail.value ?? "")} placeholder="correo@ejemplo.com" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Teléfono *</IonLabel>
            <IonInput type="tel" value={phone} onIonInput={(e) => setPhone(e.detail.value ?? "")} placeholder="+56912345678" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">RUT</IonLabel>
            <IonInput value={rut} onIonInput={(e) => setRut(e.detail.value ?? "")} placeholder="12.345.678-9" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Ciudad</IonLabel>
            <IonInput value={city} onIonInput={(e) => setCity(e.detail.value ?? "")} placeholder="Hanga Roa" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Fecha de nacimiento</IonLabel>
            <IonInput type="date" value={birthDate} onIonInput={(e) => setBirthDate(e.detail.value ?? "")} />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Contacto de emergencia</IonLabel>
            <IonInput value={emergencyContactName} onIonInput={(e) => setEmergencyContactName(e.detail.value ?? "")} placeholder="Nombre" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Teléfono emergencia</IonLabel>
            <IonInput type="tel" value={emergencyContactPhone} onIonInput={(e) => setEmergencyContactPhone(e.detail.value ?? "")} placeholder="+56912345678" />
          </IonItem>

          <IonItemDivider><IonLabel>Vehículo</IonLabel></IonItemDivider>
          <IonItem>
            <IonLabel>¿Tienes vehículo propio?</IonLabel>
            <IonToggle checked={hasOwnVehicle} onIonChange={(e) => setHasOwnVehicle(e.detail.checked)} />
          </IonItem>
          {hasOwnVehicle && (
            <>
              <IonItem>
                <IonLabel position="stacked">Marca</IonLabel>
                <IonInput value={vehicleBrand} onIonInput={(e) => setVehicleBrand(e.detail.value ?? "")} placeholder="Toyota" />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Modelo</IonLabel>
                <IonInput value={vehicleModel} onIonInput={(e) => setVehicleModel(e.detail.value ?? "")} placeholder="Hilux" />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Año</IonLabel>
                <IonInput type="number" value={vehicleYear} onIonInput={(e) => setVehicleYear(e.detail.value ?? "")} placeholder="2020" />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Patente</IonLabel>
                <IonInput value={vehiclePlate} onIonInput={(e) => setVehiclePlate(e.detail.value ?? "")} placeholder="ABCD12" />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Color</IonLabel>
                <IonInput value={vehicleColor} onIonInput={(e) => setVehicleColor(e.detail.value ?? "")} placeholder="Blanco" />
              </IonItem>
            </>
          )}

          <IonItemDivider><IonLabel>Licencia de conducir</IonLabel></IonItemDivider>
          <IonItem>
            <IonLabel position="stacked">Número de licencia</IonLabel>
            <IonInput value={licenseNumber} onIonInput={(e) => setLicenseNumber(e.detail.value ?? "")} placeholder="Nº licencia" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Vencimiento de licencia</IonLabel>
            <IonInput type="date" value={licenseExpiry} onIonInput={(e) => setLicenseExpiry(e.detail.value ?? "")} />
          </IonItem>
          {licenseExpiry && isExpiryWithin6Months(licenseExpiry) && (
            <IonNote color="warning" style={{ padding: "8px 16px", display: "block" }}>
              Tu licencia vence pronto. Considera renovarla.
            </IonNote>
          )}

          <IonItemDivider><IonLabel>Documentos</IonLabel></IonItemDivider>
          <IonItem disabled>
            <IonLabel>Carnet frente</IonLabel>
          </IonItem>
          <IonItem disabled>
            <IonLabel>Carnet reverso</IonLabel>
          </IonItem>
          <IonItem disabled>
            <IonLabel>Licencia frente</IonLabel>
          </IonItem>
          <IonItem disabled>
            <IonLabel>Licencia reverso</IonLabel>
          </IonItem>
          <IonItem disabled>
            <IonLabel>Foto de perfil</IonLabel>
          </IonItem>
          <IonNote style={{ padding: "8px 16px", display: "block" }}>
            Sube fotos de tus documentos (disponible próximamente)
          </IonNote>

          <IonItemDivider><IonLabel>Declaración</IonLabel></IonItemDivider>
          <IonItem>
            <IonCheckbox
              checked={acceptTerms}
              onIonChange={(e) => setAcceptTerms(e.detail.checked)}
              slot="start"
            />
            <IonLabel style={{ marginLeft: "12px", whiteSpace: "normal" }}>
              Acepto que mis datos serán verificados
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonCheckbox
              checked={acceptDeclaration}
              onIonChange={(e) => setAcceptDeclaration(e.detail.checked)}
              slot="start"
            />
            <IonLabel style={{ marginLeft: "12px", whiteSpace: "normal" }}>
              Declaro que la información es verdadera
            </IonLabel>
          </IonItem>
        </IonList>

        {error && (
          <IonText color="danger">
            <p style={{ padding: "0 16px" }}>{error}</p>
          </IonText>
        )}

        <div style={{ padding: "16px 0" }}>
          <IonButton
            expand="block"
            disabled={!acceptTerms || !acceptDeclaration || loading}
            onClick={handleSubmit}
          >
            {loading ? <IonSpinner name="crescent" /> : "Enviar postulación"}
          </IonButton>
          <IonButton expand="block" fill="outline" onClick={() => history.goBack()} style={{ marginTop: "8px" }}>
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

export function ApplicationGuidePage(): JSX.Element {
  const { session } = useAuth();
  const history = useHistory();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rut, setRut] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  const [experienceYears, setExperienceYears] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [offeredTours, setOfferedTours] = useState<string[]>([]);

  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicleDescription, setVehicleDescription] = useState("");
  const [maxGroupSize, setMaxGroupSize] = useState("");

  const [languages, setLanguages] = useState<string[]>([]);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptDeclaration, setAcceptDeclaration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const input: Record<string, unknown> = {
        type: "guide",
        firstName, lastName, email, phone,
        ...(rut ? { rut } : {}),
        ...(birthDate ? { birthDate } : {}),
        ...(city ? { city } : {}),
        ...(emergencyContactName ? { emergencyContactName } : {}),
        ...(emergencyContactPhone ? { emergencyContactPhone } : {}),
        ...(experienceYears ? { experienceYears: Number(experienceYears) } : {}),
        ...(specialties.length > 0 ? { specialties } : {}),
        ...(offeredTours.length > 0 ? { offeredTours } : {}),
        hasVehicle,
        ...(hasVehicle && vehicleDescription ? { vehicleDescription } : {}),
        ...(maxGroupSize ? { maxGroupSize: Number(maxGroupSize) } : {}),
        ...(languages.length > 0 ? { languages } : {}),
      };
      const result = await applicationsService.createApplication(input, session?.accessToken);
      setSuccessMessage(result.message);
      setShowSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Inscripción como Guía</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonList>
          <IonItemDivider><IonLabel>Datos Personales</IonLabel></IonItemDivider>
          <IonItem>
            <IonLabel position="stacked">Nombre *</IonLabel>
            <IonInput value={firstName} onIonInput={(e) => setFirstName(e.detail.value ?? "")} placeholder="Tu nombre" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Apellido *</IonLabel>
            <IonInput value={lastName} onIonInput={(e) => setLastName(e.detail.value ?? "")} placeholder="Tu apellido" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Email *</IonLabel>
            <IonInput type="email" value={email} onIonInput={(e) => setEmail(e.detail.value ?? "")} placeholder="correo@ejemplo.com" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Teléfono *</IonLabel>
            <IonInput type="tel" value={phone} onIonInput={(e) => setPhone(e.detail.value ?? "")} placeholder="+56912345678" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">RUT</IonLabel>
            <IonInput value={rut} onIonInput={(e) => setRut(e.detail.value ?? "")} placeholder="12.345.678-9" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Ciudad</IonLabel>
            <IonInput value={city} onIonInput={(e) => setCity(e.detail.value ?? "")} placeholder="Hanga Roa" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Fecha de nacimiento</IonLabel>
            <IonInput type="date" value={birthDate} onIonInput={(e) => setBirthDate(e.detail.value ?? "")} />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Contacto de emergencia</IonLabel>
            <IonInput value={emergencyContactName} onIonInput={(e) => setEmergencyContactName(e.detail.value ?? "")} placeholder="Nombre" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Teléfono emergencia</IonLabel>
            <IonInput type="tel" value={emergencyContactPhone} onIonInput={(e) => setEmergencyContactPhone(e.detail.value ?? "")} placeholder="+56912345678" />
          </IonItem>

          <IonItemDivider><IonLabel>Experiencia</IonLabel></IonItemDivider>
          <IonItem>
            <IonLabel position="stacked">Años de experiencia</IonLabel>
            <IonInput type="number" value={experienceYears} onIonInput={(e) => setExperienceYears(e.detail.value ?? "")} placeholder="0" />
          </IonItem>
          <IonItem>
            <IonLabel>Especialidades</IonLabel>
          </IonItem>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "8px 16px" }}>
            {SPECIALTIES.map((s) => (
              <IonChip
                key={s}
                color={specialties.includes(s) ? "primary" : "medium"}
                onClick={() => setSpecialties(toggleArrayItem(specialties, s))}
              >
                <IonLabel>{s}</IonLabel>
              </IonChip>
            ))}
          </div>
          <IonItem>
            <IonLabel>Tipos de tours</IonLabel>
          </IonItem>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "8px 16px" }}>
            {OFFERED_TOURS.map((t) => (
              <IonChip
                key={t}
                color={offeredTours.includes(t) ? "secondary" : "medium"}
                onClick={() => setOfferedTours(toggleArrayItem(offeredTours, t))}
              >
                <IonLabel>{t}</IonLabel>
              </IonChip>
            ))}
          </div>

          <IonItemDivider><IonLabel>Vehículo y capacidad</IonLabel></IonItemDivider>
          <IonItem>
            <IonLabel>¿Cuentas con vehículo?</IonLabel>
            <IonToggle checked={hasVehicle} onIonChange={(e) => setHasVehicle(e.detail.checked)} />
          </IonItem>
          {hasVehicle && (
            <IonItem>
              <IonLabel position="stacked">Descripción del vehículo</IonLabel>
              <IonTextarea value={vehicleDescription} onIonInput={(e) => setVehicleDescription(e.detail.value ?? "")} placeholder="Marca, modelo, color, año..." rows={3} />
            </IonItem>
          )}
          <IonItem>
            <IonLabel position="stacked">Tamaño máximo de grupo</IonLabel>
            <IonInput type="number" value={maxGroupSize} onIonInput={(e) => setMaxGroupSize(e.detail.value ?? "")} placeholder="10" />
          </IonItem>

          <IonItemDivider><IonLabel>Idiomas</IonLabel></IonItemDivider>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "8px 16px" }}>
            {LANGUAGES.map((l) => (
              <IonChip
                key={l}
                color={languages.includes(l) ? "success" : "medium"}
                onClick={() => setLanguages(toggleArrayItem(languages, l))}
              >
                <IonLabel>{l}</IonLabel>
              </IonChip>
            ))}
          </div>

          <IonItemDivider><IonLabel>Documentos</IonLabel></IonItemDivider>
          <IonItem disabled><IonLabel>Carnet frente</IonLabel></IonItem>
          <IonItem disabled><IonLabel>Carnet reverso</IonLabel></IonItem>
          <IonItem disabled><IonLabel>Foto de perfil</IonLabel></IonItem>
          <IonItem disabled><IonLabel>Certificación de guía</IonLabel></IonItem>
          <IonNote style={{ padding: "8px 16px", display: "block" }}>
            Sube fotos de tus documentos (disponible próximamente)
          </IonNote>

          <IonItemDivider><IonLabel>Declaración</IonLabel></IonItemDivider>
          <IonItem>
            <IonCheckbox checked={acceptTerms} onIonChange={(e) => setAcceptTerms(e.detail.checked)} slot="start" />
            <IonLabel style={{ marginLeft: "12px", whiteSpace: "normal" }}>
              Acepto que mis datos serán verificados
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonCheckbox checked={acceptDeclaration} onIonChange={(e) => setAcceptDeclaration(e.detail.checked)} slot="start" />
            <IonLabel style={{ marginLeft: "12px", whiteSpace: "normal" }}>
              Declaro que la información es verdadera
            </IonLabel>
          </IonItem>
        </IonList>

        {error && (
          <IonText color="danger">
            <p style={{ padding: "0 16px" }}>{error}</p>
          </IonText>
        )}

        <div style={{ padding: "16px 0" }}>
          <IonButton
            expand="block"
            disabled={!acceptTerms || !acceptDeclaration || loading}
            onClick={handleSubmit}
          >
            {loading ? <IonSpinner name="crescent" /> : "Enviar postulación"}
          </IonButton>
          <IonButton expand="block" fill="outline" onClick={() => history.goBack()} style={{ marginTop: "8px" }}>
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
  pending:      "Pendiente",
  under_review: "En revisión",
  approved:     "Aprobada",
  rejected:     "Rechazada",
  on_hold:      "En espera",
};

const STATUS_COLOR: Record<string, string> = {
  pending:      "warning",
  under_review: "tertiary",
  approved:     "success",
  rejected:     "danger",
  on_hold:      "medium",
};

const TYPE_LABEL: Record<string, string> = {
  driver:          "Conductor",
  guide:           "Guía",
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
    void applicationsService.getMyApplications(session.accessToken)
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Estado de mi postulación</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}
        {error && <IonText color="danger"><p>{error}</p></IonText>}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: "center", marginTop: "40px" }}>
            <p>No tienes postulaciones activas.</p>
            <IonButton routerLink="/apply/driver" color="primary" style={{ marginTop: "16px" }}>
              Inscríbete como conductor
            </IonButton>
            <IonButton routerLink="/apply/guide" color="secondary" style={{ marginTop: "8px" }}>
              Inscríbete como guía
            </IonButton>
          </div>
        )}

        {items.map((item) => (
          <IonCard key={item.id} style={item.status === "approved" ? { border: "2px solid var(--ion-color-success)" } : {}}>
            <IonCardHeader>
              <IonCardTitle style={{ fontSize: "1rem" }}>
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
                    fontWeight: 600,
                  }}
                >
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--ion-color-medium)" }}>
                Última actualización: {new Date(item.updatedAt).toLocaleDateString("es-CL")}
              </p>
              {item.status === "rejected" && item.rejectionReason && (
                <IonNote color="danger" style={{ display: "block", marginTop: "8px" }}>
                  Motivo de rechazo: {item.rejectionReason}
                </IonNote>
              )}
              {item.status === "approved" && (
                <IonText color="success">
                  <p style={{ fontWeight: 600, marginTop: "8px" }}>
                    ¡Tu postulación fue aprobada! Ya puedes iniciar sesión con tu cuenta.
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
