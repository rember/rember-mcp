#!/usr/bin/env node

import { Command, Options } from "@effect/cli"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Array, Cause, ConfigProvider, Layer, Option, pipe, Redacted, Schedule, Schema } from "effect"
import * as Effect from "effect/Effect"
import { z } from "zod"
import { layerLogger } from "./Logger.js"
import { ApiKey, Notes, Rember } from "./Rember.js"
import { ServerMCP } from "./ServerMCP.js"

// #:

const apiKey = pipe(
  Options.text("api-key"),
  Options.withSchema(ApiKey),
  Options.map(Redacted.make),
  Options.optional
)

const command = Command.make("rember-mcp", { apiKey }, ({ apiKey }) =>
  Effect.gen(function*() {
    const rember = yield* Rember

    const layerServerMCP = ServerMCP.layer({
      name: "rember",
      version: "1.0.9",
      tools: {
        "create_flashcards": {
          description: `
A tool to generate spaced-repetition flashcards in Rember.

What is Rember?
Rember is a modern spaced-repetition system based on *rembs*.
A remb is a concise note focused on a single concept or idea you want to remember along with a few flashcards testing that concept or idea.
In Rember you can create rembs and review their flashcards, just like in Anki or other traditional spaced-repetition systems.
Rember also allows exporting rembs to Anki.

What is MCP?
MCP (Model Context Protocol) is Anthropic's open standard allowing Claude to connect with external tools and data sources through a standardized interface.
This tools is implemented and being called through MCP.

Input and behavior:
The input is a list of notes. Rember will turn each note into a remb, by generating flashcards using AI.
In particular, the notes are sent to the Rember API. The Rember API will generate the flashcards with our own custom AI prompts, independently from this conversation with you.
Rember will often generate 4-5 flashcards for each single note.
Rembs are the natural organizational unit for spaced-repetition flashcards, they allow users to quickly search, organize and interact with flashcards.

Examples of how to use this tool:
- After asking you a question the user might say something like "help me remember this": create one remb summarizing the answer
- After chatting with you the user might ask for a few flashcards: create one or two rembs on the core concepts or insights that emerged in the conversation
- For working with PDFs or webpages: extract the main points as individual rembs
- For follow-up requests about specific topics: create targeted rembs on those concepts
- For working with a complex topic: create rembs that break down difficult concepts into manageable chunks

Examples of what the user might say to use this tool:
- "Help me remember that ..."
- "Create flashcards for ..."
- "Create rembs for ..."
- "Add this to Rember"
- "I want to study this later"
- "Turn this into spaced repetition material"

Here are 10 rules for writing notes to send to the Rember API.

Rules:
1. Prefer summarizing information into a single note
2. Create many notes only if the user is trying to remember many different concepts or ideas
3. Focus only on essential concepts or ideas, unless the user explicitly asks about details
4. Notes should be atomic and mostly focused on a single concept or idea
5. Notes should be self-contained and make sense independently of other notes
6. Notes should be concise, get to the point and avoid unnecessary details or verbiage
7. Avoid repeating the same information across multiple notes
8. Use specific attributions when referencing sources (e.g., "Researcher Name states..." not "The article suggests...")
9. If the user asks something like "create N flashcards", explain: "I'll help you create notes on the key concepts you want to remember. Rember will automatically generate appropriate flashcards from each note. Would you like me to create notes on this topic instead?".
10. Follow any other user indication
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
                return {
                  content: [{
                    type: "text" as const,
                    text:
                      `${notes.length} rembs have been created. The number of created flashcards is unknown, report to the user something like "I've created ${notes.length} rembs in Rember, each remb contains multiple flashcards. You can review your flashcards at https://rember.com/review/".`
                  }]
                }
              }),
              // Handle usage limit reached error
              Effect.catchTag("Api/ReachedLimitUsageTracker", (_) =>
                Effect.succeed({
                  content: [{
                    type: "text" as const,
                    text:
                      "You've reached your monthly limit. Visit https://www.rember.com/settings/account to upgrade to Pro and get more rembs."
                  }],
                  isError: true
                })),
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
    Effect.provide(Rember.layer()),
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
  Effect.provide(layerLogger),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain({ disableErrorReporting: true, disablePrettyLogger: true })
)
