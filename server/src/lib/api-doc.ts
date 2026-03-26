import type { OpenAPIV3 } from "openapi-types";

/**
 * Same scheme name as Better Auth’s `generateOpenAPISchema()` and ps-crm route `detail.security`.
 * Scalar/Swagger show the lock + Authorize using this ref.
 */
export const protectedApiDetail: Pick<OpenAPIV3.OperationObject, "security"> = {
  security: [{ bearerAuth: [] }],
};

/** Root-level tag list: ordering and descriptions for Scalar / Swagger (ps-crm–style grouping). */
export const openApiTagDefinitions: OpenAPIV3.TagObject[] = [
  { name: "Auth", description: "Authentication and session (Better Auth)." },
  { name: "System", description: "Health and readiness." },
  { name: "Companies", description: "Company directory (admin)." },
  { name: "Users", description: "User directory (admin)." },
  { name: "Projects", description: "Projects, files, and membership." },
  { name: "Comments", description: "Comments on project files." },
  { name: "Tags", description: "Tag taxonomy (mutations admin-only)." },
  { name: "SSE", description: "Project-scoped Server-Sent Events." },
];
