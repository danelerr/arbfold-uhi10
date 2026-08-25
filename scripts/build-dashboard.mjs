import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

const output = new URL("../dist/", import.meta.url);

await rm(output, { recursive: true, force: true });
await mkdir(new URL("deployments/", output), { recursive: true });
await mkdir(new URL("data/", output), { recursive: true });

await build({
  entryPoints: [new URL("../app/app.js", import.meta.url).pathname],
  outfile: new URL("app.js", output).pathname,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  sourcemap: true,
  minify: false,
  legalComments: "none",
});

await Promise.all([
  cp(new URL("../app/index.html", import.meta.url), new URL("index.html", output)),
  cp(new URL("../app/styles.css", import.meta.url), new URL("styles.css", output)),
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
