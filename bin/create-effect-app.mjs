#!/usr/bin/env node
// Tiny shim to run the TypeScript CLI without building.
// Order: bun → tsx → pnpm dlx bun → npx bun

import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const args = process.argv.slice(2)
const here = path.dirname(fileURLToPath(import.meta.url))
const tsEntry = path.resolve(here, "../packages/create-effect-app/src/bin.ts")

function tryRun(cmd, cmdArgs, stdio = "inherit") {
  try {
    const result = spawnSync(cmd, cmdArgs, { stdio })
    if (typeof result.status === "number") return result.status
    return 1
  } catch (err) {
    if (err && err.code === "ENOENT") return 127
    throw err
  }
}

function has(cmd) {
  return tryRun(cmd, ["--version"], "ignore") === 0
}

// 1) If bun is available locally, use it to run TS directly
if (has("bun")) {
  const code = tryRun("bun", [tsEntry, ...args])
  process.exit(code)
}

// 2) If tsx is available, use it under Node
if (has("tsx")) {
  const code = tryRun("tsx", [tsEntry, ...args])
  process.exit(code)
}

// 3) Try fetching Bun via pnpm dlx
let code = tryRun("pnpm", ["dlx", "bun", tsEntry, ...args])

if (code === 127 || code === 1) {
  // 4) Try fetching Bun via npx
  code = tryRun("npx", ["bun", tsEntry, ...args])
}

if (code !== 0) {
  console.error(
    "\ncreate-effect-app: could not execute with bun or tsx.\n" +
      "Tried local bun, local tsx, pnpm dlx bun, then npx bun.\n" +
      "Install Bun (recommended) or tsx, or ensure pnpm/npm can fetch bun.\n"
  )
}

process.exit(code)
