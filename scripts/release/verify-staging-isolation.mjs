#!/usr/bin/env node
/**
 * verify-staging-isolation.mjs
 *
 * Repo-side checks for TRUE staging isolation (no Hostinger/Supabase writes).
 * Exit 0 = code readiness OK; does NOT claim live isolation.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const notes = [];

function read(rel) {
  const p = resolve(root, rel);
  if (!existsSync(p)) {
    errors.push(`Missing file: ${rel}`);
    return "";
  }
  return readFileSync(p, "utf8");
}

const feTemplate = read("apps/mobile/.env.staging.template");
const beTemplate = read("apps/api/.env.staging.template");
const viteConfig = read("apps/mobile/vite.config.ts");
const cors = read("apps/api/src/plugins/cors.ts");
const prodTemplate = read("apps/mobile/.env.production.template");

if (!/VITE_API_BASE_URL=https:\/\/backend-staging\.rapago\.cl\/api/.test(feTemplate)) {
  errors.push(
    "FE .env.staging.template must set VITE_API_BASE_URL=https://backend-staging.rapago.cl/api",
  );
}
if (/VITE_API_BASE_URL=https:\/\/backend\.rapago\.cl\/api/.test(feTemplate)) {
  errors.push("FE .env.staging.template must NOT point to production backend.rapago.cl");
}

if (!/VITE_API_BASE_URL=https:\/\/backend\.rapago\.cl\/api/.test(prodTemplate)) {
  errors.push("FE .env.production.template must still point to backend.rapago.cl");
}

if (!/STAGING_API_HOST\s*=\s*"backend-staging\.rapago\.cl"/.test(viteConfig)) {
  errors.push("vite.config.ts must define STAGING_API_HOST=backend-staging.rapago.cl");
}
if (!/must NOT point API to/.test(viteConfig)) {
  errors.push("vite.config.ts must fail staging builds that target production API");
}

if (!/APP_ENV=staging/.test(beTemplate)) {
  errors.push("API .env.staging.template must set APP_ENV=staging");
}
if (!/KLAP_ENVIRONMENT=sandbox/.test(beTemplate)) {
  errors.push("API .env.staging.template must set KLAP_ENVIRONMENT=sandbox");
}
if (!/backend-staging\.rapago\.cl\/api\/webhooks\/klap/.test(beTemplate)) {
  errors.push("API .env.staging.template webhooks must target backend-staging");
}
if (!/CORS_ORIGIN=https:\/\/staging\.rapago\.cl/.test(beTemplate)) {
  errors.push("API .env.staging.template must include CORS_ORIGIN for staging.rapago.cl");
}

if (!/STAGING_DEFAULT_ORIGINS/.test(cors) || !/isStagingAppEnv/.test(cors)) {
  errors.push("cors.ts must add staging.rapago.cl defaults when APP_ENV=staging");
}

notes.push("Code readiness checks only — live Hostinger/DB/Klap/SMTP not verified here.");

if (errors.length) {
  console.error("FAIL verify-staging-isolation");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}

console.log("OK verify-staging-isolation");
for (const n of notes) console.log(" -", n);
process.exit(0);
