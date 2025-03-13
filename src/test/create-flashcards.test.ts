import { AiChat } from "@effect/ai"
import { AnthropicClient, AnthropicCompletions } from "@effect/ai-anthropic"
import { FileSystem } from "@effect/platform"
import { NodeContext, NodeHttpClient } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Chunk, Config, DateTime, Effect, Layer, pipe, Schema, String } from "effect"
import { ErrorReachedLimitUsageTracker, Rember } from "../rember.js"
import { layerTools, ToolCreateFlashcards, toolkit } from "../tools.js"
import { computeTextModel, logHistory, unrollToolCalls } from "./utils.js"

// #: Layers

// Set to true to run with the Claude.ai system prompt (it's more expensive but more realistic)
const ENABLE_SYSTEM_PROMPT = true

const layerCompletions = pipe(
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem

    // The system prompt can be found at https://docs.anthropic.com/en/release-notes/system-prompts#feb-24th-2025
    const now = yield* DateTime.now
    const systemPromptClaude = yield* pipe(
      fs.readFileString("./src/test/system-prompt-claude-2025-02-24.md"),
      Effect.map(String.replace("{{currentDateTime}}", DateTime.formatIso(now)))
    )

    return AnthropicCompletions.layerCompletions({
      model: "claude-3-7-sonnet-20250219",
      config: {
        system: ENABLE_SYSTEM_PROMPT ? systemPromptClaude : undefined,
        max_tokens: 2000
      }
    })
  }),
  Layer.unwrapEffect
)

const layerAnthropicClient = AnthropicClient.layerConfig({
  apiKey: Config.redacted("ANTHROPIC_API_KEY")
})

const layerRemberSucceed = Layer.succeed(Rember, {
  generateCardsAndCreateRembs: () => Effect.void
})

const layerRemberFailReachedLimitUsageTracker = Layer.succeed(Rember, {
  generateCardsAndCreateRembs: () =>
    Effect.fail(
      new ErrorReachedLimitUsageTracker({ message: `Usage limit reached for feature 'generateCards': 30/30` })
    )
})

const layerSucceed = pipe(
  Layer.mergeAll(layerCompletions, layerTools),
  Layer.provideMerge(layerRemberSucceed),
  Layer.provideMerge(layerAnthropicClient),
  Layer.provideMerge(NodeHttpClient.layerUndici),
  Layer.provideMerge(NodeContext.layer)
)

const layerFailReachedLimitUsageTracker = pipe(
  Layer.mergeAll(layerCompletions, layerTools),
  Layer.provideMerge(layerRemberFailReachedLimitUsageTracker),
  Layer.provideMerge(layerAnthropicClient),
  Layer.provideMerge(NodeHttpClient.layerUndici),
  Layer.provideMerge(NodeContext.layer)
)

// #: Postdam conference

it.live("Postdam conference", ({ task }) =>
  Effect.gen(function*() {
    const tools = yield* toolkit
    const chat = yield* AiChat.empty

    yield* chat.toolkit({
      input: "Create a remb on the Postdam conference",
      tools
    })
    yield* unrollToolCalls({ chat, tools, limit: 2 })

    const history = yield* chat.history
    yield* logHistory({ chat, label: task.name })

    // ##: Test model message 0

    const messageModel0 = pipe(
      history,
      Chunk.filter((_) => _.role._tag === "Model"),
      Chunk.unsafeGet(0)
    )

    const partsToolCallMessageModel0 = pipe(
      messageModel0.parts,
      Chunk.filter((_) => _._tag === "ToolCall"),
      Chunk.toArray
    )
    expect(partsToolCallMessageModel0).toHaveLength(1)

    const inputToolCall0MessageModel0 = pipe(
      messageModel0.parts,
      Chunk.filter((_) => _._tag === "ToolCall"),
      Chunk.unsafeGet(0),
      (_) => ({ _tag: String.snakeToPascal(_.name), ...(_.params as any) }),
      Schema.decodeUnknownSync(ToolCreateFlashcards)
    )
    expect(inputToolCall0MessageModel0.notes).toHaveLength(1)

    // ##: Test model message 1

    const messageModel1 = pipe(
      history,
      Chunk.filter((_) => _.role._tag === "Model"),
      Chunk.unsafeGet(1)
    )

    const partText0MessageModel1 = pipe(
      messageModel1.parts,
      Chunk.filter((_) => _._tag === "Text"),
      Chunk.unsafeGet(0)
    )
    expect(partText0MessageModel1.content).toContain("1 remb")
    expect(partText0MessageModel1.content).toContain("https://rember.com/review")
  }).pipe(
    Effect.provide(layerSucceed)
  ))

// #: Deficit vs Debt

it.live("Deficit vs Debt", ({ task }) =>
  Effect.gen(function*() {
    const tools = yield* toolkit
    const chat = yield* AiChat.empty

    yield* chat.toolkit({
      input: "What's the definition of deficit? What's the difference with debt?",
      tools
    })
    yield* chat.toolkit({
      input: "Help me remember this",
      tools
    })
    yield* unrollToolCalls({ chat, tools, limit: 2 })

    const history = yield* chat.history
    yield* logHistory({ chat, label: task.name })

    // ##: Test model message 0

    const messageModel0 = pipe(
      history,
      Chunk.filter((_) => _.role._tag === "Model"),
      Chunk.unsafeGet(0)
    )

    const partsToolCallMessageModel0 = pipe(
      messageModel0.parts,
      Chunk.filter((_) => _._tag === "ToolCall"),
      Chunk.toArray
    )
    expect(partsToolCallMessageModel0).toHaveLength(0)

    // ##: Test model message 1

    const messageModel1 = pipe(
      history,
      Chunk.filter((_) => _.role._tag === "Model"),
      Chunk.unsafeGet(1)
    )

    const partsToolCallMessageModel1 = pipe(
      messageModel1.parts,
      Chunk.filter((_) => _._tag === "ToolCall"),
      Chunk.toArray
    )
    expect(partsToolCallMessageModel1).toHaveLength(1)

    const inputToolCall0MessageModel1 = pipe(
      messageModel1.parts,
      Chunk.filter((_) => _._tag === "ToolCall"),
      Chunk.unsafeGet(0),
      (_) => ({ _tag: String.snakeToPascal(_.name), ...(_.params as any) }),
      Schema.decodeUnknownSync(ToolCreateFlashcards)
    )
    expect(inputToolCall0MessageModel1.notes).toHaveLength(1)
  }).pipe(
    Effect.provide(layerSucceed)
  ))

// #: Thesis chapter 2

it.live.only("Thesis chapter 2", ({ task }) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const tools = yield* toolkit
    const chat = yield* AiChat.empty

    const thesisChapter2 = yield* fs.readFileString("./src/test/thesis-chapter-2.md")

    yield* chat.toolkit({
      input: [
        ["<document>", thesisChapter2, "</document>"].join("\n"),
        pipe(
          `
          |I've attached chapter 2 from "Memory Models for Spaced Repetition Systems" by Giacomo Randazzo
          |
          |I'm only interested in:
          |- How DASH differs from IRT at a high level
          |- The formula for Duolingo's model
          |- Why is SM-17 important
          |
          |Add to Rember
          `,
          String.stripMargin,
          String.trim
        )
      ].join("\n\n---\n\n"),
      tools
    })
    yield* unrollToolCalls({ chat, tools, limit: 2 })

    const history = yield* chat.history
    yield* logHistory({ chat, label: task.name })

    // ##: Test model message 0

    const messageModel0 = pipe(
      history,
      Chunk.filter((_) => _.role._tag === "Model"),
      Chunk.unsafeGet(0)
    )

    const partsToolCallMessageModel0 = pipe(
      messageModel0.parts,
      Chunk.filter((_) => _._tag === "ToolCall"),
      Chunk.toArray
    )
    expect(partsToolCallMessageModel0).toHaveLength(1)

    const inputToolCall0MessageModel0 = pipe(
      messageModel0.parts,
      Chunk.filter((_) => _._tag === "ToolCall"),
      Chunk.unsafeGet(0),
      (_) => ({ _tag: String.snakeToPascal(_.name), ...(_.params as any) }),
      Schema.decodeUnknownSync(ToolCreateFlashcards)
    )
    expect(inputToolCall0MessageModel0.notes).toHaveLength(3)
    expect(inputToolCall0MessageModel0.source).toBeDefined()
    expect(inputToolCall0MessageModel0.source).toContain("Memory Models for Spaced Repetition Systems")
  }).pipe(
    Effect.provide(layerSucceed)
  ))

// #: Fail with usage tracker limit reached

it.live("Fail with usage tracker limit reached", ({ task }) =>
  Effect.gen(function*() {
    const tools = yield* toolkit
    const chat = yield* AiChat.empty

    yield* chat.toolkit({
      input: "Create a few flashcards on the postdam conference",
      tools
    })
    yield* unrollToolCalls({ chat, tools, limit: 2 })

    const history = yield* chat.history
    yield* logHistory({ chat, label: task.name })

    // ##: Test model message 1

    const messageModel1 = pipe(
      history,
      Chunk.filter((_) => _.role._tag === "Model"),
      Chunk.unsafeGet(1)
    )

    const partText0MessageModel1 = pipe(
      messageModel1.parts,
      Chunk.filter((_) => _._tag === "Text"),
      Chunk.unsafeGet(0)
    )
    expect(partText0MessageModel1.content).toContain("Rember Pro")
    expect(partText0MessageModel1.content).toContain("https://rember.com/settings/account")
  }).pipe(
    Effect.provide(layerFailReachedLimitUsageTracker)
  ))

// #: How to use Rember

it.live("How to use Rember", ({ task }) =>
  Effect.gen(function*() {
    const tools = yield* toolkit
    const chat = yield* AiChat.empty

    yield* chat.toolkit({
      input: "How can I use the MCP for Rember?",
      tools
    })
    yield* chat.toolkit({
      input: "How and where should I access these flashcards?",
      tools
    })

    const history = yield* chat.history
    yield* logHistory({ chat, label: task.name })

    // ##: Test model messages

    const messagesWithToolCalls0 = pipe(
      history,
      Chunk.filter((_) => _.role._tag === "Model" && Chunk.some(_.parts, (_) => _._tag === "ToolCall"))
    )
    expect(messagesWithToolCalls0).toHaveLength(0)

    const textModel = yield* computeTextModel({ chat })
    expect(textModel).not.toContain("Rember API")
    expect(textModel).toContain("https://rember.com")
  }).pipe(
    Effect.provide(layerFailReachedLimitUsageTracker)
  ))
