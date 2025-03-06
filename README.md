# Rember MCP

Allow Claude to create flashcards for you with the official [Model Context Protocol (MCP)](https://modelcontextprotocol.com/) for [Rember](https://rember.com/). Rember helps you study and remember anything you care about by scheduling spaced repetition reviews.

Features and examples:

- **Create flashcards from your chats** _"... I like your answer, help me remember it"_
- **Create flashcards from your PDFs** _"Create flashcards from chapter 2 of this PDF"_

![Rember MCP Demo](https://github.com/rember/rember-mcp/blob/main/assets/what-is-active-recall.gif?raw=true)

## Setup

To run the Rember MCP server using `npx`, use the following command:

```
npx -y @getrember/mcp --api-key=YOUR_REMBER_API_KEY
```

Make sure to replace `YOUR_REMBER_API_KEY` with your actual Rember api key, which you can find in your [Settings page](https://rember.com/settings/mcp-api). The API key should follow the format `rember_` followed by 32 random characters.

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

- `create_flashcards`: Create flashcards with AI. This tool takes a list of notes from Claude, it calls the Rember API to generate a few flashcards for each note. After learning something new in your chat with Claude, you can ask "help me remember this" or "create a few flashcards" or "add to Rember".
