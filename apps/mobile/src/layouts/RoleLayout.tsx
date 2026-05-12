import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from "@ionic/react";
import type { ReactNode } from "react";
import type { TabItem } from "../navigation/routeConfig";

interface RoleLayoutProps {
  tabs: TabItem[];
  children: ReactNode;
}

export function RoleLayout({ tabs, children }: RoleLayoutProps): JSX.Element {
  return (
    <IonTabs>
      <IonRouterOutlet>{children}</IonRouterOutlet>
      <IonTabBar slot="bottom">
        {tabs.map((tab) => (
          <IonTabButton key={tab.path} tab={tab.label} href={tab.path}>
            <IonIcon icon={tab.icon} />
            <IonLabel>{tab.label}</IonLabel>
          </IonTabButton>
        ))}
      </IonTabBar>
    </IonTabs>
  );
}
