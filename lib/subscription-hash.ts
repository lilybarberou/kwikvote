// The push endpoint of a browser is a secret: anyone who knows it can follow
// that browser from poll to poll, and replace its keys (createSubscription).
// So a poll never sends the endpoints of its votes, only this hash of each,
// salted with the poll id: the same browser has another hash in each poll.
// The browser hashes its own endpoint the same way to find its votes.
//
// WebCrypto: the same code on the server (Node 20+) and in the browser
// (secure contexts only: https, or http://localhost).
export const hashSubscriptionEndpoint = async (
  pollId: string,
  endpoint: string,
): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${pollId}:${endpoint}`),
  );
  let binary = "";
  for (const byte of new Uint8Array(digest))
    binary += String.fromCharCode(byte);
  // base64url without padding, as Buffer#toString("base64url")
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

// false outside of a secure context (no crypto.subtle): there is no push
// subscription there either, the browser only knows its votes by local storage
export const canHashSubscriptionEndpoint = () =>
  typeof crypto !== "undefined" && !!crypto.subtle;
