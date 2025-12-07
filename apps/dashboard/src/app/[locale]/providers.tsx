"use client";

import { DesktopProvider } from "@/components/desktop-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProviderClient } from "@/locales/client";
import { TRPCReactProvider } from "@/trpc/client";
import type { ReactNode } from "react";
import { useEffect } from "react";

type ProviderProps = {
  locale: string;
  children: ReactNode;
};

export function Providers({ locale, children }: ProviderProps) {
  useEffect(() => {
    // Initialize react-grab for development
    if (process.env.NODE_ENV === "development") {
      import("react-grab").then(() => {
        console.log("React Grab initialized");
      });
    }
  }, []);

  return (
    <TRPCReactProvider>
      <I18nProviderClient locale={locale}>
        <DesktopProvider />

        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </I18nProviderClient>
    </TRPCReactProvider>
  );
}
