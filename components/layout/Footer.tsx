"use client";

import { Coffee } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";

export const Footer = () => {
  const { theme } = useTheme();

  return (
    <footer className="mt-auto w-full">
      <div className="mt-20 border-t-[0.5px] border-t-[#41414121] bg-gray-100/20 py-2 dark:border-t-[#ffffff21] dark:bg-transparent">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          <a
            className="flex items-center gap-2 rounded-md border border-[#3b82f6a3] px-3 py-2"
            href="https://www.buymeacoffee.com/lilybarberou"
            target="_blank"
            rel="noopener noreferrer"
          >
            <p className="text-sm">Don</p>
            <Coffee className="h-5 w-5" />
          </a>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Créé par{" "}
              <a
                className="font-semibold text-accent-foreground"
                href="https://lilybarberou.fr"
                target="_blank"
                rel="noopener noreferrer"
              >
                Lily Barberou
              </a>
            </p>
            <Image
              className="w-4"
              width={200}
              height={200}
              src={
                theme === "light"
                  ? "/svg/sparkles-light.svg"
                  : "/svg/sparkles.svg"
              }
              alt="Fini"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
