import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "rolldown";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, ".out");
const outFile = join(outDir, "core.mjs");

await mkdir(outDir, { recursive: true });

await build({
	input: join(here, "core.ts"),
	output: {
		file: outFile,
		format: "esm",
	},
	platform: "node",
});

await import(`${pathToFileURL(outFile).href}?t=${Date.now()}`);
await rm(outDir, { recursive: true, force: true });
