import * as HelpDoc from "@effect/cli/HelpDoc"
import * as ValidationError from "@effect/cli/ValidationError"
import * as NodeSink from "@effect/platform-node/NodeSink"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Tar from "tar"
import type { ExampleConfig, TemplateConfig } from "./Cli.js"
import { fileURLToPath } from "node:url"
import * as NodePath from "node:path"

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

    return {
      downloadExample,
      downloadTemplate
    } as const
  })
}) {}
