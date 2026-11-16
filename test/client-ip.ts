// the address the rate limits see in the integration tests (see
// test/integration-setup.ts); undefined: a new one at each call
export const setClientIp = (ip: string | undefined) => {
  (globalThis as { __clientIp?: string }).__clientIp = ip;
};
