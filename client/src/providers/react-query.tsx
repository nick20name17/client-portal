"use client";

import { getErrorMessage } from "@/helpers/error";
import {
    MutationCache,
    QueryClient,
    QueryClientProvider,
    type QueryKey,
} from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { toast } from "sonner";

declare module "@tanstack/react-query" {
    interface Register {
        queryMeta: {
            suppressErrorToast?: boolean;
        };
        mutationMeta: {
            invalidatesQuery?: QueryKey;
            successMessage?: string;
            errorMessage?: string;
        };
    }
}

export const queryClient = new QueryClient({
    mutationCache: new MutationCache({
        onError(error, _, __, mutation) {
            const errorMessage = getErrorMessage(error);
            toast.error(
                mutation.meta?.errorMessage
                    ? mutation.meta.errorMessage
                    : errorMessage,
            );
        },
        onSuccess(_, __, ___, mutation) {
            const message = mutation.meta?.successMessage;
            if (message) {
                toast.success(message);
            }
        },
        onSettled(_, __, ___, ____, mutation) {
            const queryKey = mutation.options.meta?.invalidatesQuery;
            if (queryKey) {
                queryClient.invalidateQueries({ queryKey });
            }
        },
    }),
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 1000 * 60 * 10,
            gcTime: 1000 * 60 * 30,
        },
        mutations: {
            retry: 0,
        },
    },
});

export const ReactQueryProvider = ({ children }: PropsWithChildren) => {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};
