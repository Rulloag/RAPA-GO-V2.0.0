import type { ReactElement } from "react";
import { Route } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { TabItem } from "../navigation/routeConfig";
import { partitionRoleRouteChildren } from "./RoleLayout";

interface RoutePropsForTest {
  exact?: boolean;
  path?: string | readonly string[];
}

const DRIVER_TABS: TabItem[] = [
  {
    path: "/driver/home",
    label: "Inicio",
    icon: "home",
  },
];

describe("partitionRoleRouteChildren", () => {
  it("keeps concrete tab routes inside IonRouterOutlet and moves the base guard outside", () => {
    const homeRoute = (
      <Route exact path="/driver/home" render={() => null} />
    );
    const tripsRoute = (
      <Route exact path="/driver/trips" render={() => null} />
    );
    const disabledRoute = (
      <Route path={["/driver/disabled"]} render={() => null} />
    );
    const baseGuard = <Route path="/driver" render={() => null} />;

    const { outletChildren, guardChildren } = partitionRoleRouteChildren(
      DRIVER_TABS,
      [homeRoute, tripsRoute, disabledRoute, baseGuard],
    );

    expect(outletChildren).toHaveLength(3);
    expect(guardChildren).toHaveLength(1);

    const movedGuard = guardChildren[0] as ReactElement<RoutePropsForTest>;
    expect(movedGuard.props.path).toBe("/driver");
    expect(movedGuard.props.exact).not.toBe(true);

    const outletPaths = outletChildren.map(
      (child) => (child as ReactElement<RoutePropsForTest>).props.path,
    );

    expect(outletPaths).toContain("/driver/home");
    expect(outletPaths).toContain("/driver/trips");
    expect(outletPaths).toContainEqual(["/driver/disabled"]);
    expect(outletPaths).not.toContain("/driver");
  });
});
