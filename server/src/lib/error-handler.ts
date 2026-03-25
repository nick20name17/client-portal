import type { ErrorHandler } from "elysia";

type ValidationError = {
    path: string;
    message: string;
};

export const handleError: ErrorHandler = ({ code, error, set }) => {
    if (code === "VALIDATION") {
        set.status = 400;

        try {
            const { errors } = JSON.parse(error.message);

            return {
                message: "Validation failed",
                errors: (errors ?? []).map((e: any) => ({
                    path: e.path,
                    message: e.summary ?? e.message,
                })) as ValidationError[],
            };
        } catch {
            return { message: "Validation failed" };
        }
    }

    if (code === "NOT_FOUND") {
        set.status = 404;
        return { message: "Not found" };
    }

    if (code === "PARSE") {
        set.status = 400;
        return { message: "Invalid request body" };
    }

    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[${code}]`, msg);
    set.status = 500;
    return { message: "Internal server error" };
};
