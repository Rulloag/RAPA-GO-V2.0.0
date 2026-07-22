import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from "@ionic/react";
import { Children, type ReactNode } from "react";
import type { TabItem } from "../navigation/routeConfig";

interface RoleLayoutProps {
  tabs: TabItem[];
  /** Direct Route/Redirect children only. Do not wrap these in Switch. */
  children: ReactNode;
}

export function RoleLayout({ tabs, children }: RoleLayoutProps): JSX.Element {
  // Ionic React Router assumes that every direct child of IonRouterOutlet is
  // a real React element and accesses child.props without checking for null.
  // Conditional routes such as {feature && <Route />} can therefore crash the
  // whole app when the feature is disabled. Children.toArray removes null,
  // undefined and false entries before Ionic receives them.
  const validRouteChildren = Children.toArray(children);

  return (
    <IonTabs className="rapago-role-tabs">
      <IonRouterOutlet
        animated={false}
        className="rapago-role-outlet"
      >
        {validRouteChildren}
      </IonRouterOutlet>

      <IonTabBar slot="bottom" className="rapago-role-tabbar">
        {tabs.map((tab) => (
          <IonTabButton key={tab.path} tab={tab.path} href={tab.path}>
            <IonIcon icon={tab.icon} />
            <IonLabel>{tab.label}</IonLabel>
          </IonTabButton>
        ))}
      </IonTabBar>
    </IonTabs>
  );
}
