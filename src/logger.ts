import { Logger } from "effect"

// #:

export const layerLogger = Logger.replace(
  Logger.defaultLogger,
  Logger.prettyLogger({
    // We are currently using stdio as MCP transport, therefore we cannot log
    // on stdout, we have to log in stderr.
    stderr: true,
    colors: true,
    mode: "tty"
  })
)
