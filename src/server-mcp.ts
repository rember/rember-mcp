// TODO: There is likely a better way to wrap @modelcontextprotocol/sdk in Effect,
// like https://github.com/IMax153/advanced-effect-workshop/blob/main/workshop/solutions/session-01/project/advanced.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { Cause, Context, Effect, Layer, pipe, Record, Runtime } from "effect"
import type { ReadonlyRecord } from "effect/Record"
import type { z, ZodRawShape, ZodTypeAny } from "zod"

// #:

// TODO: The MCP SDK does not support Standard Schema just yet (which would
// allow us to use Effect Schema).
// Track https://github.com/modelcontextprotocol/typescript-sdk/issues/164
export interface ToolServerMCP<Input extends ZodRawShape, R> {
  description: string
  schemaInput: Input
  effect: (args: z.objectOutputType<Input, ZodTypeAny>) => Effect.Effect<CallToolResult, never, R>
}

export type ToolServerMCPAny = ToolServerMCP<any, any>
export type ToolsServerMCPAny = ReadonlyRecord<string, ToolServerMCPAny>

// #:

export class ServerMCP extends Context.Tag("ServerMCP")<
  ServerMCP,
  Effect.Effect.Success<ReturnType<typeof makeServerMCP>>
>() {
  static layer<ToolsServerMCP extends ToolsServerMCPAny>(
    { name, tools, version }: { name: string; version: string; tools: ToolsServerMCP }
  ): Layer.Layer<ServerMCP, never, never>
  static layer<ToolsServerMCP extends ToolsServerMCPAny, R>(
    { name, tools, version }: { name: string; version: string; tools: ToolsServerMCP }
  ): Layer.Layer<ServerMCP, never, R> {
    return Layer.scoped(ServerMCP, makeServerMCP<ToolsServerMCP, R>({ name, version, tools }))
  }
}

// #:

export const makeServerMCP = <ToolsServerMCP extends ToolsServerMCPAny, R>(
  { name, tools, version }: { name: string; version: string; tools: ToolsServerMCP }
) =>
  Effect.gen(function*() {
    const server = yield* Effect.sync(() => new McpServer({ name, version }))
    const transport = yield* Effect.sync(() => new StdioServerTransport())

    const runtime = yield* Effect.runtime<R>()

    // ##: Register tools

    for (const [name, tool] of Record.toEntries(tools)) {
      yield* Effect.sync(() =>
        server.tool(
          name,
          tool.description,
          tool.schemaInput,
          (args, { signal }) =>
            pipe(
              tool.effect(args),
              // Report errors
              Effect.tapErrorCause((cause) => {
                if (Cause.isInterruptedOnly(cause)) {
                  return Effect.void
                }
                return Effect.logError(cause)
              }),
              (effect) => Runtime.runPromise(runtime)(effect, { signal })
            )
        )
      )
    }

    // ##: Connect

    yield* Effect.acquireRelease(
      // `server.connect` starts the transport and starts listening for messages
      Effect.promise(() => server.connect(transport)),
      // `server.close` closes the transport
      () => Effect.promise(() => server.close())
    )

    // ##:

    return {
      server
    }
  })
