import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      // only tells which components the React Compiler would skip (watch() of
      // react-hook-form), and the compiler isn't enabled (reactCompiler)
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    // Playwright fixtures call use(), which is not React's use()
    files: ["e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },
];

export default eslintConfig;
