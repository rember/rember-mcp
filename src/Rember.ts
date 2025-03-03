import { FetchHttpClient, HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Context, Effect, Layer, pipe, Redacted, Schema } from "effect"

// #: Values

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

// #: Api

// prettier-ignore
export class ErrorApiKeyInvalid extends Schema.TaggedError<ErrorApiKeyInvalid>()(
  "Api/ApiKeyInvalid",
  { message: Schema.String }
) {}

// prettier-ignore
export class ErrorReachedLimitRateLimiter extends Schema.TaggedError<ErrorReachedLimitRateLimiter>()(
  "Api/ReachedLimitRateLimiter",
  { message: Schema.String }
) {}

// prettier-ignore
export class ErrorReachedLimitUsageTracker extends Schema.TaggedError<ErrorReachedLimitUsageTracker>()(
  "Api/ReachedLimitUsageTracker",
  { message: Schema.String }
) {}

const endpointGenerateCardsAndCreateRembs = HttpApiEndpoint.post(
  "generateCardsAndCreateRembs",
  "/v1/generate-cards-and-create-rembs"
)
  .setPayload(
    Schema.Struct({
      version: Schema.Literal("1"),
      notes: Notes
    })
  )
  .setHeaders(
    Schema.Struct({
      "x-api-key": ApiKey,
      "x-source": Schema.String
    })
  )
  .addError(ErrorApiKeyInvalid, { status: 401 })
  .addError(ErrorReachedLimitUsageTracker, { status: 403 })
  .addError(ErrorReachedLimitRateLimiter, { status: 429 })

const groupV1 = HttpApiGroup.make("v1").add(endpointGenerateCardsAndCreateRembs)

const apiRember = HttpApi.make("Rember").add(groupV1).prefix("/api")

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
    const client = yield* HttpApiClient.make(apiRember, { baseUrl: "https://www.rember.com/" })

    // ##: generateCards

    const generateCardsAndCreateRembs = ({ notes }: { notes: Notes }) =>
      client.v1.generateCardsAndCreateRembs({
        payload: { version: "1", notes },
        headers: { "x-api-key": Redacted.value(apiKey), "x-source": "rember-mcp" }
      })

    // ##:

    return {
      generateCardsAndCreateRembs
    }
  })
