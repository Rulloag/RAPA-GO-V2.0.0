import {
  IonAlert,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useState, useCallback } from "react";
import {
  cardOutline,
  carOutline,
  cloudOfflineOutline,
  compassOutline,
  documentTextOutline,
  keyOutline,
  peopleOutline,
  personOutline,
  settingsOutline,
} from "ionicons/icons";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { HomeHeader } from "../../components/HomeHeader";
import { ActionCard } from "../../components/ActionCard";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { adminService, type AdminUserData, type AdminDocumentData, type AdminRideData, type ActiveDriverData } from "../../features/admin/admin.service";
import { offlineService, type OfflineBooking } from "../../features/offline/offline.service";
import { inferZoneFromText, getZoneLabel, RAPA_NUI_ZONES, type RapaNuiZoneId } from "@rapa-go/shared";

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

export function AdminHomePage(): JSX.Element {
  return (
    <IonPage>
      <HomeHeader title="Panel Admin" />
      <IonContent className="ion-padding">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          <ActionCard
            icon={peopleOutline}
            title="Usuarios"
            subtitle="Gestión de cuentas y roles"
            route={ROUTES.ADMIN.USERS}
            color="danger"
          />
          <ActionCard
            icon={carOutline}
            title="Conductores"
            subtitle="Estado operacional de conductores"
            route={ROUTES.ADMIN.DRIVERS}
            color="danger"
          />
          <ActionCard
            icon={compassOutline}
            title="Guías"
            subtitle="Gestión de guías locales"
            route={ROUTES.ADMIN.GUIDES}
            color="danger"
          />
          <ActionCard
            icon={keyOutline}
            title="Rent a Car"
            subtitle="Operadores y servicios de arriendo"
            route={ROUTES.ADMIN.RENTALS}
            color="danger"
          />
          <ActionCard
            icon={personOutline}
            title="Viajes"
            subtitle="Despacho manual y monitor de viajes"
            route={ROUTES.ADMIN.TRIPS}
            color="danger"
          />
          <ActionCard
            icon={cardOutline}
            title="Pagos"
            subtitle="Transacciones y conciliación"
            route={ROUTES.ADMIN.PAYMENTS}
            color="danger"
          />
          <ActionCard
            icon={documentTextOutline}
            title="Documentos"
            subtitle="Revisar y aprobar documentos de usuarios."
            route={ROUTES.ADMIN.DOCUMENTS}
            color="danger"
          />
          <ActionCard
            icon={cloudOfflineOutline}
            title="Viajes Offline"
            subtitle="Reservas sin conectividad"
            route={ROUTES.ADMIN.OFFLINE_BOOKINGS}
            color="warning"
          />
          <ActionCard
            icon={settingsOutline}
            title="Configuración"
            subtitle="Parámetros y tarifas del sistema"
            route={ROUTES.ADMIN.SETTINGS}
            color="medium"
          />
        </div>
      </IonContent>
    </IonPage>
  );
}

const ROLE_LABEL: Record<string, string> = {
  passenger: "Pasajero",
  driver:    "Conductor",
  guide:     "Guía",
  rental:    "Arriendo",
  admin:     "Admin",
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "warning",
  active:    "success",
  suspended: "medium",
  banned:    "danger",
};

const STATUS_LABEL: Record<string, string> = {
  pending:   "Pendiente",
  active:    "Activo",
  suspended: "Suspendido",
  banned:    "Bloqueado",
};

export function AdminUsersPage(): JSX.Element {
  const { session } = useAuth();

  const [users,      setUsers]      = useState<AdminUserData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);

  const [filterRole,   setFilterRole]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  const [updatingId,  setUpdatingId]  = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const params: { role?: string; status?: string; search?: string } = {};
      if (filterRole)   params.role   = filterRole;
      if (filterStatus) params.status = filterStatus;
      if (filterSearch.trim()) params.search = filterSearch.trim();
      const data = await adminService.listUsers(session.accessToken, params);
      setUsers(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar usuarios.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, filterRole, filterStatus, filterSearch]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  async function handleStatusChange(userId: string, newStatus: string) {
    if (!session?.accessToken) return;
    setUpdatingId(userId);
    setUpdateError(null);
    try {
      const updated = await adminService.updateUserStatus(session.accessToken, userId, newStatus);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Error al actualizar estado.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Usuarios</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">

        {/* Filters */}
        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "10px 12px" }}>
            <IonItem lines="full">
              <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Buscar</IonLabel>
              <IonInput
                value={filterSearch}
                onIonInput={(e) => setFilterSearch(String(e.detail.value ?? ""))}
                placeholder="Nombre o email..."
                clearInput
              />
            </IonItem>

            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <IonItem lines="none" style={{ flex: 1 }}>
                <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Rol</IonLabel>
                <IonSelect
                  value={filterRole}
                  onIonChange={(e) => setFilterRole(String(e.detail.value ?? ""))}
                  placeholder="Todos"
                  interface="popover"
                >
                  <IonSelectOption value="">Todos</IonSelectOption>
                  <IonSelectOption value="passenger">Pasajero</IonSelectOption>
                  <IonSelectOption value="driver">Conductor</IonSelectOption>
                  <IonSelectOption value="guide">Guía</IonSelectOption>
                  <IonSelectOption value="rental">Arriendo</IonSelectOption>
                  <IonSelectOption value="admin">Admin</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem lines="none" style={{ flex: 1 }}>
                <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Estado</IonLabel>
                <IonSelect
                  value={filterStatus}
                  onIonChange={(e) => setFilterStatus(String(e.detail.value ?? ""))}
                  placeholder="Todos"
                  interface="popover"
                >
                  <IonSelectOption value="">Todos</IonSelectOption>
                  <IonSelectOption value="pending">Pendiente</IonSelectOption>
                  <IonSelectOption value="active">Activo</IonSelectOption>
                  <IonSelectOption value="suspended">Suspendido</IonSelectOption>
                  <IonSelectOption value="banned">Bloqueado</IonSelectOption>
                </IonSelect>
              </IonItem>
            </div>

            <IonButton
              expand="block"
              size="small"
              fill="outline"
              color="danger"
              style={{ marginTop: "8px" }}
              onClick={() => void loadUsers()}
              disabled={loading}
            >
              {loading ? <IonSpinner name="dots" /> : "Aplicar filtros"}
            </IonButton>
          </IonCardContent>
        </IonCard>

        {/* Summary count */}
        {!loading && !loadError && (
          <IonText color="medium">
            <p style={{ fontSize: "0.78rem", margin: "0 0 10px" }}>
              {users.length} usuario{users.length !== 1 ? "s" : ""} encontrado{users.length !== 1 ? "s" : ""}
            </p>
          </IonText>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {/* Error */}
        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {/* Empty */}
        {!loading && !loadError && users.length === 0 && (
          <IonText color="medium"><p>No se encontraron usuarios.</p></IonText>
        )}

        {/* User cards */}
        {!loading && users.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {users.map((user) => {
              const statusColor = STATUS_COLOR[user.status] ?? "medium";
              const statusLabel = STATUS_LABEL[user.status] ?? user.status;
              const roleLabel   = ROLE_LABEL[user.role]   ?? user.role;
              return (
                <IonCard key={user.id} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {user.name}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)", marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {user.email}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          <IonBadge color="primary" style={{ fontSize: "0.68rem" }}>{roleLabel}</IonBadge>
                          <IonBadge color={statusColor} style={{ fontSize: "0.68rem" }}>{statusLabel}</IonBadge>
                          {user.isVerified && (
                            <IonBadge color="tertiary" style={{ fontSize: "0.68rem" }}>Verificado</IonBadge>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--ion-color-medium)", flexShrink: 0, textAlign: "right" }}>
                        {new Date(user.createdAt).toLocaleDateString("es-CL")}
                      </div>
                    </div>

                    {/* Status selector */}
                    <div style={{ marginTop: "10px", borderTop: "1px solid var(--ion-color-light-shade)", paddingTop: "8px" }}>
                      <IonItem lines="none" style={{ "--padding-start": "0", "--inner-padding-end": "0", "--min-height": "36px" }}>
                        <IonLabel style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)", flexShrink: 0, marginRight: "8px" }}>
                          Estado:
                        </IonLabel>
                        {updatingId === user.id ? (
                          <IonSpinner name="dots" style={{ width: "20px", height: "20px" }} />
                        ) : (
                          <IonSelect
                            value={user.status}
                            interface="popover"
                            style={{ fontSize: "0.8rem" }}
                            onIonChange={(e) => {
                              const val = String(e.detail.value ?? "");
                              if (val && val !== user.status) {
                                void handleStatusChange(user.id, val);
                              }
                            }}
                          >
                            <IonSelectOption value="pending">Pendiente</IonSelectOption>
                            <IonSelectOption value="active">Activo</IonSelectOption>
                            <IonSelectOption value="suspended">Suspendido</IonSelectOption>
                            <IonSelectOption value="banned">Bloqueado</IonSelectOption>
                          </IonSelect>
                        )}
                      </IonItem>
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        {updateError && (
          <IonText color="danger">
            <p style={{ fontSize: "0.85rem", marginTop: "10px" }}>{updateError}</p>
          </IonText>
        )}
      </IonContent>
    </IonPage>
  );
}

function availabilityLabel(a: string): string {
  if (a === "available") return "Disponible";
  if (a === "busy")      return "Ocupado";
  return "No disponible";
}

function availabilityColor(a: string): string {
  if (a === "available") return "success";
  if (a === "busy")      return "warning";
  return "medium";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Sin actividad reciente";
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function AdminDriversPage(): JSX.Element {
  const { session } = useAuth();
  const token = session?.accessToken;

  const [drivers,             setDrivers]             = useState<ActiveDriverData[]>([]);
  const [loading,             setLoading]             = useState(true);
  const [loadError,           setLoadError]           = useState<string | null>(null);
  const [filterAvailability,  setFilterAvailability]  = useState<string>("all");
  const [filterZone,          setFilterZone]          = useState<string>("all");

  const loadDrivers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await adminService.listActiveDrivers(token);
      setDrivers(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar conductores.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadDrivers(); }, [loadDrivers]);

  const filtered = drivers.filter((d) => {
    if (filterAvailability !== "all" && d.availability !== filterAvailability) return false;
    if (filterZone !== "all" && d.currentZone !== filterZone) return false;
    return true;
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Conductores</IonTitle>
          <div slot="end" style={{ paddingRight: "8px" }}>
            <IonButton fill="clear" color="light" onClick={() => void loadDrivers()} disabled={loading}>
              Actualizar
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await loadDrivers(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Filters */}
        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "10px 12px" }}>
            <IonItem lines="full">
              <IonLabel>Disponibilidad</IonLabel>
              <IonSelect
                interface="action-sheet"
                value={filterAvailability}
                onIonChange={(e) => setFilterAvailability(String(e.detail.value ?? "all"))}
              >
                <IonSelectOption value="all">Todas</IonSelectOption>
                <IonSelectOption value="available">Disponibles</IonSelectOption>
                <IonSelectOption value="unavailable">No disponibles</IonSelectOption>
                <IonSelectOption value="busy">Ocupados</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Zona</IonLabel>
              <IonSelect
                interface="action-sheet"
                value={filterZone}
                onIonChange={(e) => setFilterZone(String(e.detail.value ?? "all"))}
              >
                <IonSelectOption value="all">Todas las zonas</IonSelectOption>
                {RAPA_NUI_ZONES.filter((z) => z.id !== "desconocida").map((z) => (
                  <IonSelectOption key={z.id} value={z.id}>{z.label}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </IonCardContent>
        </IonCard>

        {!loading && !loadError && (
          <IonText color="medium">
            <p style={{ fontSize: "0.78rem", margin: "0 0 10px" }}>
              {filtered.length} conductor{filtered.length !== 1 ? "es" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </p>
          </IonText>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {filtered.length === 0 && !loading && !loadError && (
          <IonItem lines="none">
            <IonLabel color="medium" className="ion-text-center">
              No hay conductores que coincidan con el filtro.
            </IonLabel>
          </IonItem>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filtered.map((driver) => (
              <IonCard key={driver.id} style={{ margin: 0 }}>
                <IonCardContent style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: "1rem" }}>{driver.name}</strong>
                    <IonBadge color={availabilityColor(driver.availability)}>
                      {availabilityLabel(driver.availability)}
                    </IonBadge>
                  </div>
                  <IonNote style={{ display: "block", marginBottom: 4 }}>{driver.email}</IonNote>
                  <IonNote style={{ display: "block", marginBottom: 4 }}>
                    Zona: {driver.currentZone ? getZoneLabel(driver.currentZone as RapaNuiZoneId) : "Zona no informada"}
                  </IonNote>
                  {driver.availability === "busy" && driver.currentRideId && (
                    <IonNote color="warning" style={{ display: "block", marginBottom: 4 }}>
                      En viaje activo
                    </IonNote>
                  )}
                  <IonNote style={{ display: "block", fontSize: "0.75rem" }}>
                    Última actividad: {fmtDate(driver.lastSeenAt)}
                  </IonNote>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}

        <IonItem lines="none" style={{ marginTop: "16px" }}>
          <IonLabel color="medium" style={{ fontSize: "0.8rem", whiteSpace: "normal" }}>
            La asignación de viajes se realiza desde el módulo Viajes.
          </IonLabel>
        </IonItem>
      </IonContent>
    </IonPage>
  );
}

export function AdminGuidesPage(): JSX.Element {
  const { session } = useAuth();
  const token = session?.accessToken ?? "";

  const [guides,        setGuides]        = useState<AdminUserData[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filterStatus,  setFilterStatus]  = useState<string>("all");
  const [filterVerified,setFilterVerified]= useState<string>("all");

  const loadGuides = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminService.listUsers(token, { role: "guide" });
      setGuides(data);
    } catch (_) {
      setGuides([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadGuides(); }, [loadGuides]);

  const filtered = guides.filter((g) => {
    if (filterStatus !== "all" && g.status !== filterStatus) return false;
    if (filterVerified === "verified"   && !g.isVerified) return false;
    if (filterVerified === "unverified" &&  g.isVerified) return false;
    return true;
  });

  const totalGuides = guides.length;
  const verified    = guides.filter((g) => g.isVerified).length;
  const pending     = guides.filter((g) => g.status === "pending").length;
  const active      = guides.filter((g) => g.status === "active").length;

  function fmtGuideDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Guías</IonTitle>
          <div slot="end" style={{ paddingRight: "8px" }}>
            <IonButton fill="clear" color="light" onClick={() => void loadGuides()} disabled={loading}>
              Actualizar
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await loadGuides(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: "12px 16px 4px" }}>
          <p style={{ color: "var(--ion-color-medium)", margin: 0, fontSize: "0.9rem" }}>
            Gestión operacional de guías locales y servicios turísticos.
          </p>
        </div>

        {/* Resumen superior */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "8px 16px" }}>
          {([
            { label: "Total",      value: totalGuides, color: "primary"  },
            { label: "Verificados",value: verified,    color: "success"  },
            { label: "Pendientes", value: pending,     color: "warning"  },
            { label: "Activos",    value: active,      color: "tertiary" },
          ] as { label: string; value: number; color: string }[]).map((stat) => (
            <IonCard key={stat.label} style={{ margin: 0, textAlign: "center" }}>
              <IonCardContent style={{ padding: "8px" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: `var(--ion-color-${stat.color})` }}>{stat.value}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>{stat.label}</div>
              </IonCardContent>
            </IonCard>
          ))}
        </div>

        {/* Filtros */}
        <IonCard style={{ margin: "0 16px 8px" }}>
          <IonCardContent style={{ padding: "8px 12px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <IonItem lines="none" style={{ flex: 1 }}>
                <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Estado</IonLabel>
                <IonSelect
                  interface="action-sheet"
                  value={filterStatus}
                  onIonChange={(e) => setFilterStatus(String(e.detail.value ?? "all"))}
                >
                  <IonSelectOption value="all">Todos</IonSelectOption>
                  <IonSelectOption value="active">Activos</IonSelectOption>
                  <IonSelectOption value="pending">Pendientes</IonSelectOption>
                  <IonSelectOption value="suspended">Suspendidos</IonSelectOption>
                </IonSelect>
              </IonItem>
              <IonItem lines="none" style={{ flex: 1 }}>
                <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Verificación</IonLabel>
                <IonSelect
                  interface="action-sheet"
                  value={filterVerified}
                  onIonChange={(e) => setFilterVerified(String(e.detail.value ?? "all"))}
                >
                  <IonSelectOption value="all">Todos</IonSelectOption>
                  <IonSelectOption value="verified">Verificados</IonSelectOption>
                  <IonSelectOption value="unverified">No verificados</IonSelectOption>
                </IonSelect>
              </IonItem>
            </div>
          </IonCardContent>
        </IonCard>

        {!loading && (
          <IonText color="medium">
            <p style={{ fontSize: "0.78rem", margin: "0 16px 8px" }}>
              {filtered.length} guía{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </p>
          </IonText>
        )}

        {/* Lista de guías */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        ) : filtered.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "0 16px" }}>
            {filtered.map((guide) => (
              <IonCard key={guide.id} style={{ margin: 0 }}>
                <IonCardContent style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <strong style={{ fontSize: "0.95rem" }}>{guide.name}</strong>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <IonBadge color={guide.status === "active" ? "success" : guide.status === "pending" ? "warning" : "danger"} style={{ fontSize: "0.68rem" }}>
                        {guide.status === "active" ? "Activo" : guide.status === "pending" ? "Pendiente" : "Suspendido"}
                      </IonBadge>
                      {guide.isVerified && <IonBadge color="primary" style={{ fontSize: "0.68rem" }}>Verificado</IonBadge>}
                    </div>
                  </div>
                  <IonNote style={{ display: "block", marginBottom: 4, fontSize: "0.8rem" }}>{guide.email}</IonNote>
                  <IonNote style={{ display: "block", marginBottom: 4, fontSize: "0.78rem" }}>
                    Especialidad: <em>por definir</em>
                  </IonNote>
                  <IonNote style={{ display: "block", fontSize: "0.78rem" }}>
                    Idiomas: <em>por registrar</em>
                  </IonNote>
                  <IonNote style={{ display: "block", fontSize: "0.72rem", marginTop: 6 }}>
                    Registrado: {fmtGuideDate(guide.createdAt)}
                  </IonNote>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        ) : (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <p style={{ color: "var(--ion-color-medium)", fontSize: "1rem", fontWeight: 500 }}>
              Aún no hay guías registrados.
            </p>
            <p style={{ color: "var(--ion-color-medium)", fontSize: "0.85rem" }}>
              Este módulo permitirá administrar guías locales, especialidades, idiomas y disponibilidad para servicios turísticos.
            </p>
          </div>
        )}

        {/* Próximas fases */}
        <IonCard style={{ margin: "16px" }}>
          <IonCardContent>
            <strong style={{ display: "block", marginBottom: 8 }}>Próximas fases del módulo</strong>
            {[
              "Perfiles de guía con especialidades",
              "Idiomas y certificaciones",
              "Zonas y rutas turísticas",
              "Disponibilidad operacional",
              "Asignación a servicios y tours",
            ].map((item) => (
              <IonNote key={item} style={{ display: "block", padding: "3px 0", fontSize: "0.85rem" }}>
                · {item}
              </IonNote>
            ))}
          </IonCardContent>
        </IonCard>

        <IonItem lines="none">
          <IonLabel color="medium" style={{ fontSize: "0.8rem", whiteSpace: "normal" }}>
            La asignación de guías a servicios se realizará desde el módulo Servicios Turísticos.
          </IonLabel>
        </IonItem>
      </IonContent>
    </IonPage>
  );
}

export function AdminRentalsPage(): JSX.Element {
  const { session } = useAuth();
  const token = session?.accessToken ?? "";

  const [operators,      setOperators]      = useState<AdminUserData[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [filterStatus,   setFilterStatus]   = useState<string>("all");
  const [filterVerified, setFilterVerified] = useState<string>("all");

  const loadOperators = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminService.listUsers(token, { role: "rental_operator" });
      setOperators(data);
    } catch (_) {
      setOperators([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadOperators(); }, [loadOperators]);

  const filtered = operators.filter((o) => {
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (filterVerified === "verified"   && !o.isVerified) return false;
    if (filterVerified === "unverified" &&  o.isVerified) return false;
    return true;
  });

  const totalOperators = operators.length;
  const verified       = operators.filter((o) => o.isVerified).length;
  const pending        = operators.filter((o) => o.status === "pending").length;
  const active         = operators.filter((o) => o.status === "active").length;

  function fmtDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Rent a Car</IonTitle>
          <div slot="end" style={{ paddingRight: "8px" }}>
            <IonButton fill="clear" color="light" onClick={() => void loadOperators()} disabled={loading}>
              Actualizar
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await loadOperators(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: "12px 16px 4px" }}>
          <p style={{ color: "var(--ion-color-medium)", margin: 0, fontSize: "0.9rem" }}>
            Gestión operacional de operadores de arriendo de vehículos.
          </p>
        </div>

        {/* Resumen superior */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "8px 16px" }}>
          {([
            { label: "Total",      value: totalOperators, color: "primary"  },
            { label: "Activos",    value: active,         color: "tertiary" },
            { label: "Pendientes", value: pending,        color: "warning"  },
            { label: "Verificados",value: verified,       color: "success"  },
          ] as { label: string; value: number; color: string }[]).map((stat) => (
            <IonCard key={stat.label} style={{ margin: 0, textAlign: "center" }}>
              <IonCardContent style={{ padding: "8px" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: `var(--ion-color-${stat.color})` }}>{stat.value}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>{stat.label}</div>
              </IonCardContent>
            </IonCard>
          ))}
        </div>

        {/* Filtros */}
        <IonCard style={{ margin: "0 16px 8px" }}>
          <IonCardContent style={{ padding: "8px 12px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <IonItem lines="none" style={{ flex: 1 }}>
                <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Estado</IonLabel>
                <IonSelect
                  interface="action-sheet"
                  value={filterStatus}
                  onIonChange={(e) => setFilterStatus(String(e.detail.value ?? "all"))}
                >
                  <IonSelectOption value="all">Todos</IonSelectOption>
                  <IonSelectOption value="active">Activos</IonSelectOption>
                  <IonSelectOption value="pending">Pendientes</IonSelectOption>
                  <IonSelectOption value="suspended">Suspendidos</IonSelectOption>
                </IonSelect>
              </IonItem>
              <IonItem lines="none" style={{ flex: 1 }}>
                <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Verificación</IonLabel>
                <IonSelect
                  interface="action-sheet"
                  value={filterVerified}
                  onIonChange={(e) => setFilterVerified(String(e.detail.value ?? "all"))}
                >
                  <IonSelectOption value="all">Todos</IonSelectOption>
                  <IonSelectOption value="verified">Verificados</IonSelectOption>
                  <IonSelectOption value="unverified">No verificados</IonSelectOption>
                </IonSelect>
              </IonItem>
            </div>
          </IonCardContent>
        </IonCard>

        {!loading && (
          <IonText color="medium">
            <p style={{ fontSize: "0.78rem", margin: "0 16px 8px" }}>
              {filtered.length} operador{filtered.length !== 1 ? "es" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </p>
          </IonText>
        )}

        {/* Lista de operadores */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        ) : filtered.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "0 16px" }}>
            {filtered.map((op) => (
              <IonCard key={op.id} style={{ margin: 0 }}>
                <IonCardContent style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <strong style={{ fontSize: "0.95rem" }}>{op.name}</strong>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <IonBadge color={op.status === "active" ? "success" : op.status === "pending" ? "warning" : "danger"} style={{ fontSize: "0.68rem" }}>
                        {op.status === "active" ? "Activo" : op.status === "pending" ? "Pendiente" : "Suspendido"}
                      </IonBadge>
                      {op.isVerified && <IonBadge color="primary" style={{ fontSize: "0.68rem" }}>Verificado</IonBadge>}
                    </div>
                  </div>
                  <IonNote style={{ display: "block", marginBottom: 4, fontSize: "0.8rem" }}>{op.email}</IonNote>
                  <IonNote style={{ display: "block", marginBottom: 4, fontSize: "0.78rem" }}>
                    Tipo de servicio: <em>Arriendo de vehículos</em>
                  </IonNote>
                  <IonNote style={{ display: "block", fontSize: "0.78rem" }}>
                    Estado operativo: <em>Operación por configurar</em>
                  </IonNote>
                  <IonNote style={{ display: "block", fontSize: "0.72rem", marginTop: 6 }}>
                    Registrado: {fmtDate(op.createdAt)}
                  </IonNote>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        ) : (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <p style={{ color: "var(--ion-color-medium)", fontSize: "1rem", fontWeight: 500 }}>
              Aún no hay operadores de arriendo registrados.
            </p>
            <p style={{ color: "var(--ion-color-medium)", fontSize: "0.85rem" }}>
              Este módulo permitirá administrar operadores, flota disponible, documentación y servicios de arriendo.
            </p>
          </div>
        )}

        {/* Próximas fases */}
        <IonCard style={{ margin: "16px" }}>
          <IonCardContent>
            <strong style={{ display: "block", marginBottom: 8 }}>Próximas fases del módulo</strong>
            {[
              "Perfiles de operador de arriendo",
              "Flota de vehículos por operador",
              "Disponibilidad de vehículos",
              "Documentación comercial y habilitante",
              "Asignación de reservas de arriendo",
              "Tarifas por categoría de vehículo",
            ].map((item) => (
              <IonNote key={item} style={{ display: "block", padding: "3px 0", fontSize: "0.85rem" }}>
                · {item}
              </IonNote>
            ))}
          </IonCardContent>
        </IonCard>

        <IonItem lines="none">
          <IonLabel color="medium" style={{ fontSize: "0.8rem", whiteSpace: "normal" }}>
            La gestión de flota y reservas de arriendo se implementará en el módulo de Arriendos.
          </IonLabel>
        </IonItem>
      </IonContent>
    </IonPage>
  );
}

const RIDE_STATUS_LABEL_ADMIN: Record<string, string> = {
  requested:       "Solicitado",
  accepted:        "Conductor asignado",
  driver_en_route: "Conductor en camino",
  driver_arrived:  "Conductor llegó",
  in_progress:     "En curso",
  completed:       "Completado",
  cancelled:       "Cancelado",
};

const RIDE_STATUS_COLOR_ADMIN: Record<string, string> = {
  requested:       "warning",
  accepted:        "primary",
  driver_en_route: "tertiary",
  driver_arrived:  "secondary",
  in_progress:     "success",
  completed:       "medium",
  cancelled:       "danger",
};

const CANCELABLE_STATUSES = new Set(["requested", "accepted", "driver_en_route", "driver_arrived"]);

export function AdminTripsPage(): JSX.Element {
  const { session } = useAuth();

  const [rides,         setRides]         = useState<AdminRideData[]>([]);
  const [drivers,       setDrivers]       = useState<ActiveDriverData[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState<string | null>(null);
  const [filterStatus,  setFilterStatus]  = useState("");

  // Assign state per-ride
  const [assigningId,   setAssigningId]   = useState<string | null>(null);
  const [assignDriverId,setAssignDriverId]= useState<Record<string, string>>({});
  const [assignError,   setAssignError]   = useState<string | null>(null);

  // Cancel state per-ride
  const [cancellingId,  setCancellingId]  = useState<string | null>(null);
  const [cancelAlertId, setCancelAlertId] = useState<string | null>(null);
  const [cancelError,   setCancelError]   = useState<string | null>(null);

  // Toast for DRIVER_NOT_AVAILABLE feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const params: { status?: string } = {};
      if (filterStatus) params.status = filterStatus;
      const [ridesData, driversData] = await Promise.all([
        adminService.listRides(session.accessToken, params),
        adminService.listActiveDrivers(session.accessToken),
      ]);
      setRides(ridesData);
      setDrivers(driversData);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, filterStatus]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function handleAssign(rideId: string) {
    if (!session?.accessToken) return;
    const driverUserId = assignDriverId[rideId];
    if (!driverUserId) {
      setAssignError("Selecciona un conductor antes de asignar.");
      return;
    }
    setAssigningId(rideId);
    setAssignError(null);
    try {
      const updated = await adminService.assignDriver(session.accessToken, rideId, driverUserId);
      setRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
      setAssignDriverId((prev) => {
        const next = { ...prev };
        delete next[rideId];
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al asignar conductor.";
      if (msg.includes("disponible") || msg.toLowerCase().includes("not available")) {
        setToastMsg("El conductor no está disponible en este momento. Selecciona otro conductor.");
      } else {
        setAssignError(msg);
      }
    } finally {
      setAssigningId(null);
    }
  }

  async function handleCancel(rideId: string, reason: string) {
    if (!session?.accessToken) return;
    setCancellingId(rideId);
    setCancelError(null);
    try {
      const updated = await adminService.adminCancelRide(session.accessToken, rideId, reason);
      setRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Error al cancelar viaje.");
    } finally {
      setCancellingId(null);
      setCancelAlertId(null);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Viajes</IonTitle>
          <div slot="end" style={{ paddingRight: "8px" }}>
            <IonButton fill="clear" color="light" onClick={() => void loadData()} disabled={loading}>
              Actualizar
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await loadData(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Filter */}
        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "10px 12px" }}>
            <IonItem lines="none">
              <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Estado</IonLabel>
              <IonSelect
                value={filterStatus}
                onIonChange={(e) => setFilterStatus(String(e.detail.value ?? ""))}
                placeholder="Todos"
                interface="popover"
              >
                <IonSelectOption value="">Todos</IonSelectOption>
                <IonSelectOption value="requested">Solicitado</IonSelectOption>
                <IonSelectOption value="accepted">Conductor asignado</IonSelectOption>
                <IonSelectOption value="driver_en_route">Conductor en camino</IonSelectOption>
                <IonSelectOption value="driver_arrived">Conductor llegó</IonSelectOption>
                <IonSelectOption value="in_progress">En curso</IonSelectOption>
                <IonSelectOption value="completed">Completado</IonSelectOption>
                <IonSelectOption value="cancelled">Cancelado</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonButton
              expand="block"
              size="small"
              fill="outline"
              color="danger"
              style={{ marginTop: "8px" }}
              onClick={() => void loadData()}
              disabled={loading}
            >
              {loading ? <IonSpinner name="dots" /> : "Aplicar filtro"}
            </IonButton>
          </IonCardContent>
        </IonCard>

        {!loading && !loadError && (
          <IonText color="medium">
            <p style={{ fontSize: "0.78rem", margin: "0 0 10px" }}>
              {rides.length} viaje{rides.length !== 1 ? "s" : ""} encontrado{rides.length !== 1 ? "s" : ""}
            </p>
          </IonText>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}
        {assignError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{assignError}</p></IonText>}
        {cancelError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{cancelError}</p></IonText>}

        {!loading && !loadError && rides.length === 0 && (
          <IonText color="medium"><p>No se encontraron viajes.</p></IonText>
        )}

        {!loading && rides.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {rides.map((ride) => {
              const statusColor = RIDE_STATUS_COLOR_ADMIN[ride.status] ?? "medium";
              const statusLabel = RIDE_STATUS_LABEL_ADMIN[ride.status] ?? ride.status;
              return (
                <IonCard key={ride.id} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "12px 14px" }}>

                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "2px" }}>
                          {ride.originText} → {ride.destinationText}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)", marginBottom: "4px" }}>
                          Pasajero: {ride.passengerName} ({ride.passengerEmail})
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          <IonBadge color={statusColor} style={{ fontSize: "0.68rem" }}>{statusLabel}</IonBadge>
                        </div>
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--ion-color-medium)", flexShrink: 0, textAlign: "right" }}>
                        {new Date(ride.requestedAt).toLocaleString("es-CL")}
                      </div>
                    </div>

                    {/* Details */}
                    {ride.notes && (
                      <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginBottom: "4px" }}>
                        Notas: {ride.notes}
                      </div>
                    )}
                    {ride.estimatedFareClp != null && (
                      <div style={{ fontSize: "0.78rem", fontWeight: 500, marginBottom: "4px" }}>
                        Tarifa est.: ${ride.estimatedFareClp.toLocaleString("es-CL")} CLP
                      </div>
                    )}
                    {ride.driverName && (
                      <div style={{ fontSize: "0.78rem", marginBottom: "4px" }}>
                        Conductor: <strong>{ride.driverName}</strong>
                      </div>
                    )}

                    {/* Dates */}
                    <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginBottom: "8px" }}>
                      {ride.acceptedAt  && <div>Asignado: {new Date(ride.acceptedAt).toLocaleString("es-CL")}</div>}
                      {ride.enRouteAt   && <div>En camino: {new Date(ride.enRouteAt).toLocaleString("es-CL")}</div>}
                      {ride.arrivedAt   && <div>Llegó: {new Date(ride.arrivedAt).toLocaleString("es-CL")}</div>}
                      {ride.startedAt   && <div>Iniciado: {new Date(ride.startedAt).toLocaleString("es-CL")}</div>}
                      {ride.completedAt && <div>Completado: {new Date(ride.completedAt).toLocaleString("es-CL")}</div>}
                      {ride.cancelledAt && <div>Cancelado: {new Date(ride.cancelledAt).toLocaleString("es-CL")}</div>}
                      {ride.cancellationReason && (
                        <div style={{ color: "var(--ion-color-danger)" }}>Motivo: {ride.cancellationReason}</div>
                      )}
                    </div>

                    {/* Assign driver — only for 'requested' */}
                    {ride.status === "requested" && (() => {
                      const availableDrivers = drivers.filter((d) => d.availability === "available");
                      const originZone = inferZoneFromText(ride.originText);
                      const sortedDrivers = [...availableDrivers].sort((a, b) => {
                        const aMatch = originZone && a.currentZone === originZone ? -1 : 0;
                        const bMatch = originZone && b.currentZone === originZone ? -1 : 0;
                        if (aMatch !== bMatch) return aMatch - bMatch;
                        return (a.name ?? "").localeCompare(b.name ?? "");
                      });
                      return (
                        <div style={{ borderTop: "1px solid var(--ion-color-light-shade)", paddingTop: "8px" }}>
                          {availableDrivers.length === 0 ? (
                            <IonItem lines="none" style={{ "--padding-start": "0", "--inner-padding-end": "0" }}>
                              <IonLabel style={{ fontSize: "0.75rem" }} color="warning">
                                No hay conductores disponibles en este momento.
                              </IonLabel>
                            </IonItem>
                          ) : (
                            <>
                              <IonItem lines="none" style={{ "--padding-start": "0", "--inner-padding-end": "0", "--min-height": "44px" }}>
                                <IonLabel style={{ fontSize: "0.75rem", flexShrink: 0, marginRight: "8px" }}>Conductor:</IonLabel>
                                <IonSelect
                                  value={assignDriverId[ride.id] ?? ""}
                                  interface="action-sheet"
                                  placeholder="Seleccionar conductor..."
                                  style={{ fontSize: "0.78rem" }}
                                  onIonChange={(e) => {
                                    const val = String(e.detail.value ?? "");
                                    setAssignDriverId((prev) => ({ ...prev, [ride.id]: val }));
                                  }}
                                >
                                  {sortedDrivers.map((d) => {
                                    const isSuggested = originZone && d.currentZone === originZone;
                                    return (
                                      <IonSelectOption key={d.id} value={d.id}>
                                        {d.name} · {getZoneLabel(d.currentZone as any)} {isSuggested ? "★" : ""}
                                      </IonSelectOption>
                                    );
                                  })}
                                </IonSelect>
                              </IonItem>
                              {originZone && availableDrivers.some(d => d.currentZone === originZone) && (
                                <IonNote color="success" style={{ fontSize: "0.8rem", paddingLeft: "16px", display: "block" }}>
                                  ★ Sugerido por zona: {getZoneLabel(originZone)}
                                </IonNote>
                              )}
                              <IonButton
                                expand="block"
                                size="small"
                                color="primary"
                                disabled={assigningId === ride.id || !assignDriverId[ride.id]}
                                onClick={() => void handleAssign(ride.id)}
                                style={{ marginTop: "6px" }}
                              >
                                {assigningId === ride.id ? <IonSpinner name="dots" /> : "Asignar conductor"}
                              </IonButton>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* Cancel — for cancelable statuses */}
                    {CANCELABLE_STATUSES.has(ride.status) && (
                      <div style={{ marginTop: "6px" }}>
                        <IonButton
                          expand="block"
                          size="small"
                          fill="outline"
                          color="danger"
                          disabled={cancellingId === ride.id}
                          onClick={() => { setCancelAlertId(ride.id); setCancelError(null); }}
                        >
                          {cancellingId === ride.id ? <IonSpinner name="dots" /> : "Cancelar viaje"}
                        </IonButton>
                      </div>
                    )}

                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        {/* Driver not available toast */}
        <IonToast
          isOpen={toastMsg !== null}
          message={toastMsg ?? ""}
          duration={3500}
          color="warning"
          onDidDismiss={() => setToastMsg(null)}
        />

        {/* Cancel alert */}
        <IonAlert
          isOpen={cancelAlertId !== null}
          header="Cancelar viaje"
          message="Ingresa el motivo de cancelación (obligatorio, mín. 3 caracteres)."
          inputs={[
            {
              name: "reason",
              type: "textarea",
              placeholder: "Motivo de cancelación...",
            },
          ]}
          buttons={[
            {
              text: "Volver",
              role: "cancel",
              handler: () => setCancelAlertId(null),
            },
            {
              text: "Cancelar viaje",
              handler: (data: { reason?: string }) => {
                const reason = (data.reason ?? "").trim();
                if (cancelAlertId && reason.length >= 3) {
                  void handleCancel(cancelAlertId, reason);
                } else {
                  setCancelError("El motivo debe tener al menos 3 caracteres.");
                }
              },
            },
          ]}
          onDidDismiss={() => { if (cancellingId === null) setCancelAlertId(null); }}
        />

      </IonContent>
    </IonPage>
  );
}

const OFFLINE_STATUS_LABEL: Record<string, string> = {
  pending_sync: "Pendiente",
  synced:       "Sincronizado",
  cancelled:    "Cancelado",
};
const OFFLINE_STATUS_COLOR: Record<string, string> = {
  pending_sync: "warning",
  synced:       "success",
  cancelled:    "medium",
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

export function AdminOfflineBookingsPage(): JSX.Element {
  const { session } = useAuth();
  const token = session?.accessToken ?? "";

  const [bookings,     setBookings]     = useState<OfflineBooking[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [actionError,  setActionError]  = useState<string | null>(null);
  const [toast,        setToast]        = useState<string | null>(null);

  // Create form state
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState({ passengerName: "", passengerPhone: "", originText: "", destinationText: "", notes: "" });
  const [submitting,   setSubmitting]   = useState(false);
  const [formError,    setFormError]    = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const status = filterStatus !== "all" ? filterStatus : undefined;
      const data = await offlineService.listOfflineBookings(token, status);
      setBookings(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar reservas offline.");
    } finally {
      setLoading(false);
    }
  }, [token, filterStatus]);

  useEffect(() => { void loadBookings(); }, [loadBookings]);

  async function handleCreate() {
    if (!form.passengerName.trim() || !form.passengerPhone.trim() || !form.originText.trim() || !form.destinationText.trim()) {
      setFormError("Nombre, teléfono, origen y destino son obligatorios.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await offlineService.createOfflineBooking(token, {
        passengerName:   form.passengerName.trim(),
        passengerPhone:  form.passengerPhone.trim(),
        originText:      form.originText.trim(),
        destinationText: form.destinationText.trim(),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      setToast("Reserva offline creada.");
      setShowForm(false);
      setForm({ passengerName: "", passengerPhone: "", originText: "", destinationText: "", notes: "" });
      await loadBookings();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al crear reserva.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    setActionError(null);
    try {
      await offlineService.cancelOfflineBooking(token, id);
      setToast("Reserva cancelada.");
      await loadBookings();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error al cancelar.");
    }
  }

  const filtered = bookings.filter((b) => filterStatus === "all" || b.status === filterStatus);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="warning">
          <IonTitle style={{ color: "#000" }}>Viajes Offline</IonTitle>
          <div slot="end" style={{ paddingRight: "8px", display: "flex", gap: "4px" }}>
            <IonButton fill="clear" style={{ color: "#000" }} onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cerrar" : "+ Nueva"}
            </IonButton>
            <IonButton fill="clear" style={{ color: "#000" }} onClick={() => void loadBookings()} disabled={loading}>
              Actualizar
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await loadBookings(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Info banner */}
        <IonCard style={{ margin: "0 0 12px", background: "var(--ion-color-warning-tint)" }}>
          <IonCardContent style={{ padding: "10px 14px" }}>
            <IonText>
              <p style={{ fontSize: "0.82rem", margin: 0, color: "#6b4700" }}>
                Registra viajes coordinados por teléfono o WhatsApp cuando el pasajero no tiene conectividad.
                Sincroniza cada reserva con un viaje real cuando la conectividad se restablezca.
              </p>
            </IonText>
          </IonCardContent>
        </IonCard>

        {/* Create form */}
        {showForm && (
          <IonCard style={{ margin: "0 0 12px" }}>
            <IonCardContent style={{ padding: "12px 14px" }}>
              <strong style={{ fontSize: "0.95rem", display: "block", marginBottom: 10 }}>Nueva Reserva Offline</strong>
              <IonItem lines="full">
                <IonLabel position="stacked">Nombre del pasajero *</IonLabel>
                <IonInput value={form.passengerName} onIonInput={(e) => setForm((f) => ({ ...f, passengerName: String(e.detail.value ?? "") }))} placeholder="Ej: María González" />
              </IonItem>
              <IonItem lines="full">
                <IonLabel position="stacked">Teléfono *</IonLabel>
                <IonInput value={form.passengerPhone} onIonInput={(e) => setForm((f) => ({ ...f, passengerPhone: String(e.detail.value ?? "") }))} placeholder="+56 9 xxxx xxxx" inputmode="tel" />
              </IonItem>
              <IonItem lines="full">
                <IonLabel position="stacked">Origen *</IonLabel>
                <IonInput value={form.originText} onIonInput={(e) => setForm((f) => ({ ...f, originText: String(e.detail.value ?? "") }))} placeholder="Punto de recogida" />
              </IonItem>
              <IonItem lines="full">
                <IonLabel position="stacked">Destino *</IonLabel>
                <IonInput value={form.destinationText} onIonInput={(e) => setForm((f) => ({ ...f, destinationText: String(e.detail.value ?? "") }))} placeholder="Destino final" />
              </IonItem>
              <IonItem lines="none">
                <IonLabel position="stacked">Notas</IonLabel>
                <IonInput value={form.notes} onIonInput={(e) => setForm((f) => ({ ...f, notes: String(e.detail.value ?? "") }))} placeholder="Opcional" />
              </IonItem>
              {formError && <IonText color="danger"><p style={{ fontSize: "0.8rem", margin: "6px 0 0" }}>{formError}</p></IonText>}
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <IonButton expand="block" style={{ flex: 1 }} onClick={() => void handleCreate()} disabled={submitting}>
                  {submitting ? <IonSpinner name="crescent" /> : "Crear reserva"}
                </IonButton>
                <IonButton expand="block" fill="outline" color="medium" style={{ flex: 1 }} onClick={() => { setShowForm(false); setFormError(null); }}>
                  Cancelar
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        )}

        {/* Filter */}
        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "8px 12px" }}>
            <IonItem lines="none">
              <IonLabel>Estado</IonLabel>
              <IonSelect interface="action-sheet" value={filterStatus} onIonChange={(e) => setFilterStatus(String(e.detail.value ?? "all"))}>
                <IonSelectOption value="all">Todos</IonSelectOption>
                <IonSelectOption value="pending_sync">Pendientes</IonSelectOption>
                <IonSelectOption value="synced">Sincronizados</IonSelectOption>
                <IonSelectOption value="cancelled">Cancelados</IonSelectOption>
              </IonSelect>
            </IonItem>
          </IonCardContent>
        </IonCard>

        {actionError && <IonText color="danger"><p style={{ fontSize: "0.82rem" }}>{actionError}</p></IonText>}

        {!loading && !loadError && (
          <IonText color="medium">
            <p style={{ fontSize: "0.78rem", margin: "0 0 10px" }}>
              {filtered.length} reserva{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
            </p>
          </IonText>
        )}

        {loading && <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}><IonSpinner name="crescent" /></div>}
        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {filtered.length === 0 && !loading && !loadError && (
          <IonItem lines="none">
            <IonLabel color="medium" className="ion-text-center">
              No hay reservas offline {filterStatus !== "all" ? `con estado "${OFFLINE_STATUS_LABEL[filterStatus] ?? filterStatus}"` : ""}.
            </IonLabel>
          </IonItem>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filtered.map((b) => (
              <IonCard key={b.id} style={{ margin: 0 }}>
                <IonCardContent style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                      <strong style={{ fontSize: "1rem" }}>{b.passengerName}</strong>
                      <IonNote style={{ display: "block", fontSize: "0.8rem" }}>{b.passengerPhone}</IonNote>
                    </div>
                    <IonBadge color={OFFLINE_STATUS_COLOR[b.status] ?? "medium"}>
                      {OFFLINE_STATUS_LABEL[b.status] ?? b.status}
                    </IonBadge>
                  </div>

                  <IonNote style={{ display: "block", marginBottom: 2 }}>
                    <strong>Origen:</strong> {b.originText}
                  </IonNote>
                  <IonNote style={{ display: "block", marginBottom: 2 }}>
                    <strong>Destino:</strong> {b.destinationText}
                  </IonNote>
                  {b.notes && <IonNote style={{ display: "block", marginBottom: 2 }}>Notas: {b.notes}</IonNote>}
                  {b.syncedToRideId && (
                    <IonChip color="success" style={{ marginTop: 4, height: "20px", fontSize: "0.72rem" }}>
                      Viaje: {b.syncedToRideId.slice(0, 8)}...
                    </IonChip>
                  )}
                  <IonNote style={{ display: "block", fontSize: "0.73rem", marginTop: 6 }}>
                    Creado: {fmtDateTime(b.createdAt)}
                  </IonNote>

                  {b.status === "pending_sync" && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                      <IonButton
                        size="small"
                        fill="outline"
                        color="danger"
                        onClick={() => void handleCancel(b.id)}
                      >
                        Cancelar
                      </IonButton>
                      <IonNote style={{ alignSelf: "center", fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>
                        Para sincronizar: crea el viaje en "Viajes" y usa el ID generado.
                      </IonNote>
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}

        <IonToast
          isOpen={toast !== null}
          message={toast ?? ""}
          duration={2500}
          onDidDismiss={() => setToast(null)}
          color="success"
        />
      </IonContent>
    </IonPage>
  );
}

export function AdminPaymentsPage(): JSX.Element {
  const m = meta("/admin/payments");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="danger"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="admin" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function AdminSettingsPage(): JSX.Element {
  const m = meta("/admin/settings");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="danger"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="admin" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

const DOC_STATUS_COLOR: Record<string, string> = {
  pending:  "warning",
  uploaded: "primary",
  approved: "success",
  rejected: "danger",
};

const DOC_STATUS_LABEL: Record<string, string> = {
  pending:  "Pendiente",
  uploaded: "Subido",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  identity_document:    "Cédula de identidad",
  driver_license:       "Licencia de conducir",
  vehicle_registration: "Registro de vehículo",
  vehicle_insurance:    "Seguro del vehículo",
  guide_certification:  "Certificación de guía",
  business_registration:"Registro de empresa",
  vehicle_ownership:    "Propiedad del vehículo",
};

export function AdminDocumentsPage(): JSX.Element {
  const { session } = useAuth();

  const [docs,       setDocs]      = useState<AdminDocumentData[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [loadError,  setLoadError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterType,   setFilterType]   = useState("");

  const [actionId,     setActionId]     = useState<string | null>(null);
  const [actionType,   setActionType]   = useState<"approve" | "reject" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actioning,    setActioning]    = useState(false);
  const [actionError,  setActionError]  = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const params: { status?: string; documentType?: string } = {};
      if (filterStatus) params.status       = filterStatus;
      if (filterType)   params.documentType = filterType;
      const data = await adminService.listDocuments(session.accessToken, params);
      setDocs(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar documentos.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, filterStatus, filterType]);

  useEffect(() => { void loadDocs(); }, [loadDocs]);

  async function handleApprove(docId: string) {
    if (!session?.accessToken) return;
    setActioning(true);
    setActionError(null);
    try {
      const updated = await adminService.reviewDocument(session.accessToken, docId, "approved");
      setDocs((prev) => prev.map((d) => (d.id === docId ? updated : d)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error al aprobar.");
    } finally {
      setActioning(false);
      setActionId(null);
      setActionType(null);
    }
  }

  async function handleReject() {
    if (!session?.accessToken || !actionId) return;
    if (!rejectReason.trim()) {
      setActionError("El motivo de rechazo es obligatorio.");
      return;
    }
    setActioning(true);
    setActionError(null);
    try {
      const updated = await adminService.reviewDocument(session.accessToken, actionId, "rejected", rejectReason.trim());
      setDocs((prev) => prev.map((d) => (d.id === actionId ? updated : d)));
      setRejectReason("");
      setActionId(null);
      setActionType(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error al rechazar.");
    } finally {
      setActioning(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Documentos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">

        {/* Filters */}
        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "10px 12px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <IonItem lines="none" style={{ flex: 1 }}>
                <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Estado</IonLabel>
                <IonSelect
                  value={filterStatus}
                  onIonChange={(e) => setFilterStatus(String(e.detail.value ?? ""))}
                  placeholder="Todos"
                  interface="popover"
                >
                  <IonSelectOption value="">Todos</IonSelectOption>
                  <IonSelectOption value="pending">Pendiente</IonSelectOption>
                  <IonSelectOption value="uploaded">Subido</IonSelectOption>
                  <IonSelectOption value="approved">Aprobado</IonSelectOption>
                  <IonSelectOption value="rejected">Rechazado</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem lines="none" style={{ flex: 1 }}>
                <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>Tipo</IonLabel>
                <IonSelect
                  value={filterType}
                  onIonChange={(e) => setFilterType(String(e.detail.value ?? ""))}
                  placeholder="Todos"
                  interface="popover"
                >
                  <IonSelectOption value="">Todos</IonSelectOption>
                  <IonSelectOption value="identity_document">Cédula</IonSelectOption>
                  <IonSelectOption value="driver_license">Licencia</IonSelectOption>
                  <IonSelectOption value="vehicle_registration">Reg. Vehículo</IonSelectOption>
                  <IonSelectOption value="vehicle_insurance">Seguro</IonSelectOption>
                  <IonSelectOption value="guide_certification">Cert. Guía</IonSelectOption>
                  <IonSelectOption value="business_registration">Reg. Empresa</IonSelectOption>
                  <IonSelectOption value="vehicle_ownership">Prop. Vehículo</IonSelectOption>
                </IonSelect>
              </IonItem>
            </div>

            <IonButton
              expand="block"
              size="small"
              fill="outline"
              color="danger"
              style={{ marginTop: "8px" }}
              onClick={() => void loadDocs()}
              disabled={loading}
            >
              {loading ? <IonSpinner name="dots" /> : "Aplicar filtros"}
            </IonButton>
          </IonCardContent>
        </IonCard>

        {!loading && !loadError && (
          <IonText color="medium">
            <p style={{ fontSize: "0.78rem", margin: "0 0 10px" }}>
              {docs.length} documento{docs.length !== 1 ? "s" : ""} encontrado{docs.length !== 1 ? "s" : ""}
            </p>
          </IonText>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && !loadError && docs.length === 0 && (
          <IonText color="medium"><p>No se encontraron documentos.</p></IonText>
        )}

        {!loading && docs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {docs.map((doc) => {
              const statusColor = DOC_STATUS_COLOR[doc.status] ?? "medium";
              const statusLabel = DOC_STATUS_LABEL[doc.status] ?? doc.status;
              const typeLabel   = DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType;
              return (
                <IonCard key={doc.id} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.userName}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.userEmail}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "4px" }}>
                          <IonBadge color="primary"    style={{ fontSize: "0.68rem" }}>{doc.userRole}</IonBadge>
                          <IonBadge color={statusColor} style={{ fontSize: "0.68rem" }}>{statusLabel}</IonBadge>
                          <IonBadge color="secondary"  style={{ fontSize: "0.68rem" }}>{typeLabel}</IonBadge>
                        </div>
                        {doc.fileUrl && (
                          <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", wordBreak: "break-all" }}>
                            {doc.fileUrl}
                          </div>
                        )}
                        {doc.rejectionReason && (
                          <div style={{ fontSize: "0.72rem", color: "var(--ion-color-danger)", marginTop: "4px" }}>
                            Motivo: {doc.rejectionReason}
                          </div>
                        )}
                        {doc.reviewedAt && (
                          <div style={{ fontSize: "0.68rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                            Revisado: {new Date(doc.reviewedAt).toLocaleDateString("es-CL")}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--ion-color-medium)", flexShrink: 0, textAlign: "right" }}>
                        {new Date(doc.createdAt).toLocaleDateString("es-CL")}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ marginTop: "10px", borderTop: "1px solid var(--ion-color-light-shade)", paddingTop: "8px", display: "flex", gap: "8px" }}>
                      <IonButton
                        size="small"
                        color="success"
                        fill="outline"
                        disabled={actioning || doc.status === "approved"}
                        onClick={() => void handleApprove(doc.id)}
                        style={{ flex: 1 }}
                      >
                        Aprobar
                      </IonButton>
                      <IonButton
                        size="small"
                        color="danger"
                        fill="outline"
                        disabled={actioning || doc.status === "rejected"}
                        onClick={() => { setActionId(doc.id); setActionType("reject"); setRejectReason(""); setActionError(null); }}
                        style={{ flex: 1 }}
                      >
                        Rechazar
                      </IonButton>
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        {actionError && (
          <IonText color="danger">
            <p style={{ fontSize: "0.85rem", marginTop: "10px" }}>{actionError}</p>
          </IonText>
        )}

        {/* Reject modal */}
        <IonAlert
          isOpen={actionType === "reject" && actionId !== null}
          header="Rechazar documento"
          message="Ingresa el motivo de rechazo (obligatorio)."
          inputs={[
            {
              name: "reason",
              type: "textarea",
              placeholder: "Motivo del rechazo...",
              value: rejectReason,
              handler: (e: { value?: string }) => setRejectReason(e.value ?? ""),
            },
          ]}
          buttons={[
            {
              text: "Cancelar",
              role: "cancel",
              handler: () => { setActionId(null); setActionType(null); setRejectReason(""); },
            },
            {
              text: "Rechazar",
              handler: () => { void handleReject(); },
            },
          ]}
          onDidDismiss={() => { if (!actioning) { setActionId(null); setActionType(null); } }}
        />
      </IonContent>
    </IonPage>
  );
}
