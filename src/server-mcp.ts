// TODO: Add spans for observability
import type { AiToolkit } from "@effect/ai"
import * as MCP from "@modelcontextprotocol/sdk/server/index.js"
import * as MCPstdio from "@modelcontextprotocol/sdk/server/stdio.js"
import type { ListToolsResult } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { Cause, Context, Data, Effect, HashMap, Layer, Option, pipe, Runtime, Schema, String } from "effect"
import * as JsonSchema from "effect/JSONSchema"
import * as AST from "effect/SchemaAST"

// #:

// Errors related to the `ServerMCP` service.
export class ErrorServerMCP extends Data.TaggedError("ErrorServerMCP")<{
  message: string
  error?: unknown
}> {}

// Errors related to the tool calls implemented outside this file and passed to
// the `ServerMCP` server.
export class ErrorToolMCP extends Schema.TaggedError<ErrorToolMCP>()("ErrorToolMCP", {
  message: Schema.String
}) {}

// #:

export class ServerMCP extends Context.Tag("ServerMCP")<
  ServerMCP,
  Effect.Effect.Success<ReturnType<typeof makeServerMCP>>
>() {}

// TODO: `AiToolkit` allows any kind of tool `success` schema in `AiToolkit.Tool.AnySchema`.
// We want to restict it to `CallToolResult` for the MCP. Currently we throw an
// error at runtime. Moreover `AiToolkit.Tool.AnySchema` introduces a `unknown`
// Effect requirement whenever we decode/encode with it, it would be nicer to make
// the `R` generic explicit.
export const makeServerMCP = <Tools extends AiToolkit.Tool.AnySchema, R>({
  name,
  tools,
  version
}: {
  name: string
  version: string
  tools: AiToolkit.Handlers<Tools, R>
}) =>
  Effect.gen(function*() {
    const runtime = yield* Effect.runtime<R>()

    const server = yield* Effect.try({
      try: () => new MCP.Server({ name, version }),
      catch: (error) => new ErrorServerMCP({ message: "Failed to construct Server", error })
    })
    const transport = yield* Effect.try({
      try: () => new MCPstdio.StdioServerTransport(),
      catch: (error) => new ErrorServerMCP({ message: "Failed to construct StdioServerTransport", error })
    })

    // ##: Register tools

    // See TODO on `makeServerMCP`.
    for (const [, tool] of tools.toolkit.tools) {
      if (tool.success !== Schema.String) {
        return yield* Effect.dieMessage("All tool `success` schemas must be `Schema.String`")
      }
    }

    // Register the "tools" capabilities, i.e. advertise to the client that this
    // server supports tools.
    yield* Effect.try({
      try: () => server.registerCapabilities({ tools: {} }),
      catch: (error) => new ErrorServerMCP({ message: "Failed to register tools capabilities", error })
    })

    // Conver tools to a format suitable for the MCP SDK
    const arrayTools: Array<{
      name: string
      description: string
      inputSchema: JsonSchema.JsonSchema7
    }> = []
    for (const [, tool] of tools.toolkit.tools) {
      arrayTools.push(convertTool(tool._tag, tool as any))
    }

    // Handle the tools/list request from the client
    yield* Effect.try({
      try: () =>
        server.setRequestHandler(
          ListToolsRequestSchema,
          // NOTE: Casting to `any` because of incompatibility in how JSON Schema 7
          // is represented at the type level between Effect and the MCP SDK.
          (): ListToolsResult => ({ tools: arrayTools as any })
        ),
      catch: (error) => new ErrorServerMCP({ message: "Failed to register tools/list handler", error })
    })

    yield* Effect.try({
      try: () =>
        server.setRequestHandler(
          CallToolRequestSchema,
          (request, { signal }) =>
            pipe(
              Effect.gen(function*() {
                // See `converTool` below
                const tagTool = String.snakeToPascal(request.params.name)

                // Find the tool being called
                const optionTool = HashMap.get(tools.toolkit.tools, tagTool)
                if (Option.isNone(optionTool)) {
                  return yield* new ErrorServerMCP({ message: `Tool '${tagTool}' not found` })
                }
                const tool = optionTool.value

                // Find the handler for the tool being called.
                // NOTE: We assume that if the tool is found, the corresponding
                // handler can always be found.
                const handler = HashMap.unsafeGet(tools.handlers, tagTool)

                // Decode the input for the tool call
                const params = yield* pipe(
                  Schema.decodeUnknown(tool as any)({
                    ...request.params.arguments,
                    _tag: tagTool
                  }),
                  Effect.mapError((error) =>
                    new ErrorServerMCP({
                      message: `Failed to decode tool call '${tagTool}' parameters`,
                      error
                    })
                  )
                )

                // Handle the tool call
                const result = yield* handler(params)

                // Encode the tool call result
                const resultText = yield* pipe(
                  Schema.encodeUnknown(tool.success)(result),
                  Effect.mapError((error) =>
                    new ErrorServerMCP({
                      message: `Failed to encode tool call '${tagTool}' result`,
                      error
                    })
                  )
                )
                // See TODO on `makeServerMCP`.
                if (typeof resultText !== "string") {
                  return yield* Effect.dieMessage("Tool call result must be string")
                }

                // Return the result in the format MCP expects.
                return { content: [{ type: "text", text: resultText }] }
              }),
              // Report errors
              // Note that for `ErrorServerMCP` and `ErrorToolMCP` we report the
              // error message to the MCP client. For all other errors we report
              // the entire cause.
              Effect.catchAllCause((cause) =>
                Effect.gen(function*() {
                  if (Cause.isInterruptedOnly(cause)) {
                    return { content: [{ type: "text", text: "The tool call was interruped" }], isError: true }
                  }
                  if (Cause.isFailType(cause) && cause.error instanceof ErrorServerMCP) {
                    yield* Effect.logError(cause.error)
                    return { content: [{ type: "text", text: cause.error.message }], isError: true }
                  }
                  if (Cause.isFailType(cause) && cause.error instanceof ErrorToolMCP) {
                    yield* Effect.logError(cause.error)
                    return { content: [{ type: "text", text: cause.error.message }], isError: true }
                  }
                  yield* Effect.logError(cause)
                  return { content: [{ type: "text", text: Cause.pretty(cause) }], isError: true }
                })
              ),
              // See TODO on `makeServerMCP` for why we cast `effect`.
              (effect) => Runtime.runPromise(runtime)(effect as Effect.Effect<any, never, R>, { signal })
            )
        ),
      catch: (error) => new ErrorServerMCP({ message: "Failed to register tool call handler", error })
    })

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

// #:

export function layerServerMCP<Tools extends AiToolkit.Tool.AnySchema>(
  { name, tools, version }: { name: string; version: string; tools: AiToolkit.Handlers<Tools> }
): Layer.Layer<ServerMCP, ErrorServerMCP, never>
export function layerServerMCP<Tools extends AiToolkit.Tool.AnySchema, R>(
  { name, tools, version }: { name: string; version: string; tools: AiToolkit.Handlers<Tools, R> }
): Layer.Layer<ServerMCP, ErrorServerMCP, R> {
  return Layer.scoped(ServerMCP, makeServerMCP<Tools, R>({ name, version, tools }))
}

// #: convertTool, makeJsonSchema, getDescription
// These functions are taken from the internals of @effect/ai. Changes:
// - ignore the `structured` in `convertTool`
// - transform the tool name to snake-case, which is the convention for MCP tools
// - rename `parameters` to `inputSchema`, which is what the MCP SDK expects
// REFS: https://github.com/Effect-TS/effect/blob/22d2ebb4b11f5a44351a4736e65da391a3b647d0/packages/ai/ai/src/Completions.ts#L311-L341

const convertTool = <A, I, R>(
  name: string,
  schema: Schema.Schema<A, I, R>
) => ({
  name: String.pascalToSnake(name),
  description: getDescription(schema.ast),
  inputSchema: makeJsonSchema(AST.omit(schema.ast, ["_tag"]))
})

const makeJsonSchema = (ast: AST.AST): JsonSchema.JsonSchema7 => {
  const $defs = {}
  const schema = JsonSchema.fromAST(ast, {
    definitions: $defs,
    topLevelReferenceStrategy: "skip"
  })
  if (Object.keys($defs).length === 0) return schema
  ;(schema as any).$defs = $defs
  return schema
}

const getDescription = (ast: AST.AST): string => {
  const annotations = ast._tag === "Transformation"
    ? {
      ...ast.to.annotations,
      ...ast.annotations
    }
    : ast.annotations
  return AST.DescriptionAnnotationId in annotations
    ? (annotations[AST.DescriptionAnnotationId] as string)
    : ""
}
