# Rember Model Context Protocol

The Rember [Model Context Protocol](https://modelcontextprotocol.com/) server allows you to integrate with Rember's spaced repetition system through function calling. This protocol supports tools to interact with Rember's services to generate flashcards from notes.

### Usage with Claude Desktop

TODO: Publish npm package, so that the server can be run with `npx` without having to clone, install and build.

Clone this GitHub project, run `pnpm install` and `pnpm build`.

Add the following to your `claude_desktop_config.json`. See [here](https://modelcontextprotocol.io/quickstart/user) for more details.

Make sure to replace `YOUR_REMBER_API_KEY` with your actual Rember API key. The API key should follow the format `rember_` followed by 32 random characters.

```json
{
  "mcpServers": {
    "rember": {
      "command": "node",
      "args": [
        "/absolute/path/to/dist/bin.cjs",
        "--api-key=YOUR_REMBER_API_KEY"
      ]
    }
  }
}
```

## Available tools

- `generate-cards-and-create-rembs`: Generate spaced-repetition flashcards from notes and create Rembs. A 'Remb' is the primary unit in Rember - a self-contained atomic note representing a concept the user wants to remember, along with spaced repetition flashcards for testing that concept.
