# Rember Model Context Protocol

The Rember [Model Context Protocol](https://modelcontextprotocol.com/) server allows you to integrate with Rember's spaced repetition system through function calling. This protocol supports tools to interact with Rember to generate flashcards and create rembs.

![Rember MCP Demo](https://github.com/rember/rember-mcp/blob/main/assets/what-is-active-recall.gif?raw=true)

## Setup

To run the Rember MCP server using npx, use the following command:

```
npx -y @getrember/mcp --api-key=YOUR_REMBER_API_KEY
```

Make sure to replace `YOUR_REMBER_API_KEY` with your actual Rember api key, which you can find in your [Settings page](https://rember.com/settings#rember-mcp-server). The API key should follow the format `rember_` followed by 32 random characters.

### Usage with Claude Desktop

Add the following to your `claude_desktop_config.json`. See [here](https://modelcontextprotocol.io/quickstart/user) for more details.

```json
{
  "mcpServers": {
    "rember": {
      "command": "npx",
      "args": ["-y", "@getrember/mcp", "--api-key=YOUR_REMBER_API_KEY"]
    }
  }
}
```

## Available tools

- `create_flashcards`: Create flashcards with AI. This tool takes a list of concise notes and generates a few flashcards for each using the Rember API. In Rember, we call "remb" each unit of note plus flashcards. After learning something new in your chat with Claude, you can ask "Add to Rember" to make sure you don't forget.
