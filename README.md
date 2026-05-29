# @presentations-ai/n8n-nodes-presentations-ai

Official [n8n](https://n8n.io) community node for [Presentations.AI](https://presentations.ai) — generate, transform, and export AI-powered slide decks from your workflows.

## Installation

In n8n: **Settings → Community Nodes → Install** and enter `@presentations-ai/n8n-nodes-presentations-ai`.

For self-hosted installations, see [n8n's community node docs](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

1. In Presentations.AI, go to [console.presentations.ai](https://console.presentations.ai) and create an API key.
2. In n8n, create a new **Presentations.AI API** credential and paste the key (starts with `pai_`).
3. The default base URL is `https://api.presentations.ai`. Change it only if you're on a staging or self-hosted endpoint.

Click **Test** on the credential to verify it works before saving.

## Operations

### Presentation

- **Create From Topic** — generate a full deck from a single topic or brief. The most common starting point.
- **Create Single Slide** — generate one AI-designed slide. Good for title cards, summary slides, or one-off visuals.
- **Create From Content** — convert raw text (articles, notes, meeting transcripts) into a deck. Choose how aggressively to rewrite via *Preservation Mode*.
- **Create From File** — convert a PDF, DOCX, PPTX, TXT, MD, or RTF file (max 5 MB) into a deck. Pulls binary data from the previous node (defaults to the `data` property).

All creation ops export to PPTX, PPT, PDF, image, render (HTML preview), or share link.

### Job

- **Check Status** — poll an async generation by `job_id`. Returns `pending`, `completed`, or `failed`.

## Preservation Mode (Content / File ops)

Controls how the input is treated:

- **Enhance** — expand short input into full slides
- **Summarize** — condense long input into key slides
- **Preserve** — keep the input structure as-is (slide count auto-derived)
- **Instruction** — use the *Topic* field as a custom transformation prompt

## Async generation

Long decks can take more than a minute. Two patterns:

- **Webhook callback** — set *Callback URL* on the creation op. The op returns immediately with a `job_id` and Presentations.AI POSTs the finished deck to your URL when ready.
- **Polling** — set *Return Job ID Immediately* to `true`. Then use **Job → Check Status** in a loop (with a `Wait` node) until the status is `completed`.

## Common workflows

**Generate from a topic (simplest)**

```
Manual Trigger  →  Presentations.AI: Create From Topic  →  Set { document_url }
```

**Notes → deck**

```
Chat Trigger / Form Trigger  →  Presentations.AI: Create From Content  →  Reply with the URL
```

**PDF / DOCX → deck**

```
Webhook (file upload)  →  Presentations.AI: Create From File  →  Reply with the URL
```

**Bulk generation with async + polling**

```
Read rows from Google Sheets  →  Presentations.AI: Create From Topic (Return Job ID Immediately = true)  →  Save job_id to sheet

— separate scheduled workflow —
Read rows where status='pending'  →  Presentations.AI: Check Status  →  Update sheet when completed
```

## AI agent / tool use

This node has `usableAsTool: true`, so it's available to n8n's AI agents. An agent can call any of the operations directly when configured as a tool.

## Resources

- [Presentations.AI developer docs](https://console.presentations.ai/apiref/docs/)
- [n8n community node guide](https://docs.n8n.io/integrations/community-nodes/)
- [Report an issue](https://github.com/slidecraft-in/n8n-nodes-presentations-ai/issues)

## License

[MIT](./LICENSE.md)
