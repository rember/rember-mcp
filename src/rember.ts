import { HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup, HttpClient } from "@effect/platform"
import { Config, Context, Effect, Layer, pipe, Schedule, Schema } from "effect"

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

// prettier-ignore
export class ErrorReachedLimitQuantity extends Schema.TaggedError<ErrorReachedLimitQuantity>()(
  "Api/ErrorReachedLimitQuantity",
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
  .addSuccess(
    Schema.Union(
      Schema.Struct({
        quantity: Schema.Number,
        usageMonth: Schema.Number,
        maxUsageMonth: Schema.Number
      })
    )
  )
  .addError(ErrorApiKeyInvalid, { status: 401 })
  .addError(ErrorReachedLimitQuantity, { status: 400 })
  .addError(ErrorReachedLimitUsageTracker, { status: 403 })
  .addError(ErrorReachedLimitRateLimiter, { status: 429 })

const groupV1 = HttpApiGroup.make("v1").add(endpointGenerateCardsAndCreateRembs)

const apiRember = HttpApi.make("Rember").add(groupV1).prefix("/api")

// #:

export class Rember extends Context.Tag("Rember")<
  Rember,
  Effect.Effect.Success<typeof makeRember>
>() {}

// #:

export const makeRember = Effect.gen(function*() {
  const client = yield* HttpApiClient.make(apiRember, {
    baseUrl: "https://www.rember.com/",
    transformClient: HttpClient.retryTransient({
      times: 3,
      schedule: Schedule.exponential("2 seconds")
    })
  })

  const apiKeyEnc = yield* Config.string("REMBER_API_KEY")
  const apiKey = yield* pipe(
    apiKeyEnc,
    Schema.decodeUnknown(ApiKey),
    Effect.catchTag("ParseError", () => Effect.dieMessage("Invalid API key"))
  )

  // ##: generateCards

  const generateCardsAndCreateRembs = ({ notes }: { notes: Notes }) =>
    client.v1.generateCardsAndCreateRembs({
      payload: { version: "1", notes },
      headers: { "x-api-key": apiKey, "x-source": "rember-mcp" }
    })

  // ##:

  return {
    generateCardsAndCreateRembs
  }
})

// #:

export const layerRember = Layer.effect(Rember, makeRember)
