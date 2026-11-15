"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { PropsWithChildren, useState } from "react";

const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

export const Providers = ({ children }: PropsWithChildren) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {/*
          the animations use m.* instead of motion.*: their features are
          downloaded after the page, not bundled with it
        */}
        <LazyMotion features={loadMotionFeatures}>{children}</LazyMotion>
      </QueryClientProvider>
    </ThemeProvider>
  );
};
