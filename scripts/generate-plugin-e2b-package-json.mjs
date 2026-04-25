#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const packageDir = join(repoRoot, "packages", "plugins", "sandbox-providers", "paperclip-plugin-e2b");
const packageJsonPath = join(packageDir, "package.json");
const sdkPackageJsonPath = join(repoRoot, "packages", "plugins", "sdk", "package.json");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const sdkPackageJson = JSON.parse(readFileSync(sdkPackageJsonPath, "utf8"));
const publishConfig = packageJson.publishConfig ?? {};

const publishPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  license: packageJson.license,
  homepage: packageJson.homepage,
  bugs: packageJson.bugs,
  repository: packageJson.repository,
  type: packageJson.type,
  exports: publishConfig.exports ?? packageJson.exports,
  main: publishConfig.main,
  types: publishConfig.types,
  publishConfig,
  files: packageJson.files,
  paperclipPlugin: packageJson.paperclipPlugin,
  keywords: packageJson.keywords,
  dependencies: {
    "@paperclipai/plugin-sdk": sdkPackageJson.version,
    e2b: packageJson.dependencies.e2b,
  },
};

writeFileSync(packageJsonPath, `${JSON.stringify(publishPackageJson, null, 2)}\n`);

console.log("  ✓ Generated publishable E2B plugin package.json");
