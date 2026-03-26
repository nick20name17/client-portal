import { openapi as openapiMiddleware } from "@elysiajs/openapi";
import { openApiTagDefinitions } from "./api-doc";
import { auth } from "./auth";

let schemaCache: ReturnType<typeof auth.api.generateOpenAPISchema> | undefined;
const getSchema = async () => (schemaCache ??= auth.api.generateOpenAPISchema());

/** Merge Better Auth OpenAPI paths under `/api/auth/*` and tag them (same pattern as ps-crm). */
export const OpenAPI = {
  getPaths: (prefix = "/api/auth") =>
    getSchema().then(({ paths }) => {
      const reference: typeof paths = Object.create(null);

      for (const path of Object.keys(paths)) {
        const key = prefix + path;
        reference[key] = paths[path];

        for (const method of Object.keys(paths[path])) {
          const operation = (reference[key] as Record<string, unknown>)[method] as {
            tags?: string[];
          };
          operation.tags = ["Auth"];
        }
      }

      return reference;
    }) as Promise<any>,
  components: getSchema().then(({ components }) => components) as Promise<any>,
} as const;

export const openapi = openapiMiddleware({
  path: "/docs",
  documentation: {
    components: await OpenAPI.components,
    tags: openApiTagDefinitions,
    paths: await OpenAPI.getPaths(),
    info: {
      title: "Client Platform API",
      version: "1.0.0",
      description: "API documentation (grouped by tag; protected routes use Better Auth session).",
    },
  },
});
