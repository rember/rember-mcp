#!/usr/bin/env node

import { Command, Options } from "@effect/cli"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Cause, Layer, pipe, Redacted, Schema } from "effect"
import * as Effect from "effect/Effect"
import { z } from "zod"
import { layerLogger } from "./Logger.js"
import { ApiKey, Notes, Rember } from "./Rember.js"
import { ServerMCP } from "./ServerMCP.js"

// #:

const apiKey = pipe(
  Options.text("api-key"),
  Options.withSchema(ApiKey),
  Options.map(Redacted.make)
)

const command = Command.make("rember-mcp", { apiKey }, ({ apiKey }) =>
  Effect.gen(function*() {
    const rember = yield* Rember

    const layerServerMCP = ServerMCP.layer({
      name: "rember-mcp",
      version: "0.0.0",
      tools: {
        "generate-cards-and-create-rembs": {
          description:
            "Generate spaced-repetition flashcards from notes and create Rembs. A 'Remb' is the primary unit in Rember - a self-contained atomic note representing a concept the user wants to remember, along with spaced repetition flashcards for testing that concept. Each provided note will be processed into its own Remb with appropriate flashcards. When the user requests to add something to Rember, break it down into atomic and self-contained notes.",
          schemaInput: {
            notes: z.array(
              z.object({
                text: z.string()
                  .max(2000, "Each note must be a maximum of 2000 characters")
                  .describe("The text content of the note to be converted into flashcards")
              }).describe("An atomic and self-contained note that will be used to generate a Remb")
            )
              .max(50, "Maximum of 50 notes can be processed at once")
              .describe("Array of notes to be processed into Rembs")
          },
          // TODO: Fix inference of `notesZod` type
          effect: (notesZod) =>
            Effect.gen(function*() {
              const notes = yield* Schema.decodeUnknown(Notes)(notesZod["notes"])
              yield* rember.generateCardsAndCreateRembs({ notes })
              return { content: [{ type: "text", text: `Generated cards for ${notes.length} notes.` }] }
            })
        }
      }
    })

    // Build the layer and keep the program alive
    yield* Layer.launch(layerServerMCP)
  }).pipe(
    Effect.provide(Rember.layer({ apiKey }))
  ))

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
