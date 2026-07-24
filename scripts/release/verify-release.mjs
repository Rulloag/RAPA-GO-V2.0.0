import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const checks = [];

async function text(relative) {
  return readFile(path.join(root, relative), "utf8");
}

async function exists(relative) {
  try {
    await access(path.join(root, relative));
    return true;
  } catch {
    return false;
  }
}

function check(condition, message) {
  checks.push({ condition: Boolean(condition), message });
  if (!condition) failures.push(message);
}

function countMatches(value, expression) {
  return [...value.matchAll(expression)].length;
}

const [
  mobileProductionEnv,
  apiExampleEnv,
  appRouter,
  passengerLayout,
  homePage,
  adminLayout,
  androidManifest,
  androidGradle,
  iosInfoPlist,
  accountDeletionSchema,
  accountDeletionService,
  accountDeletionRepository,
  accountDeletionTypes,
  accountDeletionMailService,
  appleRevocationClient,
  appleRevocationService,
  appleAuthService,
  retentionJob,
  appSource,
  migration0042,
  migration0043,
  sitemap,
  robots,
  playNotes,
  privacyPage,
] = await Promise.all([
  text("apps/mobile/.env.production.template"),
  text("apps/api/.env.example"),
  text("apps/mobile/src/navigation/AppRouter.tsx"),
  text("apps/mobile/src/layouts/PassengerLayout.tsx"),
  text("apps/mobile/src/pages/passenger/pages/HomePage.tsx"),
  text("apps/mobile/src/layouts/AdminLayout.tsx"),
  text("apps/mobile/android/app/src/main/AndroidManifest.xml"),
  text("apps/mobile/android/app/build.gradle"),
  text("apps/mobile/ios/App/App/Info.plist"),
  text("apps/api/src/modules/accountDeletion/accountDeletion.schemas.ts"),
  text("apps/api/src/modules/accountDeletion/accountDeletion.service.ts"),
  text("apps/api/src/modules/accountDeletion/accountDeletion.repository.ts"),
  text("apps/api/src/modules/accountDeletion/accountDeletion.types.ts"),
  text("apps/api/src/modules/auth/mail.service.ts"),
  text("apps/api/src/modules/auth/appleTokenRevocation.client.ts"),
  text("apps/api/src/modules/auth/appleAccountRevocation.service.ts"),
  text("apps/api/src/modules/auth/appleAuth.service.ts"),
  text("apps/api/src/jobs/retention.job.ts"),
  text("apps/api/src/app.ts"),
  text("apps/api/src/db/migrations/0042_production_closure.sql"),
  text("apps/api/src/db/migrations/0043_runtime_schema_repair.sql"),
  text("apps/mobile/public/sitemap.xml"),
  text("apps/mobile/public/robots.txt"),
  text("docs/release/GOOGLE_PLAY_REVIEW_NOTES_TEMPLATE.md"),
  text("apps/mobile/src/pages/public/PublicLegalPages.tsx"),
]);

// Configuración de producción del mobile.
check(
  /^VITE_API_BASE_URL=https:\/\/backend\.rapago\.cl\/api$/m.test(
    mobileProductionEnv,
  ),
  "El mobile de producción debe consumir https://backend.rapago.cl/api",
);
check(
  /^VITE_ENV=production$/m.test(mobileProductionEnv),
  "VITE_ENV debe ser production en la plantilla de producción",
);

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

// Configuración documentada del backend.
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

for (const name of [
  "DATABASE_URL",
  "BANK_ACCOUNT_ENCRYPTION_KEY",
  "APPLE_ALLOWED_CLIENT_IDS",
  "APPLE_TEAM_ID",
  "APPLE_KEY_ID",
  "APPLE_PRIVATE_KEY",
  "OAUTH_TOKEN_ENCRYPTION_KEY",
  "RETENTION_PURGE_ENABLED",
  "RETENTION_PURGE_INTERVAL_MINUTES",
]) {
  check(
    new RegExp(`^${name}=`, "m").test(apiExampleEnv),
    `${name} debe estar documentado en apps/api/.env.example`,
  );
}

check(
  countMatches(apiExampleEnv, /^PUBLIC_WEB_BASE_URL=/gm) === 1,
  "PUBLIC_WEB_BASE_URL debe declararse una sola vez",
);
check(
  /^PUBLIC_WEB_BASE_URL=https:\/\/api\.rapago\.cl$/m.test(apiExampleEnv),
  "PUBLIC_WEB_BASE_URL debe apuntar al frontend público api.rapago.cl",
);
check(
  /^PASSWORD_RESET_FRONTEND_URL=https:\/\/api\.rapago\.cl\/restablecer-contrasena$/m.test(
    apiExampleEnv,
  ),
  "PASSWORD_RESET_FRONTEND_URL debe apuntar a la ruta pública correcta",
);

// Rutas y funciones futuras.
check(
  appRouter.includes('<Route exact path={ROUTES.ROOT} component={LoginPage} />'),
  "El login debe vivir en la raíz pública",
);
check(
  appRouter.includes('<Route exact path={ROUTES.AUTH.LOGIN} component={LoginPage} />'),
  "La ruta /auth/login debe renderizar el login sin pantalla negra",
);
check(
  passengerLayout.includes("DISABLED_PASSENGER_PATHS"),
  "Las rutas futuras de pasajero deben bloquearse",
);
check(
  adminLayout.includes("DISABLED_ADMIN_PATHS"),
  "Las rutas futuras de administración deben bloquearse",
);
check(
  homePage.includes("disabled") && homePage.includes('badge="Pronto"'),
  "Los módulos futuros visibles en Inicio deben permanecer deshabilitados",
);
check(
  !passengerLayout.includes('label: "Próximamente"'),
  "Las pestañas no deben mostrar Próximamente",
);

// Android/iOS.
check(
  androidManifest.includes('android:allowBackup="false"'),
  "Android backup debe estar desactivado",
);
check(
  androidManifest.includes('android:usesCleartextTraffic="false"'),
  "Android debe bloquear tráfico HTTP claro",
);
check(
  androidGradle.includes("versionName releaseVersionName"),
  "Android debe controlar versionName de lanzamiento",
);
check(
  androidGradle.includes("RAPAGO_ANDROID_KEYSTORE_PATH"),
  "Android debe exigir firma de lanzamiento",
);
for (const key of [
  "NSLocationWhenInUseUsageDescription",
  "NSLocationAlwaysAndWhenInUseUsageDescription",
  "UIBackgroundModes",
]) {
  check(iosInfoPlist.includes(key), `Info.plist debe contener ${key}`);
}
check(
  iosInfoPlist.includes("<string>location</string>"),
  "iOS debe declarar location en UIBackgroundModes",
);

// Eliminación de cuenta.
check(
  accountDeletionSchema.includes("reason: reasonSchema"),
  "El esquema debe aceptar el motivo mediante reasonSchema",
);
check(
  accountDeletionSchema.includes(".optional()") &&
    !accountDeletionSchema.includes('.min(10, "El motivo'),
  "El motivo de eliminación debe ser opcional",
);
check(
  !accountDeletionTypes.includes('| "rejected"'),
  "El estado genérico rejected no debe existir en los tipos de eliminación",
);
check(
  accountDeletionTypes.includes('"identity_not_verified"'),
  "Debe existir el estado objetivo identity_not_verified",
);
check(
  accountDeletionService.includes(
    '["pending", "deferred", "failed"].includes(detail.status)',
  ),
  "El servicio debe permitir reintentar solicitudes failed",
);
check(
  accountDeletionRepository.includes('"pending",\n                "deferred",\n                "failed"'),
  "El repositorio debe aceptar failed al aprobar/anonymizar",
);
check(
  accountDeletionRepository.includes(
    'input.reasonCode === "identity_unverified"',
  ) && accountDeletionRepository.includes(
    '? "identity_not_verified"',
  ),
  "La imposibilidad de verificar identidad debe usar identity_not_verified",
);
check(
  accountDeletionMailService.includes(
    "sendAccountDeletionIdentityNotVerified",
  ),
  "La identidad no verificada debe notificar al usuario sin usar rechazo genérico",
);
check(
  migration0042.includes("ALTER COLUMN reason DROP NOT NULL"),
  "La migración 0042 debe hacer opcional el motivo",
);
check(
  migration0042.includes("status = 'identity_not_verified'"),
  "La migración 0042 debe migrar rejected",
);
check(
  migration0042.includes("verified_at"),
  "La migración 0042 debe registrar la verificación de identidad",
);

// Apple.
check(
  appleRevocationClient.includes("APPLE_REVOKE_URL"),
  "Debe existir el cliente oficial de revocación Apple",
);
check(
  appleRevocationClient.includes('token_type_hint: "refresh_token"'),
  "La revocación Apple debe indicar refresh_token",
);
check(
  appleRevocationService.includes("OAuthTokenCrypto.decrypt"),
  "La revocación Apple debe recuperar el refresh token cifrado",
);
check(
  appleAuthService.includes("providerClientId: identityClaims.aud"),
  "Apple debe conservar el client_id/audience original",
);
check(
  accountDeletionService.includes(
    "appleAccountRevocationService.revokeForUser",
  ),
  "La eliminación debe revocar Apple antes de anonimizar",
);
check(
  accountDeletionRepository.includes(".delete(authIdentities)") &&
    accountDeletionRepository.includes(".delete(oauthIdentities)"),
  "La anonimización debe eliminar ambas tablas de identidades después de la revocación",
);

// Conservación.
check(
  retentionJob.includes("purgeExpired(now)"),
  "El job debe purgar ubicaciones vencidas",
);
check(
  retentionJob.includes("interval '30 days'"),
  "El job debe minimizar antecedentes bancarios después de 30 días",
);
check(
  retentionJob.includes("const nowIso = now.toISOString()") &&
    retentionJob.includes("${nowIso}::timestamptz"),
  "El job de conservación debe enlazar fechas como ISO para postgres-js",
);
check(
  migration0043.includes("ADD COLUMN IF NOT EXISTS payment_method") &&
    migration0043.includes("ADD COLUMN IF NOT EXISTS wallet_benefit_requested") &&
    migration0043.includes("ADD COLUMN IF NOT EXISTS assignment_mode"),
  "La migración 0043 debe reparar el esquema runtime de ride_requests",
);
check(
  appSource.includes("new RetentionJob"),
  "La API debe registrar el job de conservación",
);
check(
  appSource.includes('addHook("onReady"'),
  "El job de conservación debe iniciarse con la API",
);

// URLs públicas canónicas.
for (const hostDocument of [sitemap, robots, playNotes, privacyPage]) {
  check(
    hostDocument.includes("api.rapago.cl"),
    "Los documentos públicos deben usar api.rapago.cl",
  );
}
check(
  !sitemap.includes("https://rapago.cl/"),
  "sitemap.xml no debe usar el host antiguo rapago.cl",
);

// Archivos de cierre.
for (const relative of [
  "docs/release/POINTS_25_26_CLOSURE.md",
  "docs/release/GOOGLE_PLAY_REVIEW_NOTES_TEMPLATE.md",
  "docs/release/TEST_ACCOUNTS_TEMPLATE.md",
  "docs/release/DATA_SAFETY_DRAFT.md",
  "docs/release/RELEASE_APPROVAL.md",
  "docs/release/PRODUCTION_TECHNICAL_CLOSURE.md",
  "docs/release/EXTERNAL_EVIDENCE_CHECKLIST.md",
  "docs/release/RETENTION_MATRIX.md",
  "docs/release/SUPABASE_MIGRATION_0042_RUNBOOK.md",
  "docs/release/APPLE_ACCOUNT_DELETION_RUNBOOK.md",
  "docs/release/TAX_DTE_CLOSURE.md",
  "scripts/release/prepare-production-release.ps1",
  "apps/api/src/db/migrations/0042_production_closure.sql",
  "docs/release/sql/0042_production_closure_verify.sql",
  "apps/api/src/db/migrations/0043_runtime_schema_repair.sql",
  "docs/release/sql/0043_runtime_schema_verify.sql",
  "apps/api/scripts/diagnose-runtime-schema.mjs",
]) {
  check(await exists(relative), `${relative} debe existir`);
}

for (const item of checks) {
  console.log(`${item.condition ? "OK" : "ERROR"}: ${item.message}`);
}

if (failures.length > 0) {
  console.error(`\nVerificación fallida: ${failures.length} problema(s).`);
  process.exit(1);
}

console.log(
  "\nCIERRE TÉCNICO DE CÓDIGO: VERIFICACIÓN OK. " +
    "Las evidencias de tiendas, tributación y firmas siguen siendo externas.",
);
