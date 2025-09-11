#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import { stdin as input, stdout as output } from "node:process"
import readline from "node:readline/promises"

const projectRoot = process.cwd()
const pkgPath = path.join(projectRoot, "package.json")
const appJsonPath = path.join(projectRoot, "app.json")

function sanitizeSlug(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replaceAll(/[^\da-z-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "-")
    .replace(/^-+/, "")
}

function isValidSlug(s) {
  return /^[\da-z][\da-z-]*$/.test(s)
}

function isValidScheme(s) {
  return /^[a-z][\d+.a-z-]*$/.test(s)
}

function isValidBundleId(s) {
  // iOS: reverse-DNS, segments start with a letter
  return /^[A-Za-z][\dA-Za-z]*(\.[A-Za-z][\dA-Za-z]*)+$/.test(s)
}

function isValidAndroidPackage(s) {
  // Android: lowercase reverse-DNS
  return /^[a-z][\da-z]*(\.[a-z][\da-z]*)+$/.test(s)
}

async function readJson(file) {
  const raw = await fs.readFile(file, "utf8")
  return JSON.parse(raw)
}

async function writeJson(file, data) {
  const text = JSON.stringify(data, null, 2) + "\n"
  await fs.writeFile(file, text, "utf8")
}

function toAndroidPackage(bundleId) {
  return bundleId
    .split(".")
    .map((seg) => seg.toLowerCase())
    .join(".")
}

async function main() {
  const rl = readline.createInterface({ input, output })
  try {
    const pkg = await readJson(pkgPath)
    const app = await readJson(appJsonPath)

    const expo = app.expo || {}
    const currentName = expo.name ?? "My App"
    const currentSlug = expo.slug ?? sanitizeSlug(currentName)
    const currentScheme = expo.scheme ?? currentSlug
    const currentBundleId = expo.ios?.bundleIdentifier ?? "com.example.app"
    const currentAndroidPackage = expo.android?.package ?? toAndroidPackage(currentBundleId)

    output.write("\nWelcome to did-create-effect-app \u2728\n")
    output.write("This will update package.json and app.json.\n")
    output.write(
      "Press Enter to accept the suggested value in [brackets].\n\n"
    )

    // Name (display name)
    let name = await rl.question(`Display name (Expo) [${currentName}]: `)
    name = name.trim() || currentName

    // Slug
    const suggestedSlug = sanitizeSlug(name) || currentSlug
    let slug = await rl.question(
      `App slug (URL-safe) [${currentSlug || suggestedSlug}]: `
    )
    slug = slug.trim() || currentSlug || suggestedSlug
    slug = sanitizeSlug(slug)
    while (!isValidSlug(slug)) {
      slug = sanitizeSlug(
        await rl.question(
          "Slug must be lowercase letters, numbers, hyphens; try again: "
        )
      )
    }

    // Scheme
    const schemeDefault = currentScheme || slug
    let scheme = await rl.question(`Deep link scheme [${schemeDefault}]: `)
    scheme = scheme.trim() || schemeDefault
    while (!isValidScheme(scheme)) {
      scheme = (
        await rl.question("Scheme must match ^[a-z][a-z0-9+.-]*$; try again: ")
      ).trim()
    }

    // iOS bundle identifier
    let bundleIdentifier = await rl.question(
      `iOS bundleIdentifier [${currentBundleId}]: `
    )
    bundleIdentifier = bundleIdentifier.trim() || currentBundleId
    while (!isValidBundleId(bundleIdentifier)) {
      bundleIdentifier = (
        await rl.question(
          "Invalid bundleIdentifier (e.g., com.example.app); try again: "
        )
      ).trim()
    }

    // Android package
    const androidDefault = currentAndroidPackage || toAndroidPackage(bundleIdentifier)
    let androidPackage = await rl.question(
      `Android package [${androidDefault}]: `
    )
    androidPackage = androidPackage.trim() || androidDefault
    while (!isValidAndroidPackage(androidPackage)) {
      androidPackage = (
        await rl.question(
          "Invalid Android package (lowercase, e.g., com.example.app); try again: "
        )
      ).trim()
    }

    // Update app.json
    app.expo = app.expo || {}
    app.expo.name = name
    app.expo.slug = slug
    app.expo.scheme = scheme
    app.expo.ios = app.expo.ios || {}
    app.expo.ios.bundleIdentifier = bundleIdentifier
    app.expo.android = app.expo.android || {}
    app.expo.android.package = androidPackage

    // Update package.json name to npm-friendly value (use slug)
    const npmName = slug
    pkg.name = npmName

    await writeJson(appJsonPath, app)
    await writeJson(pkgPath, pkg)

    output.write("\nUpdated files:\n")
    output.write(
      `- app.json → name="${name}", slug="${slug}", scheme="${scheme}"\n`
    )
    output.write(
      `- app.json → ios.bundleIdentifier="${bundleIdentifier}", android.package="${androidPackage}"\n`
    )
    output.write(`- package.json → name="${npmName}"\n`)
    output.write("\nNext steps:\n")
    output.write("- pnpm prebuild (to regenerate native projects)\n")
    output.write("- pnpm ios / pnpm android / pnpm web\n\n")
  } catch (error) {
    console.error("Error:", error?.message || error)
    process.exitCode = 1
  } finally {
    rl.close()
  }
}

await main()
