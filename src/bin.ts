#!/usr/bin/env node

import { Command } from "@effect/cli"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Cause, Layer } from "effect"
import * as Effect from "effect/Effect"
import { z } from "zod"
import { layerLogger } from "./Logger.js"
import { ServerMCP } from "./ServerMCP.js"

// #:

const command = Command.make("rember-mcp", {}, () =>
  Effect.gen(function*() {
    const layerServerMCP = ServerMCP.layer({
      name: "rember-mcp",
      version: "0.0.0",
      tools: {
        "add": {
          description: "Add two numbers",
          schemaParams: {
            a: z.number(),
            b: z.number()
          },
          effect: ({ a, b }) => Effect.succeed({ content: [{ type: "text", text: String(a + b) }] })
        }
      }
    })

    // Build the layer and keep the program alive
    yield* Layer.launch(layerServerMCP)
  }))

// #:

export const run = Command.run(command, {
  name: "Rember MCP server",
  version: "0.0.0"
})

// #:

run(process.argv).pipe(
  // Report errors, this needs to happen:
  // - After the creation of our main layers, to report errors in the layer construction
  // - Before providing `layerLogger` so that the errors are reported with the correct
  //   logger
  // Note that we set `disableErrorReporting: true` in `NodeRuntime.runMain`.
  Effect.tapErrorCause((cause) => {
    if (Cause.isInterruptedOnly(cause)) {
      return Effect.void
    }
    return Effect.logError(cause)
  }),
  Effect.provide(layerLogger),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain({ disableErrorReporting: true, disablePrettyLogger: true })
)
