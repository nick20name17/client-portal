"use client";

import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReactQueryProvider } from "./react-query";

export function Providers({ children }: PropsWithChildren) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <TooltipProvider>
                <ReactQueryProvider>{children}</ReactQueryProvider>
            </TooltipProvider>
        </ThemeProvider>
    );
}
