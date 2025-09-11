#!/usr/bin/env node
// Prints files in this template that typically need customization
// after scaffolding (e.g. placeholders like <PLACEHOLDER>).

import fs from "node:fs/promises"

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function containsPlaceholder(p) {
  try {
    const s = await fs.readFile(p, "utf8")
    return s.includes("<PLACEHOLDER>")
  } catch {
    return false
  }
}

async function main() {
  const candidates = [
    "package.json",
    "LICENSE",
    ".changeset/config.json"
  ]

  const files = []
  for (const p of candidates) {
    if (await exists(p)) {
      // only list files that likely need edits
      if (await containsPlaceholder(p)) files.push(p)
    }
  }

  if (files.length === 0) return

  console.log("[create-effect-app] Files to review and customize:")
  for (const f of files) console.log(` - ${f}`)
}

main().catch((err) => {
  console.error("[create-effect-app] did-create-effect-app script failed:", err)
  process.exitCode = 1
})
