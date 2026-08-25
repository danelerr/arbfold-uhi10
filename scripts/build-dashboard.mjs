import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const output = new URL("../dist/", import.meta.url);

await build({
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
});

await mkdir(new URL("deployments/", output), { recursive: true });
await mkdir(new URL("data/", output), { recursive: true });

await Promise.all([
  cp(new URL("../app/.nojekyll", import.meta.url), new URL(".nojekyll", output)),
  cp(
    new URL("../deployments/unichain-sepolia-1301.json", import.meta.url),
    new URL("deployments/unichain-sepolia-1301.json", output),
  ),
  cp(
    new URL("../benchmark/release-candidate-results/raw.json", import.meta.url),
    new URL("data/release-results.json", output),
  ),
]);

console.log(`ARBFOLD dashboard built at ${output.pathname}`);
