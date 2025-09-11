import * as HelpDoc from "@effect/cli/HelpDoc"
import * as ValidationError from "@effect/cli/ValidationError"
import * as NodeSink from "@effect/platform-node/NodeSink"
import * as FileSystem from "@effect/platform/FileSystem"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as NodePath from "node:path"
import { fileURLToPath } from "node:url"
import * as Tar from "tar"
import type { ExampleConfig, TemplateConfig } from "./Cli.js"

export class GitHub extends Effect.Service<GitHub>()("app/GitHub", {
  accessors: true,
  effect: Effect.gen(function*() {
    const client = yield* HttpClient.HttpClient
    const fs = yield* FileSystem.FileSystem

    const here = fileURLToPath(import.meta.url)
    const hereDir = NodePath.dirname(here)
    // Repository root when running from a Git checkout (bin shim path → TS entry)
    const repoRoot = NodePath.resolve(hereDir, "../../..")
    const localTemplatesDir = NodePath.join(repoRoot, "templates")
    const localExamplesDir = NodePath.join(repoRoot, "examples")

    const copyDirectoryContents = (fromDir: string, toDir: string) =>
      Effect.gen(function*() {
        const entries = yield* fs.readDirectory(fromDir)
        // Ensure destination exists
        yield* fs.makeDirectory(toDir, { recursive: true })
        for (const name of entries) {
          const from = NodePath.join(fromDir, name)
          const to = NodePath.join(toDir, name)
          yield* fs.copy(from, to)
        }
      })

    const codeloadBaseUrl = "https://codeload.github.com"

    const codeloadClient = client.pipe(
      HttpClient.filterStatusOk,
      HttpClient.mapRequest(HttpClientRequest.prependUrl(codeloadBaseUrl))
    )

    const downloadExample = (config: ExampleConfig) =>
      Effect.gen(function*() {
        // Prefer local copy if running from a Git checkout
        const localPath = NodePath.join(localExamplesDir, config.projectType.example)
        const hasLocal = yield* fs.exists(localPath)
        if (hasLocal) {
          yield* copyDirectoryContents(localPath, config.projectName)
          return
        }
        // Fall back to remote download when not in a repo checkout
        yield* codeloadClient.get("/Effect-TS/examples/tar.gz/main").pipe(
          HttpClientResponse.stream,
          Stream.run(
            NodeSink.fromWritable(
              () =>
                Tar.extract({
                  cwd: config.projectName,
                  strip: 2 + config.projectType.example.split("/").length,
                  filter: (p) => p.includes(`examples-main/examples/${config.projectType.example}`)
                }),
              () =>
                ValidationError.invalidValue(
                  HelpDoc.p(`Failed to download example ${config.projectType.example}`)
                )
            )
          )
        )
      })

    const downloadTemplate = (config: TemplateConfig) =>
      Effect.gen(function*() {
        // Prefer local copy if running from a Git checkout
        const localPath = NodePath.join(localTemplatesDir, config.projectType.template)
        const hasLocal = yield* fs.exists(localPath)
        if (hasLocal) {
          yield* copyDirectoryContents(localPath, config.projectName)
          return
        }
        // Fall back to remote download when not in a repo checkout
        yield* codeloadClient.get("/Effect-TS/examples/tar.gz/main").pipe(
          HttpClientResponse.stream,
          Stream.run(
            NodeSink.fromWritable(
              () =>
                Tar.extract({
                  cwd: config.projectName,
                  strip: 2 + config.projectType.template.split("/").length,
                  filter: (p) => p.includes(`examples-main/templates/${config.projectType.template}`)
                }),
              () =>
                ValidationError.invalidValue(
                  HelpDoc.p(`Failed to download template ${config.projectType.template}`)
                )
            )
          )
        )
      })

    /** Parse a GitHub repo specification into owner/repo/ref/subdir */
    const parseGitHubSpec = (spec: string) => {
      let s = spec.trim()
      // Allow prefixes
      if (s.startsWith("gh:")) s = s.slice(3)
      if (s.startsWith("github:")) s = s.slice(7)

      // URL form
      if (s.startsWith("http://") || s.startsWith("https://")) {
        try {
          const url = new URL(s)
          if (!/github\.com$/i.test(url.hostname)) {
            return undefined
          }
          const parts = url.pathname.split("/").filter(Boolean)
          if (parts.length < 2) return undefined
          const owner = parts[0]!
          const repo = parts[1]!
          let ref: string | undefined
          let subdir: string | undefined
          if (parts[2] === "tree" && parts.length >= 4) {
            ref = parts[3]!
            subdir = parts.slice(4).join("/") || undefined
          } else {
            subdir = parts.slice(2).join("/") || undefined
          }
          return { owner, repo, ref, subdir }
        } catch {
          return undefined
        }
      }

      // owner/repo[/subdir][@ref] (ref suffix)
      let ref: string | undefined
      const at = s.lastIndexOf("@")
      if (at > 0) {
        ref = s.slice(at + 1)
        s = s.slice(0, at)
      }
      const segs = s.split("/").filter(Boolean)
      if (segs.length < 2) return undefined
      const owner = segs[0]!
      const repo = segs[1]!
      const subdir = segs.slice(2).join("/") || undefined
      return { owner, repo, ref, subdir }
    }

    const downloadFromRepo = (spec: string, destDir: string) =>
      Effect.gen(function*() {
        const parsed = parseGitHubSpec(spec)
        if (!parsed) {
          return yield* Effect.fail(
            ValidationError.invalidValue(
              HelpDoc.p(`Invalid GitHub repo spec: ${spec}`)
            )
          )
        }
        const { owner, ref, repo, subdir } = parsed
        const commitish = ref ?? "main"
        yield* codeloadClient.get(`/${owner}/${repo}/tar.gz/${commitish}`).pipe(
          HttpClientResponse.stream,
          Stream.run(
            NodeSink.fromWritable(
              () =>
                Tar.extract({
                  cwd: destDir,
                  strip: 1 + (subdir ? subdir.split("/").filter(Boolean).length : 0),
                  filter: (p) => {
                    // Remove top-level folder name before matching
                    const parts = p.split("/")
                    const inner = parts.slice(1).join("/")
                    if (!subdir) return true
                    return inner === subdir || inner.startsWith(subdir + "/")
                  }
                }),
              () =>
                ValidationError.invalidValue(
                  HelpDoc.p(
                    `Failed to download template from ${owner}/${repo}@${commitish}${subdir ? "/" + subdir : ""}`
                  )
                )
            )
          )
        )
      })

    return {
      downloadExample,
      downloadTemplate,
      downloadFromRepo
    } as const
  })
}) {}
