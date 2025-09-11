import * as Data from "effect/Data"
import type { Example } from "./internal/examples.js"
import type { Template } from "./internal/templates.js"

export type ProjectType = Data.TaggedEnum<{
  readonly Example: {
    readonly example: Example
  }
  readonly Template: {
    readonly template: Template
    /**
     * Optional: absolute or relative path to a local template folder.
     * When provided, this takes precedence over a built-in template name.
     */
    readonly templateFolder?: string
    /**
     * Optional: a GitHub repository spec for a template, such as
     * "owner/repo", "owner/repo@ref", "owner/repo/path", or a full
     * GitHub URL. When provided, this takes precedence over a built-in
     * template name (and over templateFolder).
     */
    readonly templateRepo?: string
    readonly withChangesets: boolean
    readonly withNixFlake: boolean
    readonly withESLint: boolean
    readonly withWorkflows: boolean
  }
}>

export const ProjectType = Data.taggedEnum<ProjectType>()
