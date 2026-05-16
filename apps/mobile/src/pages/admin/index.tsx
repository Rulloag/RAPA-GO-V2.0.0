import {
  IonAlert,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useState, useCallback } from "react";
import {
  cardOutline,
  carOutline,
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

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

const PENDING = "Módulo preparado, implementación funcional pendiente.";

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
            subtitle={PENDING}
            route={ROUTES.ADMIN.USERS}
            color="danger"
          />
          <ActionCard
            icon={carOutline}
            title="Conductores"
            subtitle={PENDING}
            route={ROUTES.ADMIN.DRIVERS}
            color="danger"
          />
          <ActionCard
            icon={compassOutline}
            title="Guías"
            subtitle={PENDING}
            route={ROUTES.ADMIN.GUIDES}
            color="danger"
          />
          <ActionCard
            icon={keyOutline}
            title="Rent a Car"
            subtitle={PENDING}
            route={ROUTES.ADMIN.RENTALS}
            color="danger"
          />
          <ActionCard
            icon={personOutline}
            title="Viajes"
            subtitle={PENDING}
            route={ROUTES.ADMIN.TRIPS}
            color="danger"
          />
          <ActionCard
            icon={cardOutline}
            title="Pagos"
            subtitle={PENDING}
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
            icon={settingsOutline}
            title="Configuración"
            subtitle={PENDING}
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

export function AdminDriversPage(): JSX.Element {
  const m = meta("/admin/drivers");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="danger"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="admin" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function AdminGuidesPage(): JSX.Element {
  const m = meta("/admin/guides");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="danger"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="admin" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function AdminRentalsPage(): JSX.Element {
  const m = meta("/admin/rentals");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="danger"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="admin" plannedFeatures={m.plannedFeatures} /></IonContent>
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
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Error al asignar conductor.");
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
                    {ride.status === "requested" && (
                      <div style={{ borderTop: "1px solid var(--ion-color-light-shade)", paddingTop: "8px" }}>
                        <IonItem lines="none" style={{ "--padding-start": "0", "--inner-padding-end": "0", "--min-height": "36px" }}>
                          <IonLabel style={{ fontSize: "0.75rem", flexShrink: 0, marginRight: "8px" }}>Conductor:</IonLabel>
                          <IonSelect
                            value={assignDriverId[ride.id] ?? ""}
                            interface="popover"
                            placeholder="Seleccionar..."
                            style={{ fontSize: "0.78rem" }}
                            onIonChange={(e) => {
                              const val = String(e.detail.value ?? "");
                              setAssignDriverId((prev) => ({ ...prev, [ride.id]: val }));
                            }}
                          >
                            {drivers.map((d) => (
                              <IonSelectOption key={d.id} value={d.id}>{d.name}</IonSelectOption>
                            ))}
                          </IonSelect>
                        </IonItem>
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
                      </div>
                    )}

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
