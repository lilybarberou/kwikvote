// the .env of the project can point to a remote (production) database:
// these tests write and delete data, they only run on a local one
const url = process.env.DATABASE_URL;
const host = url ? new URL(url).hostname : "";

if (!["localhost", "127.0.0.1", "::1"].includes(host))
  throw new Error(
    `Integration tests need a local DATABASE_URL, got host "${host || "none"}"`,
  );
