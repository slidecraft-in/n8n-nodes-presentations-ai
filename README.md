# @presentations-ai/n8n-nodes-presentations-ai

Official [n8n](https://n8n.io) community node for [Presentations.AI](https://presentations.ai). Create slide decks from a topic, a piece of text or a document, and get the finished PPTX, PDF or slide images back as a file in your workflow.

> **Upgrading from 0.2.x?** Presentations.AI switched off the API that 0.2.x used on 5 November 2026, so every 0.2.x workflow and credential test now fails. Update to 0.3.0, **create a new API key** (keys from the old API don't work), and read [Upgrading from 0.2.x](#upgrading-from-02x).

## Installation

In n8n, go to **Settings → Community Nodes → Install** and enter `@presentations-ai/n8n-nodes-presentations-ai`.

For self-hosted n8n, see [Install community nodes](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n docs.

## Credentials

1. Sign in at [api.presentations.ai](https://api.presentations.ai/#/apikeys) and create a key under **API keys** with the **Deck automation** preset. It covers everything this node does: creating, checking and downloading presentations, share links, and the Brand Kit and Project lists. Keys start with `pai_live_`.
2. In n8n, create a **Presentations.AI API** credential and paste the key into **API Key**.
3. Leave **Base URL** as `https://api.presentations.ai`.
4. Click **Test**. n8n checks the key with Presentations.AI before you save. If the key isn't valid, the message says so and links to the page where you create a new one.

Creating decks uses credits from your Presentations.AI workspace. Credits are charged per slide. When something goes wrong, for example when you run out of credits, the node shows the error message from Presentations.AI.

## Operations

### Presentation

| Operation               | What it does                                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Create From Topic**   | Generates a full deck from a topic or brief. Most workflows start here.                                                                                                                                                                   |
| **Create Single Slide** | Generates one summary slide from a topic.                                                                                                                                                                                                 |
| **Create From Content** | Turns text (an article, notes, a meeting transcript, up to 200,000 characters) into a deck.                                                                                                                                               |
| **Create From File**    | Turns a file from an earlier node into a deck. Accepts PDF, Word (.docx), PowerPoint (.pptx), Excel (.xls, .xlsx), CSV, TSV, TXT, Markdown, HTML, JSON, EPUB, PNG and JPEG files up to 150 MB. Older .doc and .ppt files aren't accepted. |

Operation-specific fields:

- **Topic** (Create From Topic, Create Single Slide): what the deck is about. Add instructions here too, such as what to emphasise.
- **Content** (Create From Content): the text to build the deck from.
- **Input Binary Field** (Create From File): the binary field that holds the file. Default `data`.
- **Topic or Instructions** (Create From Content, Create From File): optional title, focus or instructions. Required when Preservation Mode is **Instruction**.
- **Preservation Mode** (Create From Content, Create From File): see [Preservation Mode](#preservation-mode).
- **Slide Count** (all except Create Single Slide): 1–50, including the cover. Default 10.

Fields on every create operation:

| Field                   | Default | What it does                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Export Format**       | PPTX    | **PPTX** (editable slides), **PDF**, or **Image** (a ZIP file with one image per slide).                                                                                                                                                                                                                                                |
| **Target Audience**     | Auto    | **Auto** lets Presentations.AI work out the audience from the topic and content, or pick Clients / Customers, Executive Leadership, General Audience, General Employees, Students / Trainees or Technical Team. Shapes depth, wording and examples. An expression can pass any short description instead, such as `Series A investors`. |
| **Language**            | English | The language name in English, such as `Spanish` or `Japanese`. Use `auto` to match the source. Two-letter codes such as `es` also work.                                                                                                                                                                                                 |
| **Company Domain**      | (empty) | Web domain of the company the deck is about, such as `example.com`. Used for research and to match the company's branding.                                                                                                                                                                                                              |
| **Wait for Completion** | On      | Wait until the deck is ready before continuing. Turn it off to get a request ID straight away and check on it later with **Job → Get Status**.                                                                                                                                                                                          |
| **Max Wait (Seconds)**  | 600     | The longest time to wait. If the deck isn't ready by then, the node returns it with status `RUNNING` so a later Get Status can pick it up.                                                                                                                                                                                              |
| **Download File**       | On      | Put the finished file in the item's binary data.                                                                                                                                                                                                                                                                                        |
| **Create Share Link**   | Off     | Create a share link once the deck is ready. **The link is public**: anyone who has it can view the deck. A notice under the toggle repeats this.                                                                                                                                                                                        |
| **Simplify**            | On      | Return the ten most useful fields instead of the full response. See [Output](#output).                                                                                                                                                                                                                                                  |

Max Wait, Download File and Create Share Link only show when Wait for Completion is on.

Under **Options → Add Option**:

| Option                       | Default  | What it does                                                                                                                                                                                         |
| ---------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Brand Kit**                | (empty)  | Style the deck with a brand's fonts, colours and logo. Pick one from the searchable list, or switch to **By ID**. The list needs an API key with the `brand_kits:read` scope.                        |
| **Level of Detail**          | Standard | How much text goes on each slide: Brief, Standard, Detailed or Very Detailed.                                                                                                                        |
| **Model**                    | Standard | Standard, Pro or Ultra. Presentations.AI rejects tiers your plan doesn't include.                                                                                                                    |
| **Presentation Title**       | (empty)  | Title of the deck. Also used to name the downloaded file.                                                                                                                                            |
| **Project**                  | (empty)  | Project to create the deck in, from a list or by ID. Left empty, the node uses the project your API key is limited to, or the workspace if it has none. The list needs the `projects:read` scope.    |
| **Put Output File in Field** | `data`   | Name of the binary field for the downloaded file.                                                                                                                                                    |
| **Request ID**               | (empty)  | Your own ID for this deck. Sending the same ID with the same inputs again returns the original deck instead of making a new one. Leave it empty and the node creates one for each node run and item. |
| **Speaker Notes**            | Off      | Write presenter notes for every slide.                                                                                                                                                               |

### Preservation Mode

For **Create From Content** and **Create From File**, this sets how closely the deck follows your source:

- **Enhance** (default): builds a new, fuller deck and uses the source as background.
- **Summarize**: keeps the sections of the source and tightens them into key slides.
- **Preserve**: keeps the structure of the source. The source decides the number of slides, so Slide Count is ignored.
- **Instruction**: follows what you write in **Topic or Instructions** to decide how the source is used.

### Job

- **Get Status**: checks a deck you started with Wait for Completion off.
  - **Request ID or Status URL**: the `request_id` or `status_url` from the create step, for example `{{ $json.request_id }}`.
  - **Download File** (default off): download the file once the deck is complete. **Options → Put Output File in Field** sets the binary field name (default `data`).
  - **Simplify** (default on): same output fields as the create operations.

## Waiting for the deck

A 10-slide deck usually takes 2–4 minutes. Presentations.AI no longer calls a webhook when a deck is ready, so pick one of these two ways to wait. Either way, the node checks every 5 seconds, as the Presentations.AI docs recommend.

**Wait in the node (default).** With Wait for Completion on, the node keeps checking until the deck is ready, then returns the file. It gives up after Max Wait (Seconds) and returns the deck with status `RUNNING`. If your n8n instance has an execution timeout, keep it longer than Max Wait. Stopping the workflow stops the wait straight away.

**Check later.** Turn Wait for Completion off. The node returns at once with `request_id`, `status_url` and `status` (`CREATED` or `RUNNING`). Later, run **Job → Get Status** with Download File on. A simple loop is:

```
Presentations.AI: Create From Topic (Wait for Completion off)
  → Wait (3 minutes)
  → Presentations.AI: Get Status (Download File on)
  → If status is COMPLETED: continue. Otherwise go back to Wait.
```

`status` is one of `CREATED`, `RUNNING`, `COMPLETED` or `FAILED`. When generation fails, a create operation stops with an error that includes the request ID. Get Status returns the item with `status: FAILED` and the reason in `error`.

If a deck isn't ready when the node finishes (Wait for Completion off, or Max Wait reached), n8n shows a note in the output panel pointing to **Get Status**.

**Retries are safe.** n8n's **Retry On Fail** setting won't make a second deck: a retry sends the same request ID, and Presentations.AI returns the deck it's already working on. Each item, each pass of a loop and each new execution gets its own ID, so it makes its own deck. If the node hits a rate limit or a temporary outage while waiting, it waits and checks again. If anything fails after the deck was requested, the error shows the request ID so you can pick the deck up with Get Status. If re-runs should reuse a deck, set **Options → Request ID** yourself, for example to a row ID. Presentations.AI rejects a reused Request ID with different inputs (`REQUEST_ID_CONFLICT`).

## Output

**File.** With Download File on, the finished file is in the binary field `data`. Change the name with **Options → Put Output File in Field**. The file name comes from Presentations.AI, or from Presentation Title, or else `presentation-<deck_id>`. Image exports arrive as a ZIP file.

**JSON.** With **Simplify** on (the default), the item's JSON has these ten fields:

| Field             | Contents                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `status`          | `CREATED`, `RUNNING`, `COMPLETED` or `FAILED`.                                                                            |
| `request_id`      | ID of this request. Use it with Get Status.                                                                               |
| `deck_id`         | ID of the deck.                                                                                                           |
| `deck_url`        | Opens the deck in Presentations.AI. **Not public**: only signed-in members of your workspace who have access can open it. |
| `share_url`       | With Create Share Link on, a **public** link to view the deck. Otherwise `null`.                                          |
| `export_format`   | `PPTX`, `PDF` or `IMAGE` once the file is ready, else `null`.                                                             |
| `file_size_bytes` | Size of the finished file, else `null`.                                                                                   |
| `stage`           | Progress: `QUEUED`, `OUTLINE`, `SLIDES`, `EXPORT`, `COMPLETED` or `FAILED`.                                               |
| `status_url`      | Address for checking status. Get Status accepts it too.                                                                   |
| `error`           | The reason, when `status` is `FAILED`.                                                                                    |

With **Simplify** off, the JSON is the full response from Presentations.AI (including `export` with `format`, `content_type`, `size_bytes` and a `download_url` that needs your API key, `warnings`, `created_at` and `updated_at`), plus `share_link` when Create Share Link is on.

## Common workflows

**Topic to file.** Send the file anywhere that accepts one, such as an email or cloud storage node. Point that node at the binary field `data`.

```
Manual Trigger → Presentations.AI: Create From Topic → (email or storage node)
```

**Web form to downloaded deck.** Someone fills in a form and their browser downloads the deck. Import [`examples/form-to-presentations-ai-deck.json`](examples/form-to-presentations-ai-deck.json).

```
n8n Form Trigger → Presentations.AI: Create From Topic → n8n Form (Form Ending: Return Binary File)
```

**Document to deck.** Any node that outputs a file works: an HTTP Request node with Response Format set to File, a storage node's download operation, or a Form Trigger with a File field. Set **Input Binary Field** to that file's field name. A Form Trigger names the binary field after the form field's label, with spaces turned into underscores. A field labelled `Source Document` arrives as `Source_Document`.

```
(node that outputs a file) → Presentations.AI: Create From File
```

**Notes or transcript to deck.** Paste or map the text into Content and pick **Summarize** to keep only the key points.

```
(meeting notes) → Presentations.AI: Create From Content (Preservation Mode: Summarize)
```

**Many decks from a spreadsheet.** Start every deck without waiting, then collect the files later. Each API key can make 200 requests a minute.

```
Read rows → Presentations.AI: Create From Topic (Wait for Completion off) → save request_id to the row

— separate scheduled workflow —
Read rows without a file → Presentations.AI: Get Status (Download File on) → save the file when status is COMPLETED
```

**Share a link instead of a file.** Turn Create Share Link on and Download File off, then post `{{ $json.share_url }}` to chat or email. Anyone with the link can view the deck.

## Use with AI agents

There are three ways to use Presentations.AI with AI in n8n.

### 1. This node as an agent tool

The node can be attached to n8n's **AI Agent** as a tool.

1. In the AI Agent, add a tool and choose **Presentations.AI**.
2. Choose an operation, such as **Create From Topic**.
3. Let the model fill in fields such as Topic and Slide Count: use the button next to the field, or an expression such as `{{ $fromAI('topic', 'What the deck is about') }}`. Fixed settings like Brand Kit or Export Format stay under your control.
4. Leave Wait for Completion on so the tool returns the finished deck.
5. Turn on **Create Share Link** if the agent should give people a link they can open. The link is public.

As a tool, the node returns JSON only: the simplified fields above, including `deck_url` (needs sign-in) and, if turned on, `share_url`. **Create From File** and **Download File** aren't available in tool mode, because n8n doesn't pass files into or out of agent tools. If you need the file, put the node in the main workflow, for example after the agent.

### 2. AI Agent with the Presentations.AI MCP server

Presentations.AI runs an MCP server at `https://api.presentations.ai/mcp`. Connect it to the AI Agent with n8n's built-in **MCP Client Tool** sub-node, and the agent gets every tool the server offers. That covers more than making decks: planning an outline, finding brand kits, and finding, sharing and downloading existing decks. The tool list comes from the server, so new tools appear without updating this package. Tools your key lacks permission for don't appear in the tool list.

| MCP Client Tool setting | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Endpoint**            | `https://api.presentations.ai/mcp`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Server Transport**    | HTTP Streamable                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Authentication**      | **Bearer Auth**: create a Bearer Auth credential and paste a `pai_live_` key as the Bearer Token. The same **Deck automation** key you use for this node works; the **MCP client** preset works too.<br>**or MCP OAuth2**: create an MCP OAuth2 API credential, keep **Use Dynamic Client Registration** on, set **Server URL** to `https://api.presentations.ai/mcp`, then connect and sign in with your Presentations.AI account. You don't need an API key for this. |
| **Tools to Include**    | **Selected** is safest. Include `whoami`, `create_presentation`, `get_task`, `get_export`, `list_decks`, `get_deck`, `search_brand_kits` and `list_projects`; add `create_outline` if you want outlines first. Leave out `delete_deck`, `patch_deck` and `create_grant`, and add `share_deck` only if the agent should publish public links.                                                                                                                            |
| **Options → Timeout**   | Raise it from the default 60000 ms to about 180000. Waiting for a deck can take up to a minute per call.                                                                                                                                                                                                                                                                                                                                                                |

Only `create_presentation` and `create_outline` use credits; the other tools are free. Download links handed out over MCP work without a key and expire after 15 minutes. To try it, import [`examples/ai-agent-presentations-ai-mcp.json`](examples/ai-agent-presentations-ai-mcp.json).

### 3. One MCP call without an agent

n8n's built-in **MCP Client** node calls a single MCP tool as a normal workflow step. Use the same Endpoint, Server Transport and Authentication as above, then pick the **Tool** and fill in its parameters. Its **Convert to Binary** option (on by default) only turns image and audio results into files. Presentations.AI's `get_export` tool (input: `deck_id`) returns a link in `download_url` rather than the file. It returns the file once your generation has finished (`get_task` shows COMPLETED), and only exports you created, so a teammate's deck may have none for you. To get the file, add an **HTTP Request** node after it that fetches `download_url` with **Options → Response → Response Format: File**, within 15 minutes. The link needs no key.

> Options 2 and 3 are checked against n8n's node source (n8n 2.46) and Presentations.AI's published OAuth settings, but not yet tested end to end.

### When to use which

Rule of thumb: use the **node** for fixed, repeatable steps that should return a file. Use **MCP** when an agent should decide which steps to take.

- **The node in a workflow**: forms, schedules, batch jobs, one deck per row. You get the file.
- **The node as an agent tool**: an agent that only needs to create decks, with settings you fix in advance.
- **MCP Client Tool with an agent**: a chat assistant that plans, revises, finds earlier decks or shares them.
- **MCP Client node**: one MCP-only step, such as listing decks, inside a fixed workflow.

Files are the exception: Presentations.AI's MCP server doesn't take file uploads, so use the node's **Create From File** to turn a document into a deck.

## Upgrading from 0.2.x

Presentations.AI removed the API that 0.2.x used on 5 November 2026, so 0.2.x workflows and the credential **Test** button fail. Update the package to 0.3.0. The node version is still 1, operations keep their names, and most saved settings carry over. Check these changes:

- **API key.** Keys from the old API don't work any more. Create a new key at [api.presentations.ai](https://api.presentations.ai/#/apikeys) (it starts with `pai_live_`) and paste it into your Presentations.AI credential.
- **Waiting and output.** Create operations now wait for the deck and return the file in binary field `data` by default. The JSON is the new response (see [Output](#output)), so update expressions that read the old fields: use `request_id` for the old job ID, `status_url` for the old poll URL, and `share_url` for a public link. Turn **Simplify** off to get the full response.
- **Removed: Return Job ID Immediately.** Workflows that had it on now wait by default. Turn **Wait for Completion** off to keep the old behaviour.
- **Removed: Callback URL.** Presentations.AI no longer calls webhooks. Wait in the node or use Get Status later.
- **Removed: Tone.** The API has no equivalent setting. Describe the tone you want in Topic instead.
- **Removed export formats: PPT, Render and Share Link.** Saved workflows that used them now get PPTX. Workflows that used Share Link still get a public share link (`share_url`). In new nodes, turn on **Create Share Link**.
- **Check Status is now Get Status.** It takes the `request_id` or `status_url` and can download the file with **Download File**.
- **Language** is now the language name in English (`Spanish`) or `auto`. Two-letter codes such as `es` still work.
- **Domain** is now **Company Domain**, the company's web domain. Saved values carry over.
- **Target Audience** now defaults to **Auto**, which lets Presentations.AI work out the audience. A saved workflow that doesn't store a Target Audience value now uses Auto; choose General Audience to keep the old behaviour. Other choices are sent as a readable label, and an expression can pass any audience you describe.
- **Create From File** has no 5 MB limit any more (150 MB now). It accepts PDF, Word (.docx), PowerPoint (.pptx), Excel (.xls, .xlsx), CSV, TSV, TXT, Markdown, HTML, JSON, EPUB, PNG and JPEG. RTF and the older .doc and .ppt formats aren't accepted.
- **Retry On Fail** no longer risks creating a second deck.

## Development

```bash
npm install
npm run build
npm run lint
npm test   # unit tests
npm run dev   # starts n8n with this node loaded
```

## Resources

- [Presentations.AI API docs](https://docs.presentations.ai)
- [Create an API key](https://api.presentations.ai/#/apikeys)
- [n8n community nodes](https://docs.n8n.io/integrations/community-nodes/)
- [Changelog](CHANGELOG.md)
- [Report an issue](https://github.com/slidecraft-in/n8n-nodes-presentations-ai/issues)

## License

[MIT](./LICENSE.md)
