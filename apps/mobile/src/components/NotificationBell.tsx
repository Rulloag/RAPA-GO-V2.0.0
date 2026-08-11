import React, { useEffect, useState } from "react";
import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonList, IonNote, IonPopover } from "@ionic/react";
import { notificationsOutline } from "ionicons/icons";
import { notificationsService, type NotificationData } from "../features/notifications/notifications.service.js";
import { useAuth } from "../features/auth/index.js";
import { useHistory } from "react-router-dom";
import { ROUTES } from "../navigation/routes.js";

export function NotificationBell(): React.ReactElement {
  const { session }        = useAuth();
  const history            = useHistory();
  const [unread, setUnread] = useState(0);
  const [items,  setItems]  = useState<NotificationData[]>([]);
  const [popoverOpen,  setPopoverOpen]  = useState(false);
  const [popoverEvent, setPopoverEvent] = useState<Event | undefined>(undefined);

  useEffect(() => {
    if (!session?.accessToken) return;
    const load = () => notificationsService.getMyNotifications(session.accessToken!)
      .then((data) => {
        setUnread(data.unreadCount);
        setItems(data.items.slice(0, 5));
      })
      .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [session?.accessToken]);

  const handleMarkAllRead = () => {
    if (!session?.accessToken) return;
    notificationsService.markAllRead(session.accessToken).then(() => {
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }).catch(() => {});
  };

  return (
    <>
      <IonButton
        fill="clear"
        onClick={(e) => {
          setPopoverEvent(e.nativeEvent);
          setPopoverOpen(true);
        }}
      >
        <IonIcon icon={notificationsOutline} />
        {unread > 0 && <IonBadge color="danger">{unread}</IonBadge>}
      </IonButton>
      <IonPopover
        isOpen={popoverOpen}
        {...(popoverEvent !== undefined ? { event: popoverEvent } : {})}
        onDidDismiss={() => setPopoverOpen(false)}
      >
        <IonList>
          {items.length === 0 && (
            <IonItem>
              <IonLabel><IonNote>No hay notificaciones</IonNote></IonLabel>
            </IonItem>
          )}
          {items.map((n) => (
            <IonItem
              key={n.id}
              button
              onClick={() => {
                if (session?.accessToken) {
                  notificationsService.markRead(session.accessToken, n.id).catch(() => {});
                  setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
                }
              }}
            >
              <IonLabel>
                <h3>{n.title}</h3>
                {n.message && <p>{n.message}</p>}
              </IonLabel>
              {!n.read && <IonBadge color="primary" slot="end">•</IonBadge>}
              {n.waMeUrl && (
                <IonButton fill="clear" size="small" slot="end" href={n.waMeUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  WhatsApp
                </IonButton>
              )}
            </IonItem>
          ))}
        </IonList>
        {unread > 0 && (
          <IonButton fill="clear" size="small" expand="full" onClick={handleMarkAllRead}>
            Marcar todo como leído
          </IonButton>
        )}
        <IonButton
          fill="clear"
          size="small"
          expand="full"
          onClick={() => {
            setPopoverOpen(false);
            history.push(ROUTES.NOTIFICATIONS);
          }}
        >
          Ver todas
        </IonButton>
      </IonPopover>
    </>
  );
}
