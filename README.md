# Rember Model Context Protocol

The Rember [Model Context Protocol](https://modelcontextprotocol.com/) server allows you to integrate with Rember's spaced repetition system through function calling. This protocol supports tools to interact with Rember to generate flashcards and create rembs.

## Setup

To run the Rember MCP server using npx, use the following command:

```
npx -y @rember/mcp --api-key=YOUR_REMBER_API_KEY
```

Make sure to replace `YOUR_REMBER_API_KEY` with your actual Rember api key, which you can find in your [Settings page](https://rember.com/settings). The API key should follow the format `rember_` followed by 32 random characters.

### Usage with Claude Desktop

Add the following to your `claude_desktop_config.json`. See [here](https://modelcontextprotocol.io/quickstart/user) for more details.

```json
{
  "mcpServers": {
    "rember": {
      "command": "npx",
      "args": ["-y", "@rember/mcp", "--api-key=YOUR_REMBER_API_KEY"]
    }
  }
}
```

## Available tools

- `generate-cards-and-create-rembs`: This tool takes a list of little notes and turns each into a remb by generating flashcards with AI. A 'Remb' is the primary unit in Rember - a self-contained atomic note representing a concept the user wants to remember, along with spaced repetition flashcards for testing that concept. For example, after learning something new in your chat you can ask the language model to "Add to Rember".
