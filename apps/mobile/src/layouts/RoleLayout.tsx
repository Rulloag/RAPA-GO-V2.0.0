import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from "@ionic/react";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import type { TabItem } from "../navigation/routeConfig";

interface RoleLayoutProps {
  tabs: TabItem[];
  /** Direct Route/Redirect children only. Do not wrap these in Switch. */
  children: ReactNode;
}

interface RouteLikeProps {
  exact?: boolean;
  path?: string | readonly string[];
}

interface PartitionedRoleChildren {
  outletChildren: ReactNode[];
  guardChildren: ReactNode[];
}

function getRoleBasePath(tabs: TabItem[]): string | null {
  const firstPath = tabs[0]?.path;
  if (!firstPath) return null;

  const segments = firstPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return `/${segments[0]}`;
}

/**
 * Ionic Router Outlet must contain the concrete tab routes.
 *
 * The layouts also include a non-exact base-path guard such as `/driver`.
 * That guard matches every nested route (`/driver/home`, `/driver/trips`, etc.).
 * Keeping it inside IonRouterOutlet can leave the outlet showing the guard
 * instead of the concrete page. We render that guard outside the outlet.
 */
export function partitionRoleRouteChildren(
  tabs: TabItem[],
  children: ReactNode,
): PartitionedRoleChildren {
  const validChildren = Children.toArray(children);
  const basePath = getRoleBasePath(tabs);

  const outletChildren: ReactNode[] = [];
  const guardChildren: ReactNode[] = [];

  for (const child of validChildren) {
    if (!isValidElement(child)) {
      outletChildren.push(child);
      continue;
    }

    const props = (child as ReactElement<RouteLikeProps>).props;
    const isBasePathGuard =
      basePath !== null &&
      props.exact !== true &&
      typeof props.path === "string" &&
      props.path === basePath;

    if (isBasePathGuard) {
      guardChildren.push(child);
    } else {
      outletChildren.push(child);
    }
  }

  return { outletChildren, guardChildren };
}

export function RoleLayout({ tabs, children }: RoleLayoutProps): JSX.Element {
  const { outletChildren, guardChildren } = partitionRoleRouteChildren(
    tabs,
    children,
  );

  return (
    <>
      {guardChildren}

      <IonTabs className="rapago-role-tabs">
        <IonRouterOutlet animated={false} className="rapago-role-outlet">
          {outletChildren}
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
    </>
  );
}
