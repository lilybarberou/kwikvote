import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

// Everything the end-to-end suite needs to run without touching a real service.
// The values are test doubles: the database must be local, the push service and
// the Discord webhook are the fake server of e2e/support/fake-services.mjs.

export const APP_PORT = Number(process.env.E2E_PORT ?? 3217);
export const FAKE_HTTPS_PORT = APP_PORT + 1;
export const FAKE_CONTROL_PORT = APP_PORT + 2;
export const BASE_URL = `http://127.0.0.1:${APP_PORT}`;
export const FAKE_HTTPS_URL = `https://127.0.0.1:${FAKE_HTTPS_PORT}`;
export const FAKE_CONTROL_URL = `http://127.0.0.1:${FAKE_CONTROL_PORT}`;

export const ADMIN_PASSWORD = "e2e-admin-password";

// generated for these tests only (web-push generateVAPIDKeys): the fake push
// service accepts anything, a real one would refuse a key it doesn't know
export const VAPID_PUBLIC_KEY =
  "BLR-3PpqcyVOATnyN_e7jQRPtKCp0f9KCPg1cgjFJKWm2B-MME0AbCxEfhh8i9wHIkBForlYHLHFi2niiDVm0SY";
const VAPID_PRIVATE_KEY = "nSKRyrgRA3mrRn85pL4m28Wch9s53yMi8VcmEretQac";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

// the .env of the project can point to the production database: refuse
// anything but a local one, before building or starting anything
export const getLocalDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  let host = "";
  try {
    host = url ? new URL(url).hostname : "";
  } catch {}
  if (!url || !LOCAL_HOSTS.includes(host))
    throw new Error(
      `The e2e tests need a LOCAL DATABASE_URL (got host "${host || "none"}"), see docs/e2e.md`,
    );
  return url;
};

// a self-signed certificate for the fake push service: web-push only speaks
// https, the app server trusts it through NODE_EXTRA_CA_CERTS
export const TLS_DIR = path.join(__dirname, "..", ".tmp");
export const TLS_CERT = path.join(TLS_DIR, "fake-services.crt");
export const TLS_KEY = path.join(TLS_DIR, "fake-services.key");

export const ensureTlsCertificate = () => {
  if (existsSync(TLS_CERT) && existsSync(TLS_KEY)) return;
  mkdirSync(TLS_DIR, { recursive: true });
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "ec",
      "-pkeyopt",
      "ec_paramgen_curve:prime256v1",
      "-nodes",
      "-keyout",
      TLS_KEY,
      "-out",
      TLS_CERT,
      "-days",
      "3650",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
    ],
    { stdio: "ignore" },
  );
};

// the environment of the app server: every variable of lib/env.ts is set, so
// none can come from a .env file (Next.js never overrides a defined variable)
export const getAppServerEnv = (): Record<string, string> => ({
  DATABASE_URL: getLocalDatabaseUrl(),
  ADMIN_PASSWORD,
  DOMAIN: BASE_URL,
  VAPID_PRIVATE_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: VAPID_PUBLIC_KEY,
  NEXT_PUBLIC_VAPID_EMAIL: "e2e@example.com",
  DISCORD_WEBHOOK_URL: `${FAKE_HTTPS_URL}/discord`,
  UMAMI_WEBSITE_ID: "e2e",
  NODE_EXTRA_CA_CERTS: TLS_CERT,
  TZ: "Europe/Paris",
  NEXT_TELEMETRY_DISABLED: "1",
});
