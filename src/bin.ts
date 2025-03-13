#!/usr/bin/env node

import { Command, Options } from "@effect/cli"
import { NodeHttpClient } from "@effect/platform-node"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Cause, ConfigProvider, Layer, Option, pipe, Redacted } from "effect"
import * as Effect from "effect/Effect"
import { layerLogger } from "./logger.js"
import { ApiKey, layerRember } from "./rember.js"
import { layerServerMCP } from "./server-mcp.js"
import { layerTools, toolkit } from "./tools.js"

// #:

const apiKey = pipe(
  Options.text("api-key"),
  Options.withSchema(ApiKey),
  Options.map(Redacted.make),
  Options.optional
)

const command = Command.make("rember-mcp", { apiKey }, ({ apiKey }) =>
  pipe(
    toolkit,
    Effect.flatMap((tools) =>
      Layer.launch(layerServerMCP({
        name: "rember",
        version: "1.0.9",
        tools
      }))
    ),
    Effect.provide(layerTools),
    Effect.provide(layerRember),
    Effect.provide(
      pipe(
        ConfigProvider.fromJson(Option.isSome(apiKey) ? { REMBER_API_KEY: Redacted.value(apiKey.value) } : {}),
        ConfigProvider.orElse(() => ConfigProvider.fromEnv()),
        (_) => Layer.setConfigProvider(_)
      )
    )
  ))

// #:

export const run = Command.run(command, {
  name: "Rember MCP server",
  version: "1.0.9"
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
  Effect.provide(NodeHttpClient.layerUndici),
  Effect.provide(layerLogger),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain({ disableErrorReporting: true, disablePrettyLogger: true })
)
