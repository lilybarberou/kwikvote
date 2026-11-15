import {
  createDecipheriv,
  createECDH,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { FAKE_CONTROL_URL, FAKE_HTTPS_URL } from "./env";

// A fake push subscription: the endpoint is the fake push service of the
// suite, the keys are real (P-256 + auth secret) so that the payload encrypted
// by web-push on the server can be decrypted and checked here.

export type FakePushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  // received notifications, oldest first
  notifications: () => Promise<PushPayload[]>;
};

export type PushPayload = { title: string; body: string; link: string };

const b64url = (buffer: Buffer) => buffer.toString("base64url");

const hmac = (key: Buffer, data: Buffer) =>
  createHmac("sha256", key).update(data).digest();

// RFC 8291 (message encryption for web push) with the aes128gcm content
// coding of RFC 8188, the default of web-push
const decrypt = (
  body: Buffer,
  ecdh: ReturnType<typeof createECDH>,
  authSecret: Buffer,
) => {
  const salt = body.subarray(0, 16);
  const idLength = body.readUInt8(20);
  const serverPublicKey = body.subarray(21, 21 + idLength);
  const ciphertext = body.subarray(21 + idLength);

  const sharedSecret = ecdh.computeSecret(serverPublicKey);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    ecdh.getPublicKey(),
    serverPublicKey,
    Buffer.from([1]),
  ]);
  const ikm = hmac(hmac(authSecret, sharedSecret), keyInfo);
  const prk = hmac(salt, ikm);
  const cek = hmac(
    prk,
    Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary"),
  ).subarray(0, 16);
  const nonce = hmac(
    prk,
    Buffer.from("Content-Encoding: nonce\0\x01", "binary"),
  ).subarray(0, 12);

  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const padded = Buffer.concat([
    decipher.update(ciphertext.subarray(0, ciphertext.length - 16)),
    decipher.final(),
  ]);
  // a single record: the content ends with the 0x02 delimiter then zeros
  return padded.subarray(0, padded.lastIndexOf(2)).toString("utf8");
};

export const createFakePushSubscription = (): FakePushSubscription => {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const authSecret = randomBytes(16);
  const path = `/push/${randomUUID()}`;

  return {
    endpoint: `${FAKE_HTTPS_URL}${path}`,
    keys: { p256dh: b64url(ecdh.getPublicKey()), auth: b64url(authSecret) },
    notifications: async () => {
      const res = await fetch(
        `${FAKE_CONTROL_URL}/requests?prefix=${encodeURIComponent(path)}`,
      );
      const requests = (await res.json()) as { body: string }[];
      return requests.map((request) =>
        JSON.parse(
          decrypt(Buffer.from(request.body, "base64"), ecdh, authSecret),
        ),
      );
    },
  };
};

// the messages posted to the fake Discord webhook
export const getDiscordMessages = async () => {
  const res = await fetch(`${FAKE_CONTROL_URL}/requests?prefix=/discord`);
  const requests = (await res.json()) as { body: string }[];
  return requests.map(
    (request) =>
      JSON.parse(Buffer.from(request.body, "base64").toString("utf8")) as {
        embeds: { title: string; description?: string; fields?: unknown[] }[];
      },
  );
};
