const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

const esbuild = require("esbuild");

const projectRoot =
  path.resolve(
    __dirname,
    "..",
  );

const testsDirectory =
  path.join(
    projectRoot,
    "tests",
  );

const outputDirectory =
  path.join(
    projectRoot,
    ".waddletracker-tests",
  );

async function main() {
  await fs.rm(
    outputDirectory,
    {
      recursive: true,
      force: true,
    },
  );

  await fs.mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const entries =
    (
      await fs.readdir(
        testsDirectory,
        {
          withFileTypes: true,
        },
      )
    )
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith(
            ".test.ts",
          ),
      )
      .map(
        (entry) =>
          path.join(
            testsDirectory,
            entry.name,
          ),
      );

  if (
    entries.length === 0
  ) {
    throw new Error(
      "No WaddleTracker tests were found.",
    );
  }

  await esbuild.build({
    entryPoints:
      entries,

    bundle:
      true,

    platform:
      "node",

    format:
      "cjs",

    target:
      "node20",

    outdir:
      outputDirectory,

    outExtension: {
      ".js":
        ".cjs",
    },

    sourcemap:
      "inline",

    logLevel:
      "warning",
  });

  const compiledTests =
    (
      await fs.readdir(
        outputDirectory,
      )
    )
      .filter(
        (fileName) =>
          fileName.endsWith(
            ".test.cjs",
          ),
      )
      .map(
        (fileName) =>
          path.join(
            outputDirectory,
            fileName,
          ),
      );

  await runNodeTests(
    compiledTests,
  );
}

function runNodeTests(
  testFiles,
) {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const child =
        spawn(
          process.execPath,
          [
            "--test",
            ...testFiles,
          ],
          {
            cwd:
              projectRoot,

            stdio:
              "inherit",
          },
        );

      child.on(
        "error",
        reject,
      );

      child.on(
        "exit",
        (code) => {
          if (
            code === 0
          ) {
            resolve();

            return;
          }

          reject(
            new Error(
              `WaddleTracker tests failed with exit code ${String(
                code,
              )}.`,
            ),
          );
        },
      );
    },
  );
}

main()
  .catch(
    async (
      error,
    ) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await fs.rm(
        outputDirectory,
        {
          recursive: true,
          force: true,
        },
      );
    },
  );
