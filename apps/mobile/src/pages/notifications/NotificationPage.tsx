import React, { useState } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
  IonLabel, IonBadge, IonRefresher, IonRefresherContent, IonSegment,
  IonSegmentButton, IonButton, IonIcon, IonNote,
} from "@ionic/react";
import { useIonViewWillEnter } from "@ionic/react";
import { notificationsOutline, carOutline, calendarOutline, documentOutline, cashOutline } from "ionicons/icons";
import { notificationsService, type NotificationData } from "../../features/notifications/notifications.service.js";
import { useAuth } from "../../features/auth/index.js";

type Filter = "all" | "unread";

export function NotificationPage(): React.ReactElement {
  const { session } = useAuth();
  const [items, setItems] = useState<NotificationData[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const data = await notificationsService.getMyNotifications(session.accessToken);
      setItems(data.items);
      setUnread(data.unreadCount);
    } catch { /**/ } finally { setLoading(false); }
  };

  useIonViewWillEnter(() => { void load(); });

  const filtered = filter === "unread" ? items.filter((n) => !n.read) : items;

  const iconForType = (type: string) => {
    if (type.startsWith("ride")) return carOutline;
    if (type.startsWith("rental")) return cashOutline;
    if (type.startsWith("service")) return calendarOutline;
    if (type.startsWith("document")) return documentOutline;
    return notificationsOutline;
  };

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `Hace ${mins} min`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `Hace ${h}h`;
    return `Hace ${Math.floor(h / 24)}d`;
  }

  const handleMarkAllRead = async () => {
    if (!session?.accessToken) return;
    await notificationsService.markAllRead(session.accessToken).catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            Notificaciones {unread > 0 && <IonBadge color="danger">{unread}</IonBadge>}
          </IonTitle>
          {unread > 0 && (
            <IonButton slot="end" fill="clear" size="small" onClick={() => { void handleMarkAllRead(); }}>
              Todo leído
            </IonButton>
          )}
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={filter} onIonChange={(e) => setFilter((e.detail.value as Filter) ?? "all")}>
            <IonSegmentButton value="all"><IonLabel>Todas</IonLabel></IonSegmentButton>
            <IonSegmentButton value="unread"><IonLabel>No leídas {unread > 0 && `(${unread})`}</IonLabel></IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await load(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>

        {filtered.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <IonIcon icon={notificationsOutline} style={{ fontSize: "3rem", color: "var(--ion-color-medium)" }} />
            <p><IonNote>No hay notificaciones{filter === "unread" ? " no leídas" : ""}</IonNote></p>
          </div>
        )}

        <IonList>
          {filtered.map((n) => (
            <IonItem
              key={n.id}
              button={!n.read}
              onClick={() => {
                if (!n.read && session?.accessToken) {
                  notificationsService.markRead(session.accessToken, n.id).catch(() => {});
                  setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
                  setUnread((prev) => Math.max(0, prev - 1));
                }
              }}
              style={{ opacity: n.read ? 0.7 : 1 }}
            >
              <IonIcon icon={iconForType(n.type)} slot="start" color={n.read ? "medium" : "primary"} />
              <IonLabel>
                <h3>{n.title}</h3>
                {n.message && <p>{n.message}</p>}
                <IonNote>{timeAgo(n.createdAt)}</IonNote>
              </IonLabel>
              {!n.read && <IonBadge color="primary" slot="end">•</IonBadge>}
              {n.waMeUrl && (
                <IonButton
                  fill="clear"
                  size="small"
                  slot="end"
                  href={n.waMeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  WA
                </IonButton>
              )}
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
}
