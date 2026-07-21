import { readFile, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const checks = [];

async function text(relative) {
  return readFile(path.join(root, relative), "utf8");
}

function check(condition, message) {
  checks.push({ condition, message });
  if (!condition) failures.push(message);
}

const mobileProductionEnv = await text("apps/mobile/.env.production.template");
const apiExampleEnv = await text("apps/api/.env.example");
const appRouter = await text("apps/mobile/src/navigation/AppRouter.tsx");
const passengerLayout = await text("apps/mobile/src/layouts/PassengerLayout.tsx");
const homePage = await text("apps/mobile/src/pages/passenger/pages/HomePage.tsx");
const adminLayout = await text("apps/mobile/src/layouts/AdminLayout.tsx");
const manifest = await text("apps/mobile/android/app/src/main/AndroidManifest.xml");
const gradle = await text("apps/mobile/android/app/build.gradle");

for (const name of [
  "VITE_ALLOW_FUTURE_FEATURES_IN_PRODUCTION",
  "VITE_FEATURE_TOURISM",
  "VITE_FEATURE_RENTALS",
  "VITE_FEATURE_EVENTS",
]) {
  check(
    new RegExp(`^${name}=false$`, "m").test(mobileProductionEnv),
    `${name} debe estar en false para lanzamiento`,
  );
}

for (const name of [
  "ALLOW_FUTURE_FEATURES_IN_PRODUCTION",
  "FEATURE_TOURISM_ENABLED",
  "FEATURE_RENTALS_ENABLED",
  "FEATURE_EVENTS_ENABLED",
]) {
  check(
    new RegExp(`^${name}=false$`, "m").test(apiExampleEnv),
    `${name} debe estar documentado en false`,
  );
}

check(appRouter.includes("LegacyLoginRedirect"), "La ruta /auth/login debe redirigir a la raíz");
check(appRouter.includes("<AuthRoute path={ROUTES.ROOT}"), "El login debe vivir en la raíz pública");
check(passengerLayout.includes("DISABLED_PASSENGER_PATHS"), "Las rutas futuras de pasajero deben bloquearse");
check(adminLayout.includes("DISABLED_ADMIN_PATHS"), "Las rutas futuras de administración deben bloquearse");
check(!homePage.includes("Próximamente"), "Inicio pasajero no debe mostrar tarjetas Próximamente");
check(!passengerLayout.includes('label: "Próximamente"'), "Las pestañas no deben mostrar Próximamente");
check(manifest.includes('android:allowBackup="false"'), "Android backup debe estar desactivado");
check(manifest.includes('android:usesCleartextTraffic="false"'), "Android debe bloquear tráfico HTTP claro");
check(gradle.includes("versionName releaseVersionName"), "Android debe controlar versionName de lanzamiento");
check(gradle.includes("RAPAGO_ANDROID_KEYSTORE_PATH"), "Android debe exigir firma de lanzamiento");

for (const relative of [
  "docs/release/POINTS_25_26_CLOSURE.md",
  "docs/release/GOOGLE_PLAY_REVIEW_NOTES_TEMPLATE.md",
  "docs/release/TEST_ACCOUNTS_TEMPLATE.md",
  "docs/release/DATA_SAFETY_DRAFT.md",
  "docs/release/RELEASE_APPROVAL.md",
]) {
  try {
    await access(path.join(root, relative));
    check(true, `${relative} existe`);
  } catch {
    check(false, `${relative} debe existir`);
  }
}

for (const item of checks) {
  console.log(`${item.condition ? "OK" : "ERROR"}: ${item.message}`);
}

if (failures.length > 0) {
  console.error(`\nVerificación fallida: ${failures.length} problema(s).`);
  process.exit(1);
}

console.log("\nPUNTOS 25 Y PREPARACION TECNICA 26: VERIFICACION OK");
