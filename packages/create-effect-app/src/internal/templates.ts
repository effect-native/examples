import { fileURLToPath } from "node:url"
import * as Path from "node:path"
import * as Fs from "node:fs"

/** @internal */
export type Template = string

/**
 * Attempt to discover available templates by scanning the repository's
 * `templates/` directory at runtime. Falls back to a conservative default
 * list if the directory cannot be found (e.g. when running from a published
 * package that doesn't include the repository root).
 * @internal
 */
function discoverTemplates(): readonly Template[] {
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = Path.dirname(__filename)
    // From this file (packages/create-effect-app/src/internal or dist/internal)
    // walk up to repo root and into `templates/`.
    const repoTemplatesDir = Path.resolve(__dirname, "../../../../templates")

    if (Fs.existsSync(repoTemplatesDir)) {
      const entries = Fs.readdirSync(repoTemplatesDir, { withFileTypes: true })
      const names = entries.filter((e) => e.isDirectory()).map((e) => e.name)
      // Keep a stable sort for nice UX
      names.sort((a, b) => a.localeCompare(b))
      return names
    }
  } catch {
    // no-op; fall through to fallback list
  }

  // Fallback to the original hard-coded list to remain functional
  return ["basic", "cli", "monorepo"] as const
}

/** @internal */
export const templates: readonly Template[] = discoverTemplates()

/** @internal */
export interface TemplateChoice {
  readonly title: string
  readonly value: Template
  readonly description?: string
}

function toTitle(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter((s) => s.length > 0)
    .map((s) => s[0]!.toUpperCase() + s.slice(1))
    .join(" ")
}

/**
 * Builds prompt choices with a human-friendly title and (if available)
 * a description read from each template's package.json.
 * @internal
 */
function buildTemplateChoices(): readonly TemplateChoice[] {
  const list = templates
  const choices: TemplateChoice[] = []

  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = Path.dirname(__filename)
    const repoTemplatesDir = Path.resolve(__dirname, "../../../../templates")

    for (const name of list) {
      let description: string | undefined
      try {
        const pkgPath = Path.join(repoTemplatesDir, name, "package.json")
        if (Fs.existsSync(pkgPath)) {
          const json = JSON.parse(Fs.readFileSync(pkgPath, "utf8"))
          if (typeof json?.description === "string" && json.description.trim().length > 0) {
            description = json.description
          }
        }
      } catch {
        // ignore per-template failures; just omit description
      }

      const base = { title: toTitle(name), value: name }
      choices.push((description !== undefined ? { ...base, description } : base) as TemplateChoice)
    }
  } catch {
    // If anything goes wrong, fall back to titles derived from slugs
    for (const name of list) {
      choices.push({ title: toTitle(name), value: name })
    }
  }

  return choices
}

/** @internal */
export const templateChoices: readonly TemplateChoice[] = buildTemplateChoices()
