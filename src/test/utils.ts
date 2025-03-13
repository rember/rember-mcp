import { type AiChat, AiInput, type AiToolkit } from "@effect/ai"
import { Chunk, Console, Effect, Option, pipe, String } from "effect"

// #:

export const logHistory = ({ chat, label }: { label: string; chat: AiChat.AiChat.Service }) =>
  Effect.gen(function*() {
    const history = yield* chat.history

    yield* Console.log(String.repeat(40)("="))
    yield* Console.log(String.padEnd(40, "=")(`${label} `))
    yield* Console.log(String.repeat(40)("="))
    for (const message of history) {
      yield* Console.log(`\x1b[33m${String.toUpperCase(message.role._tag)}\x1b[0m`)
      for (const part of message.parts) {
        if (part._tag === "Text") {
          const content = pipe(
            part.content,
            String.replace(/<document>(.*?)<\/document>/gs, "<document>...</document>")
          )
          yield* Console.log(content)
        }
        if (part._tag === "ToolCall") {
          yield* Console.log(`\x1b[34minput [${part.id}] \x1b[1m${part.name}\x1b[22m\x1b[0m`)
          yield* Console.log(`\x1b[34m${JSON.stringify(part.params, null, 2)}\x1b[0m`)
        }
        if (part._tag === "ToolCallResolved") {
          yield* Console.log(`\x1b[34moutput [${part.toolCallId}]\x1b[0m`)
          yield* Console.log(`\x1b[34m${part.value}\x1b[0m`)
        }
      }
    }
    yield* Console.log("\n\n")
  })

// #:

export const unrollToolCalls = <Tools extends AiToolkit.Tool.AnySchema>(
  { chat, limit, tools }: { chat: AiChat.AiChat.Service; tools: AiToolkit.Handlers<Tools>; limit: number }
) =>
  Effect.gen(function*() {
    let count = 0
    while (count < limit) {
      const history = yield* chat.history
      const messageLast = Chunk.last(history)
      if (Option.isNone(messageLast)) break
      if (messageLast.value.role._tag !== "Model") break
      const partLast = Chunk.last(messageLast.value.parts)
      if (Option.isNone(partLast)) break
      if (partLast.value._tag !== "ToolCallResolved") break

      yield* chat.toolkit({ input: AiInput.empty, tools })
      count++
    }
  })

// #:

export const computeTextModel = (
  { chat }: { chat: AiChat.AiChat.Service }
) =>
  Effect.gen(function*() {
    const history = yield* chat.history

    let text = ""
    let found = false
    for (const message of history) {
      if (message.role._tag === "Model") {
        for (const part of message.parts) {
          if (part._tag === "Text") {
            text += found ? "\n\n" + part.content : part.content
            found = true
          }
        }
      }
    }
    return text
  })
