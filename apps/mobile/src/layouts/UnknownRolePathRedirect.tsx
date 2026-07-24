import { Redirect, matchPath, useLocation } from "react-router-dom";

import { ROUTES } from "../navigation/routes.js";

interface UnknownRolePathRedirectProps {
  basePath: string;
  allowedPaths: readonly string[];
}

/**
 * IonRouterOutlet must receive direct Route/Redirect children and cannot be
 * wrapped in a Switch. This guard safely redirects only when none of the
 * role's declared exact routes matches the current URL, avoiding a blank
 * screen for mistyped/deprecated nested paths.
 */
export function UnknownRolePathRedirect({
  basePath,
  allowedPaths,
}: UnknownRolePathRedirectProps): JSX.Element | null {
  const { pathname } = useLocation();

  const insideRole =
    pathname === basePath || pathname.startsWith(`${basePath}/`);

  if (!insideRole) return null;

  const isKnown = allowedPaths.some((path) =>
    Boolean(
      matchPath(pathname, {
        path,
        exact: true,
        strict: false,
      }),
    ),
  );

  return isKnown ? null : <Redirect to={ROUTES.NOT_FOUND} />;
}
