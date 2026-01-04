import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const SRC_DIR = "./src";
const DIST_DIR = "./dist";

async function clean(): Promise<void> {
  await rm(DIST_DIR, { force: true, recursive: true });
  await mkdir(DIST_DIR, { recursive: true });
}

async function buildTypeScript(): Promise<void> {
  const result = await Bun.build({
    entrypoints: [
      join(SRC_DIR, "popup/popup.ts"),
      join(SRC_DIR, "options/options.ts"),
      join(SRC_DIR, "content/content.ts"),
      join(SRC_DIR, "content/main-world.ts"),
      join(SRC_DIR, "background/service-worker.ts"),
    ],
    minify: false,
    naming: {
      entry: "[dir]/[name].js",
    },
    outdir: DIST_DIR,
    sourcemap: "external",
    splitting: false,
    target: "browser",
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error("TypeScript build failed");
  }

  console.log("TypeScript compiled successfully");
}

async function copyStaticFiles(): Promise<void> {
  await copyFile("manifest.json", join(DIST_DIR, "manifest.json"));

  await mkdir(join(DIST_DIR, "popup"), { recursive: true });
  await copyFile(join(SRC_DIR, "popup/popup.html"), join(DIST_DIR, "popup/popup.html"));

  await mkdir(join(DIST_DIR, "options"), { recursive: true });
  await copyFile(join(SRC_DIR, "options/options.html"), join(DIST_DIR, "options/options.html"));

  await mkdir(join(DIST_DIR, "icons"), { recursive: true });
  const iconsDir = "./icons";
  try {
    const icons = await readdir(iconsDir);
    for (const icon of icons) {
      await copyFile(join(iconsDir, icon), join(DIST_DIR, "icons", icon));
    }
  } catch {
    console.warn("No icons directory found, skipping icons");
  }

  console.log("Static files copied");
}

async function build(): Promise<void> {
  console.log("Building extension...");
  await clean();
  await buildTypeScript();
  await copyStaticFiles();
  console.log("Build complete! Output in ./dist");
}

await build();
