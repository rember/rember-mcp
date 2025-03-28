import { AiToolkit } from "@effect/ai"
import { Array, Effect, pipe, Schema, String } from "effect"
import { Rember } from "./rember.js"
import { ErrorToolMCP } from "./server-mcp.js"

// #:

export class ToolCreateFlashcards extends Schema.TaggedRequest<ToolCreateFlashcards>()(
  "CreateFlashcards",
  {
    success: Schema.String,
    failure: ErrorToolMCP,
    payload: {
      notes: Schema.Array(
        Schema.Struct({
          text: Schema.String.pipe(Schema.maxLength(2000)).annotations({
            title: "Text",
            description: "The text content of the note"
          })
        }).annotations({
          title: "Note",
          description: "A little note about a concept or idea"
        })
      ).pipe(Schema.maxItems(50)).annotations({
        title: "Notes",
        description: "A list of little notes"
      }),
      source: Schema.String.pipe(Schema.maxLength(100), Schema.optional).annotations({
        title: "Source",
        description:
          "The resource (e.g. article, book, pdf, webpage) the notes are about (e.g. 'Author - Title'). Omit this field unless the notes are about a specific concrete resource."
      })
    }
  },
  {
    description: pipe(
      `
      |A tool to generate spaced-repetition flashcards in Rember.
      |
      |What is Rember?
      |Rember is a modern spaced-repetition system based on *rembs*.
      |A remb is a concise note focused on a single concept or idea you want to remember, along with a few flashcards testing that concept or idea.
      |In Rember you can create rembs and review their flashcards, just like in Anki or other traditional spaced-repetition systems.
      |Rember also allows exporting rembs to Anki.
      |Rember can be found at https://rember.com.
      |
      |What is MCP?
      |MCP (Model Context Protocol) is Anthropic's open standard allowing Claude to connect with external tools and data sources through a standardized interface.
      |This tools is implemented and being called through MCP.
      |
      |Input and behavior:
      |The input is a list of notes, with optionally a source. Rember will turn each note into a remb, by generating flashcards using AI.
      |In particular, the notes are sent to the Rember API. The Rember API will generate the flashcards with our own custom AI prompts, independently from this conversation with you.
      |Rember will often generate 4-5 flashcards for each single note.
      |Rembs are the natural organizational unit for spaced-repetition flashcards, they allow users to quickly search, organize and interact with flashcards.
      |Note that if the user asks about Rember in general, keep things simple and avoid getting into lower level details by e.g. mentioning the Rember API.
      |
      |How to use this tool:
      |- The user might ask you to create a few flashcards about a topic: create one note with only the essential concepts of the topic
      |- After asking you a question the user might say something like "help me remember this": create one note synthesizing only the key points of the answer
      |- After chatting with you the user might ask for a few flashcards: create one or two notes capturing only the core insights from the conversation
      |- For working with PDFs or webpages: extract only the most important points as individual notes, make sure you include the 'source' in the tool input
      |- For follow-up requests about specific topics: create targeted notes focusing on the essential aspects of those concepts
      |- For working with a complex topic: create notes that break down difficult concepts into manageable chunks
      |
      |What the user might say to use this tool:
      |- "Help me remember that ..."
      |- "Create flashcards for ..."
      |- "Create rembs for ..."
      |- "Add this to Rember"
      |- "I want to study this later"
      |- "Turn this into spaced repetition material"
      |
      |Here are 10 rules for writing notes to send to the Rember API.
      |
      |Rules:
      |1. ALWAYS synthesize information to its essence, include only essential concepts or ideas by default
      |2. Keep the number of notes to a minimum, create more than one note only if the user is trying to remember different concepts or ideas
      |3. Include comprehensive details ONLY when the user explicitly requests them with phrases like "include all details" or "be comprehensive"
      |4. Notes should be atomic and mostly focused on a single concept or idea
      |5. Notes should be self-contained and make sense independently of other notes
      |6. Notes should be concise, get to the point and avoid unnecessary details or verbiage
      |7. Avoid repeating the same information across multiple notes
      |8. Use specific attributions when referencing sources (e.g., "Researcher Name states..." not "The article suggests...")
      |9. If the user asks something like "create N flashcards", explain: "I'll help you create notes on the key concepts you want to remember. Rember will automatically generate multiple flashcards from each note (typically 4-5 per note).".
      |10. Follow any other user indication
      `,
      String.stripMargin,
      String.trim
    )
  }
) {}

// #:

export const toolkit = AiToolkit.empty.add(ToolCreateFlashcards)

// #:

export const layerTools = toolkit.implement((handlers) =>
  Effect.gen(function*() {
    const rember = yield* Rember

    return handlers.handle("CreateFlashcards", ({ notes, source }) =>
      pipe(
        Effect.gen(function*() {
          const notesRember = pipe(
            notes,
            Array.map(({ text }) => ({ text: source == undefined ? text : `${text}\n\n${source}` }))
          )
          const { quantity } = yield* rember.generateCardsAndCreateRembs({ notes: notesRember })
          return `${quantity} rembs have been created. The number of created flashcards is unknown, report to the user something like "I've created ${quantity} rembs in Rember, each remb contains multiple flashcards. You can review your flashcards at https://rember.com/review".`
        }),
        Effect.catchTag("Api/ReachedLimitUsageTracker", (_) =>
          Effect.succeed(
            "The user reached the monthly limit for their Rember account. Instruct the user to visit https://rember.com/settings/account to upgrade to Rember Pro, which includes 1000 monthly rembs with high-quality AI generated flashcards."
          )),
        Effect.catchTag("Api/ErrorReachedLimitQuantity", (_) =>
          Effect.succeed(
            "You can send at most 50 notes in a single request to the Rember API"
          )),
        Effect.catchTag("Api/ApiKeyInvalid", (_) =>
          Effect.succeed(
            "The API key of the user is invalid, instruct the user to visit https://www.rember.com/settings/mcp-api and update the API key in your configs."
          )),
        Effect.mapError((error) => new ErrorToolMCP({ message: error.message }))
      ))
  })
)
