# Example workflows

To import one, open a new workflow in n8n and use **⋯ → Import from File**. You can also copy the file's contents and paste them onto the canvas. Neither file contains credentials, so you'll pick your own after importing.

Both use node versions found in n8n 1.122 and n8n 2.46, so they should import into either version or anything newer. Creating decks uses credits from your Presentations.AI workspace.

## Form → Presentations.AI node → deck file

[`form-to-presentations-ai-deck.json`](form-to-presentations-ai-deck.json)

```
n8n Form Trigger → Presentations.AI: Create From Topic → n8n Form (Form Ending: Return Binary File)
```

Someone fills in a form with **Topic**, **Slide Count** and **Export Format** (PPTX, PDF or Image). The Presentations.AI node creates the deck and waits for it. Then the form's last page downloads the file in their browser.

Before you run it:

1. Install this package (see the [main README](../README.md#installation)).
2. Open the **Create the presentation** node and select or create a **Presentations.AI API** credential.
3. Click **Execute workflow** and fill in the test form. Publish or activate the workflow to use the production form URL.

A deck usually takes 2–4 minutes, and the form page waits until it's ready. If the deck isn't ready within the node's **Max Wait (Seconds)** (600), the node returns without a file. The last page then fails with "No binary data with field data found". Raise Max Wait if you make large decks.

## AI Agent makes a deck via Presentations.AI MCP

[`ai-agent-presentations-ai-mcp.json`](ai-agent-presentations-ai-mcp.json)

```
Chat with the assistant → Presentation assistant (AI Agent)
                 ├─ Planning model (chat model)
                 ├─ Conversation memory (Simple Memory)
                 └─ MCP Client Tool → https://api.presentations.ai/mcp
```

You chat with an AI Agent that can use the Presentations.AI MCP server's tools: creating decks, checking progress, downloading, and finding earlier decks and brand kits. **Tools to Include** is set to **Selected** with only the tools this workflow needs: `whoami`, `create_presentation`, `get_task`, `get_export`, `list_decks`, `get_deck`, `search_brand_kits`, and `list_projects`. Tools that delete, edit, share or grant access to decks aren't given to the agent, and new server tools aren't added automatically. Add `share_deck` yourself only if the agent should create public links. This workflow doesn't need this package installed.

Before you run it:

1. **Planning model** (the chat model): select a credential for it, or replace it with any chat model sub-node you have credentials for.
2. **Presentations.AI MCP** (the MCP Client Tool): create a **Bearer Auth** credential and paste a Presentations.AI API key (the **Deck automation** preset works, as does **MCP client**) (`pai_live_…`, from [api.presentations.ai](https://api.presentations.ai/#/apikeys)) as the **Bearer Token**.
   - Or switch **Authentication** to **MCP OAuth2**. Create an MCP OAuth2 API credential with **Use Dynamic Client Registration** on and **Server URL** set to `https://api.presentations.ai/mcp`, then sign in with your Presentations.AI account. You don't need a key.
3. Open the chat and ask for a deck, for example: _Make a 6-slide deck introducing example.com to new customers._

Settings to know:

- The MCP Client Tool's **Timeout** is raised to 180000 ms (3 minutes), because waiting for a deck can take up to a minute per call. The n8n default is 60000.
- The agent's **Max Iterations** is raised to 15 so it can keep checking until the deck is done.
- The agent replies with a download link, which expires after 15 minutes. It can't create public share links unless you add `share_deck` to **Tools to Include**.
- **Conversation memory** (Simple Memory) lets follow-up messages refer to the deck you just made, such as "now make one for the sales team".

> Checked against n8n's node source, not yet tested end to end.
