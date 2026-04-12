#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OLD_DB_URL = "postgresql://USER:PASSWORD@OLD_HOST:5432/OLD_DB";
const NEW_DB_URL = "postgresql://USER:PASSWORD@NEW_HOST:5432/NEW_DB";

const shouldKeepDb = process.argv.includes("--keep-db");
const tempDir = mkdtempSync(join(tmpdir(), "clone-db-"));
const dumpFile = join(tempDir, "backup.dump");

function parseDbUrl(connectionString) {
  const url = new URL(connectionString);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (!databaseName) {
    throw new Error(`Database name missing in URL: ${connectionString}`);
  }

  return {
    databaseName,
    connectionString,
    adminConnectionString: buildAdminUrl(url),
  };
}

function buildAdminUrl(url) {
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = "/postgres";
  return adminUrl.toString();
}

function run(command, args, { allowFailure = false } = {}) {
  console.log(`\n> ${command} ${args.join(" ")}`);

  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}`);
  }

  return result;
}

function escapeSqlIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function terminateConnections(adminConnectionString, databaseName) {
  const sql = `
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '${databaseName.replaceAll("'", "''")}'
      AND pid <> pg_backend_pid();
  `;

  run("psql", [adminConnectionString, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function recreateDatabase(adminConnectionString, databaseName) {
  const escapedName = escapeSqlIdentifier(databaseName);

  terminateConnections(adminConnectionString, databaseName);
  run("psql", [
    adminConnectionString,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `DROP DATABASE IF EXISTS ${escapedName};`,
  ]);
  run("psql", [
    adminConnectionString,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `CREATE DATABASE ${escapedName};`,
  ]);
}

function main() {
  const source = parseDbUrl(OLD_DB_URL);
  const target = parseDbUrl(NEW_DB_URL);

  console.log(`Source DB: ${source.databaseName}`);
  console.log(`Target DB: ${target.databaseName}`);
  console.log(`Dump file: ${dumpFile}`);

  run("pg_dump", [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--dbname",
    source.connectionString,
    "--file",
    dumpFile,
  ]);

  if (!shouldKeepDb) {
    recreateDatabase(target.adminConnectionString, target.databaseName);
  }

  run("pg_restore", [
    "--no-owner",
    "--no-privileges",
    "--clean",
    "--if-exists",
    "--dbname",
    target.connectionString,
    dumpFile,
  ]);

  console.log("\nClone termine.");
}

try {
  main();
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
