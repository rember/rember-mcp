#!/usr/bin/env node

import { Command, Options } from "@effect/cli"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Array, Cause, Layer, pipe, Redacted, Schedule, Schema } from "effect"
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
      name: "rember",
      version: "1.0.2",
      tools: {
        "generate_cards_and_create_rembs": {
          description: `
A tool to generate spaced-repetition flashcards in Rember.

What is Rember?
Rember is a modern spaced-repetition system based on *rembs*. A remb is a little note about a single concept or idea you want to remember along with a few flashcards testing that concept or idea. In Rember you can create rembs and review their flashcards, just like in Anki or other traditional spaced-repetition systems. Rember also allows exporting rembs to Anki.

When to use this tool?
Use this tool when the user wants to remember one or more ideas, or the user explicitly asks to add something to Rember. This tools allows users to review over time and internalize new concepts or ideas learned from their conversation with you. Since you can work with pdfs and, given the right tool, with webpages and other resources, you can help users create flashcard about pretty much any kind of resource.

Input:
A list little notes which will be sent to the Rember API. Rember will turn each note into a remb, by generating flashcards using AI, independently from this conversation with you. Little notes are the natural organizational unit for spaced-repetition flashcards, they allow users to quickly search, organize and interact with flashcards, moreover they makes it easier to generate flashcards with AI by focusing on a single concept or idea at a time.

Output:
The tool simply signals whether the operation succeded or failed.

Rules:
- Break the content the user wants to remember into a list of little notes
- Each note should be atomic and cover a single concept or idea
- Each note should be self-contained and make sense independently of other notes
- Each note should be concise and to-the-point
- Avoid repeating the same information across multiple notes
- When referencing sources, always use the author or source's proper name (e.g. "Paul Graham suggests..." instead of generic references like "The article suggests..." or "The author suggests...")
          `,
          schemaInput: {
            notes: z.array(
              z.object({
                text: z.string().max(2000).describe("The text content of the note")
              }).describe("A little note about a concept or idea")
            ).max(50).describe("A list of little notes"),
            source: z.string().max(100).optional().describe(
              "The resource (e.g. article, book, pdf, webpage) the notes are about (e.g. 'Author - Title'). Omit this field unless the notes are about a specific concrete resource."
            )
          },
          // TODO: Fix inference of `input` type
          effect: (input) =>
            pipe(
              Effect.gen(function*() {
                const _input = input as { notes: Array<{ text: string }>; source?: string | undefined }
                const notes = yield* pipe(
                  _input.notes,
                  Array.map(({ text }) => ({
                    text: _input.source == undefined ? text : `${text}\n\n${_input.source}`
                  })),
                  Schema.decodeUnknown(Notes)
                )
                yield* rember.generateCardsAndCreateRembs({ notes })
                return { content: [{ type: "text" as const, text: `Generated cards for ${notes.length} rembs.` }] }
              }),
              // Handle input error
              Effect.catchTag("ParseError", (_) =>
                Effect.succeed({
                  content: [{ type: "text" as const, text: `Invalid input: ${_.message}` }],
                  isError: true
                })),
              // Handle other errors
              Effect.retry({
                times: 3,
                schedule: Schedule.exponential("2 second")
              }),
              Effect.timeout("30 seconds"),
              Effect.catchAll((_) =>
                Effect.succeed({
                  content: [{ type: "text" as const, text: _.message }],
                  isError: true
                })
              )
            )
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
  version: "1.0.2"
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
