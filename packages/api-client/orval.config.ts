import { defineConfig } from "orval";

// Generates typed TanStack Query hooks from the running backend's OpenAPI documents.
// Start the API from atom-prive-be first (see its README), then run `pnpm api:generate` in this project.
const apiUrl = process.env.API_URL ?? "http://localhost:8080";

const output = (name: string) => ({
  target: `src/generated/${name}.ts`,
  client: "react-query" as const,
  httpClient: "fetch" as const,
  override: {
    mutator: { path: "src/http.ts", name: "http" },
    // Hooks return the response body itself; failures throw ApiError (see src/http.ts).
    fetch: { includeHttpResponseReturnType: false },
  },
});

export default defineConfig({
  portal: {
    input: { target: `${apiUrl}/v3/api-docs/portal` },
    output: output("portal"),
  },
  backoffice: {
    input: { target: `${apiUrl}/v3/api-docs/backoffice` },
    output: output("backoffice"),
  },
});
