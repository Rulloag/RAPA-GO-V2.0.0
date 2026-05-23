import React, { useEffect, useState } from "react";
import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonList, IonNote, IonPopover } from "@ionic/react";
import { notificationsOutline } from "ionicons/icons";
import { notificationsService, type NotificationData } from "../features/notifications/notifications.service.js";
import { useAuth } from "../features/auth/index.js";

export function NotificationBell(): React.ReactElement {
  const { session }        = useAuth();
  const [unread, setUnread] = useState(0);
  const [items,  setItems]  = useState<NotificationData[]>([]);
  const [popoverOpen,  setPopoverOpen]  = useState(false);
  const [popoverEvent, setPopoverEvent] = useState<Event | undefined>(undefined);

  useEffect(() => {
    if (!session?.accessToken) return;
    notificationsService.getMyNotifications(session.accessToken)
      .then((data) => {
        setUnread(data.unreadCount);
        setItems(data.items.slice(0, 5));
      })
      .catch(() => {});
  }, [session?.accessToken]);

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
                }
              }}
            >
              <IonLabel>
                <h3>{n.title}</h3>
                {n.message && <p>{n.message}</p>}
              </IonLabel>
              {!n.read && <IonBadge color="primary" slot="end">•</IonBadge>}
            </IonItem>
          ))}
        </IonList>
      </IonPopover>
    </>
  );
}
