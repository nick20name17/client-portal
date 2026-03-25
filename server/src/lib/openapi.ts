import { openapi as openapiMiddleware } from "@elysiajs/openapi";

import { auth } from "./auth";

let _schema: ReturnType<typeof auth.api.generateOpenAPISchema>;
const getSchema = async () => (_schema ??= auth.api.generateOpenAPISchema());

export const OpenAPI = {
    getPaths: (prefix = "/api/auth") =>
        getSchema().then(({ paths }) => {
            const reference: typeof paths = Object.create(null);

            for (const path of Object.keys(paths)) {
                const key = prefix + path;
                reference[key] = paths[path];

                for (const method of Object.keys(paths[path])) {
                    const operation = (reference[key] as any)[method];

                    operation.tags = ["Auth"];
                }
            }

            return reference;
        }) as Promise<any>,
    components: getSchema().then(
        ({ components }) => components,
    ) as Promise<any>,
} as const;

export const openapi = openapiMiddleware({
    path: "/docs",
    documentation: {
        components: await OpenAPI.components,
        paths: await OpenAPI.getPaths(),
        info: {
            title: "CRM API",
            version: "0.0.1",
            description: "API documentation for the CRM application",
        },
    },
});
