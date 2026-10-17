/* Build: bundles src/ with esbuild and copies public/ → dist/.
   No in-browser Babel — JSX is compiled once here.
   Usage: node scripts/build.mjs [--watch] */
import * as esbuild from "esbuild";
import { cpSync, rmSync, mkdirSync, copyFileSync } from "node:fs";

const watch = process.argv.includes("--watch");
const out = "dist";

rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/assets`, { recursive: true });
cpSync("public", out, { recursive: true });
copyFileSync("src/index.html", `${out}/index.html`);

const options = {
  entryPoints: { main: "src/main.jsx" },
  outdir: `${out}/assets`,
  bundle: true,
  splitting: true,          // xlsx becomes its own chunk, loaded only on export
  format: "esm",
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  target: ["es2020", "safari15"],
  jsx: "automatic",
  loader: { ".woff2": "file", ".woff": "file", ".ttf": "file", ".eot": "file" },
  assetNames: "fonts/[name]-[hash]",
  chunkNames: "chunks/[name]-[hash]",
  define: { "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production") },
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching… run `npx wrangler pages dev dist` in another terminal.");
} else {
  await esbuild.build(options);
}
