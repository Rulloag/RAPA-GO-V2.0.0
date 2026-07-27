import { readFileSync, existsSync } from "node:fs";

function read(path) {
  if (!existsSync(path)) throw new Error(`Falta ${path}`);
  return readFileSync(path, "utf8");
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`FALTA: ${label}`);
  }
  console.log(`OK: ${label}`);
}

function forbidText(source, forbidden, label) {
  if (source.includes(forbidden)) {
    throw new Error(`INVALIDO: ${label}`);
  }
  console.log(`OK: ${label}`);
}

const app = read("apps/mobile/src/app/App.tsx");
const appRouter = read("apps/mobile/src/navigation/AppRouter.tsx");
const roleLayout = read("apps/mobile/src/layouts/RoleLayout.tsx");
const passenger = read("apps/mobile/src/layouts/PassengerLayout.tsx");
const driver = read("apps/mobile/src/layouts/DriverLayout.tsx");
const guide = read("apps/mobile/src/layouts/GuideLayout.tsx");
const rental = read("apps/mobile/src/layouts/RentalLayout.tsx");
const admin = read("apps/mobile/src/layouts/AdminLayout.tsx");
const appleButton = read("apps/mobile/src/features/auth/AppleSignInButton.tsx");
const login = read("apps/mobile/src/features/auth/LoginPage.tsx");
const vite = read("apps/mobile/vite.config.ts");
const htaccess = read("apps/mobile/public/.htaccess");
const rootPackage = JSON.parse(read("package.json"));
const mobilePackage = JSON.parse(read("apps/mobile/package.json"));

if (rootPackage.dependencies?.react !== mobilePackage.dependencies?.react) {
  throw new Error(
    `INVALIDO: React no coincide entre raíz (${rootPackage.dependencies?.react}) y mobile (${mobilePackage.dependencies?.react})`,
  );
}
console.log(`OK: React único ${mobilePackage.dependencies?.react} en todo el monorepo`);

if (rootPackage.dependencies?.["react-dom"] !== mobilePackage.dependencies?.["react-dom"]) {
  throw new Error(
    `INVALIDO: React DOM no coincide entre raíz (${rootPackage.dependencies?.["react-dom"]}) y mobile (${mobilePackage.dependencies?.["react-dom"]})`,
  );
}
console.log(`OK: React DOM único ${mobilePackage.dependencies?.["react-dom"]} en todo el monorepo`);

requireText(
  app,
  "<AppRouter />",
  "La aplicación monta el router principal",
);
requireText(
  appRouter,
  "<RouteErrorBoundary>",
  "Todas las ramas del router tienen recuperación ante errores",
);
requireText(
  appRouter,
  "function StandaloneRoutes()",
  "Las rutas públicas y autónomas están separadas de los layouts con pestañas",
);
requireText(
  appRouter,
  '<IonRouterOutlet animated={false} className="rapago-root-outlet">',
  "Las rutas autónomas usan un único IonRouterOutlet raíz",
);
forbidText(
  appRouter,
  "<Switch>",
  "El router raíz no anida Switch dentro de IonRouterOutlet",
);
requireText(appRouter, '<Route exact path={ROUTES.AUTH.BASE} component={LoginPage} />', "La base /auth muestra el login");
requireText(roleLayout, "{validRouteChildren}", "Tabs filtra rutas nulas y usa hijos directos en IonRouterOutlet");

for (const [name, source, base] of [
  ["pasajero", passenger, "ROUTES.PASSENGER.BASE"],
  ["conductor", driver, "ROUTES.DRIVER.BASE"],
  ["guía", guide, "ROUTES.GUIDE.BASE"],
  ["arriendo", rental, "ROUTES.RENTAL.BASE"],
  ["admin", admin, "ROUTES.ADMIN.BASE"],
]) {
  forbidText(source, "<Switch>", `${name}: no usa Switch dentro del outlet de tabs`);
  requireText(source, `<Redirect exact from={${base}}`, `${name}: la ruta base redirige a su inicio`);
  requireText(source, "<UnknownRolePathRedirect", `${name}: ruta desconocida muestra 404`);
}

requireText(appleButton, "if (!isAvailable) return null", "Apple se muestra únicamente cuando el flujo nativo está disponible");
requireText(appleButton, "Sign in with Apple", "Botón Apple usa la etiqueta oficial");
requireText(login, 'outcome.kind === "unavailable"', "Login explica Apple fuera de iPhone");
requireText(vite, 'base: "/"', "Vite genera assets desde la raíz");
requireText(vite, 'appType: "spa"', "Vite está configurado como SPA");
requireText(vite, 'dedupe: ["react", "react-dom", "react-router", "react-router-dom"]', "Vite evita duplicar React y React Router");
requireText(htaccess, "RewriteRule ^ index.html [END]", "Hostinger redirige rutas SPA a index.html");

console.log("\nRUTAS RAPA GO: VERIFICACION OK");
