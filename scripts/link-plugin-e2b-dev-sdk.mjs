#!/usr/bin/env node

import { mkdirSync, lstatSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const packageDir = join(repoRoot, "packages", "plugins", "sandbox-providers", "paperclip-plugin-e2b");
const sdkDir = join(repoRoot, "packages", "plugins", "sdk");
const scopeDir = join(packageDir, "node_modules", "@paperclipai");
const linkTarget = join(scopeDir, "plugin-sdk");

mkdirSync(scopeDir, { recursive: true });

try {
  const stat = lstatSync(linkTarget);
  if (stat.isSymbolicLink()) {
    rmSync(linkTarget, { force: true });
  } else {
    console.log("  i Keeping existing installed @paperclipai/plugin-sdk directory in place");
    process.exit(0);
  }
} catch {
  // target does not exist yet
}

const relativeSdkDir = relative(scopeDir, sdkDir);
symlinkSync(relativeSdkDir, linkTarget, "dir");

console.log("  ✓ Linked local @paperclipai/plugin-sdk for E2B plugin development");
