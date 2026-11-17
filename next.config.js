// Security headers of every response (pages, assets, service worker).
// No script-src: Next.js inlines scripts and the analytics script comes from
// another domain; restricting them needs a nonce per request, which makes
// every page dynamic. These directives break nothing and still forbid:
// - frame-ancestors / X-Frame-Options: being shown in a frame (clickjacking);
// - base-uri: a <base> tag that would redirect the relative URLs;
// - object-src: plugins (<object>, <embed>);
// - form-action: forms posting to another site.
// HSTS is left to the HTTPS proxy in front of the app: only it knows whether
// the site is served over HTTPS (a local `next start` is plain HTTP).
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  // older browsers without frame-ancestors
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // no X-Powered-By: Next.js header: it only tells the framework to scanners
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
