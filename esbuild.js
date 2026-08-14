const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

const config = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: [
    "vscode",
    "better-sqlite3",
  ],
  format: "cjs",
  platform: "node",
  target: "node20",
  sourcemap: true,
  minify: false,
};

async function main() {
  const context = await esbuild.context(config);

  if (watch) {
    await context.watch();
    console.log("WaddleTracker: watching for changes...");
    return;
  }

  await context.rebuild();
  await context.dispose();

  console.log("WaddleTracker: build complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
