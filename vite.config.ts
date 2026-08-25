import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const developmentEvidence = new Map([
  [
    "/deployments/unichain-sepolia-1301.json",
    fileURLToPath(new URL("./deployments/unichain-sepolia-1301.json", import.meta.url)),
  ],
  [
    "/data/release-results.json",
    fileURLToPath(new URL("./benchmark/release-candidate-results/raw.json", import.meta.url)),
  ],
]);

export default defineConfig({
  root: "app",
  base: "./",
  plugins: [
    react(),
    {
      name: "serve-committed-evidence",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const pathname = request.url?.split("?", 1)[0] ?? "";
          const source = developmentEvidence.get(pathname);
          if (!source) return next();
          try {
            response.statusCode = 200;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(await readFile(source));
          } catch (error) {
            next(error as Error);
          }
        });
      },
    },
  ],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022",
  },
});
