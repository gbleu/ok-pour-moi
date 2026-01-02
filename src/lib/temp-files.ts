import { mkdirSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface TempDir {
  cleanup: () => void;
  cleanupFile: (path: string) => void;
  filePath: (name: string) => string;
  path: string;
}

export function createTempRunDir(): TempDir {
  const runDir = join(tmpdir(), `opm-${Date.now()}`);
  mkdirSync(runDir, { recursive: true });
  return {
    cleanup: () => {
      rmSync(runDir, { force: true, recursive: true });
    },
    cleanupFile: (path: string) => {
      try {
        unlinkSync(path);
      } catch {
        /* Ignore cleanup errors */
      }
    },
    filePath: (name: string) => join(runDir, name),
    path: runDir,
  };
}
