import { FetchHttpClient, HttpClient, HttpClientRequest } from "@effect/platform"
import { Context, Effect, Layer, pipe, Redacted, Schema } from "effect"

// #:

/** API keys have a "rember_" prefix followed by 32 random characters */
export const ApiKey = Schema.String.pipe(
  Schema.pattern(/^rember_[a-f0-9]{32}$/),
  Schema.brand("ApiKey")
)
export type ApiKey = Schema.Schema.Type<typeof ApiKey>

/** A note with text of maximum 2000 chars */
export const Note = Schema.Struct({
  text: Schema.String.pipe(Schema.maxLength(2000))
})
export type Note = Schema.Schema.Type<typeof Note>

/** An array of `Note` */
export const Notes = Schema.Array(Note).pipe(Schema.maxItems(50))
export type Notes = Schema.Schema.Type<typeof Notes>

// #:

export class Rember extends Context.Tag("Rember")<
  Rember,
  Effect.Effect.Success<ReturnType<typeof makeRember>>
>() {
  static layer(
    { apiKey }: { apiKey: Redacted.Redacted<ApiKey> }
  ): Layer.Layer<Rember> {
    return pipe(
      Layer.effect(Rember, makeRember({ apiKey })),
      Layer.provide(FetchHttpClient.layer)
    )
  }
}

// #:

export const makeRember = ({ apiKey }: { apiKey: Redacted.Redacted<ApiKey> }) =>
  Effect.gen(function*() {
    const client = yield* HttpClient.HttpClient

    // ##: generateCards

    const generateCardsAndCreateRembs = ({ notes }: { notes: Notes }) =>
      pipe(
        HttpClientRequest.post(
          "https://www.rember.com/api/v1/generate-cards-and-create-rembs"
        ),
        HttpClientRequest.setHeader("x-api-key", Redacted.value(apiKey)),
        HttpClientRequest.setHeader("x-source", "rember-mcp"),
        HttpClientRequest.bodyJson({ version: "1", notes }),
        Effect.flatMap(client.execute),
        // Ensure the request is aborted if the program is interrupted
        Effect.scoped
      )

    // ##:

    return {
      generateCardsAndCreateRembs
    }
  })
