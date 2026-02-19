import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

const katexDistDir = resolve(projectRoot, "node_modules", "katex", "dist");
const outputDir = resolve(projectRoot, "media", "katex");

if (!existsSync(katexDistDir)) {
  throw new Error("KaTeX dist directory not found. Run npm install first.");
}

mkdirSync(outputDir, { recursive: true });

cpSync(resolve(katexDistDir, "katex.css"), resolve(outputDir, "katex.css"));
cpSync(resolve(katexDistDir, "fonts"), resolve(outputDir, "fonts"), {
  recursive: true,
});

console.log("Copied KaTeX CSS and fonts to media/katex");
