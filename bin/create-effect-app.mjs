#!/usr/bin/env -S node --enable-source-maps --loader tsx
// Tiny shim to run the TypeScript CLI without building
// Delegates to the workspace package's TS entrypoint

await import(new URL("../packages/create-effect-app/src/bin.ts", import.meta.url).href)

