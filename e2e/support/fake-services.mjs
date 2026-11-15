// Test doubles of the external services of the app, for the e2e suite:
// - https (FAKE_HTTPS_PORT): the push service of the fake browser subscriptions
//   (/push/<id>) and the Discord webhook (/discord). Every request is recorded
//   and answered 201, nothing leaves the machine.
// - http (FAKE_CONTROL_PORT): GET /health, GET /requests?prefix=/push/<id>
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const [httpsPort, controlPort, certPath, keyPath] = process.argv.slice(2);
const requests = [];

const fake = https.createServer(
  { cert: readFileSync(certPath), key: readFileSync(keyPath) },
  (req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      requests.push({
        method: req.method,
        path: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString("base64"),
        at: Date.now(),
      });
      res.writeHead(201).end();
    });
  },
);

const control = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health") return res.writeHead(200).end("ok");
  if (url.pathname === "/requests") {
    const prefix = url.searchParams.get("prefix") ?? "";
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(
      JSON.stringify(requests.filter((r) => r.path.startsWith(prefix))),
    );
  }
  res.writeHead(404).end();
});

fake.listen(Number(httpsPort), "127.0.0.1");
control.listen(Number(controlPort), "127.0.0.1");
