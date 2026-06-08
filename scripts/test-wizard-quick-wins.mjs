#!/usr/bin/env node
/**
 * Deterministic smoke tests for conversational quick wins (dedup + informed skip).
 * Run: node scripts/test-wizard-quick-wins.mjs
 */

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(root, "scripts/test-wizard-quick-wins-runner.ts");

const result = spawnSync("npx", ["tsx", runner], {
  cwd: root,
  encoding: "utf8",
  stdio: "inherit",
});

process.exit(result.status ?? 1);
