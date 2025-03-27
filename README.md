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

## Best practices for building MCP servers

Here's a collection of lessons we learned while developing the Rember MCP server:

- Set up logging to `stderr` as early as possible, it's essential for debugging
- Create a simple MCP tool first and verify Claude can call it properly
- Invest time in iterating on the tool description:

  - Include details about your product and its URL. This serves two purposes: it helps Claude use the tool properly and allows Claude to answer user questions about the product
  - Clearly explain what MCP is, in a few instances Claude hallucinated that MCP stands for "Multiple Choice Prompts", yikes
  - Describe the tool inputs thoroughly
  - Explain what happens after Claude calls the tool, we clarify that the input notes array is sent to the Rember API, which generates flashcards for each note
  - Provide examples of how the tool can be used (e.g., "create flashcards from a conversation with Claude," "create flashcards from PDFs"), and give Claude specific instructions for each use case
  - List examples of how users might invoke the tool (e.g., "help me remember this," "add to Rember," "create a few flashcards")
  - Include a list of rules to guide Claude in using the tool appropriately

- Use the tool call response strategically, it's not shown directly to users but interpreted by Claude:
  - On success, the Rember API does not return the number of created flashcards, all Claude knows is the number of created rembs. We specify this to Claude because otherwise it tends to hallucinate the number of created flashcards
  - For users who've reached their monthly limit, we instruct Claude to inform them about the Rember Pro subscription option with the relevant URL
- Implement retries for transient errors with suitable timeouts
- We collected enough edge cases that testing manually on Claude Desktop (our main target MCP client) became cumbersome. We created a suite of unit tests by simulating Claude Desktop behavior by calling the Claude API with the system prompt from claude.ai. In the current iteration, each test simulates a chat with Claude Desktop for manual inspection and includes a few simple assertions

What's missing:

- Telemetry and observability, currently we are blind if something goes wrong
- More exhaustive error handling
- More iterations on the tool description
- More automated tests
