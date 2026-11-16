# @presentations-ai/n8n-nodes-presentations-ai

Official [n8n](https://n8n.io) community node for [Presentations.AI](https://presentations.ai). Create slide decks from a topic, a piece of text, a document or a reviewed outline, and get the finished PDF, PPTX or slide images back as a file in your workflow. Find, update, download, share and delete presentations, and check your credits.

Use it three ways: as a tool for n8n's **AI Agent**, by connecting an agent to the **Presentations.AI MCP server**, or as a normal workflow step. See [Use with AI agents](#use-with-ai-agents).

> **Upgrading from 0.2.x?** Presentations.AI switched off the API that 0.2.x used on 5 November 2026, so every 0.2.x workflow and credential test now fails. Update to the latest version, **create a new API key** (keys from the old API don't work), and read [Upgrading from 0.2.x](#upgrading-from-02x).

## Installation

In n8n, go to **Settings → Community Nodes → Install** and enter `@presentations-ai/n8n-nodes-presentations-ai`.

For self-hosted n8n, see [Install community nodes](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n docs.

## Credentials

1. Sign in at [api.presentations.ai](https://api.presentations.ai/#/apikeys) and create a key under **API keys** with the **Deck automation** preset. It covers everything this node does: creating, finding, updating, downloading, sharing and deleting presentations, files, the Brand Kit and Project lists, and the credit balance. Keys start with `pai_live_`.
2. In n8n, create a **Presentations.AI API** credential and paste the key into **API Key**.
3. Leave **Base URL** as `https://api.presentations.ai`.
4. Click **Test**. n8n checks the key with Presentations.AI before you save. If the key isn't valid, the message says so and links to the page where you create a new one.

Creating presentations uses credits from your Presentations.AI workspace: about **10 credits per slide** (Quality Tier Standard; Lite 5, Premium 20). Deep Research doubles it, and PPTX adds 5 per slide on plans without PowerPoint export. An outline uses 10 credits per slide. Everything else is free. Check the balance with **Account → Get Credits**.

When something goes wrong, the node shows the message from Presentations.AI and what to do next, for example when the key is wrong, the workspace is out of credits or suspended, or the key lacks a permission (it names the scopes it needs).

## Use with AI agents

There are four ways to use Presentations.AI with AI in n8n. New presentations are **Private** by default: only you (and your workspace's owners and admins) can open them.

### 1. This node as an agent tool

The node can be attached to n8n's **AI Agent** as a tool. No setting or environment variable is needed.

1. In the AI Agent, add a tool and choose **Presentations.AI**.
2. Choose an operation, such as **Create From Topic**.
3. Let the model fill in fields such as Topic and Slide Count: use the button next to the field, or an expression such as `{{ $fromAI('topic', 'What the deck is about') }}`. Fixed settings like Brand Kit, Visibility or Export Format stay under your control.
4. Set **Tool Description** to **Set Manually** and tell the model what the tool does, when to use it, what it costs and who can open the result. The [example](examples/ai-agent-presentations-ai-tool.json) has one you can copy.
5. Leave Wait for Completion on so the tool returns the finished presentation.
6. Use a capable chat model. In our tests a 9-billion-parameter local model followed the example's instructions; a 4-billion-parameter one asked for confirmation again after the user had already confirmed.

As a tool, the node returns JSON only, including `deck_url` (opens after sign-in). Operations and settings that need files, delete, share or change who can open a presentation aren't offered to agents: Create From File, Download, Download File, Create Share Link, Presentation → Update and Delete, File → Upload and Delete, Share Link → Create and Delete, and Access → Grant, Update and Revoke. Use them in the main workflow, for example after the agent. Read-only operations such as Get Many, Get Credits and Share Link → Get are available, so an agent can find earlier presentations or check the balance.

### 2. AI Agent with the Presentations.AI MCP server

Presentations.AI runs an MCP server at `https://api.presentations.ai/mcp`. Connect it to the AI Agent with n8n's built-in **MCP Client Tool** sub-node. The agent gets the server's tools: creating presentations and outlines, checking progress, downloading, finding presentations, brand kits and projects, and sharing. The tool list comes from the server, so new tools appear without updating this package. Tools your key lacks permission for don't appear.

| MCP Client Tool setting | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Endpoint**            | `https://api.presentations.ai/mcp`                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Server Transport**    | HTTP Streamable                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Authentication**      | **Bearer Auth**: create a Bearer Auth credential and paste a `pai_live_` key as the Bearer Token. The **Deck automation** key you use for this node works; the **MCP client** preset works too.<br>**or MCP OAuth2**: create an MCP OAuth2 API credential, keep **Use Dynamic Client Registration** on, set **Server URL** to `https://api.presentations.ai/mcp`, then connect and sign in with your Presentations.AI account. You don't need an API key for this. |
| **Tools to Include**    | **Selected** is safest. Include `whoami`, `create_presentation`, `get_task`, `get_export`, `list_decks`, `get_deck`, `search_brand_kits` and `list_projects`; add `create_outline` if you want outlines first. Leave out `delete_deck`, `patch_deck` and `create_grant`, and add `share_deck` only if the agent should publish public links.                                                                                                                       |
| **Options → Timeout**   | Raise it from the default 60000 ms to about 180000. Waiting for a presentation can take up to a minute per call.                                                                                                                                                                                                                                                                                                                                                   |

Tell the agent, in its system message, to set `deck.visibility` to `PRIVATE`, `deck.language` to `auto` and `deck.export_format` to `PDF` when it calls `create_presentation`: the MCP server's defaults are Workspace (everyone in the workspace can open and edit it), English and PPTX (5 more credits per slide on plans without PowerPoint export). Also tell it to confirm the cost before it creates (about 10 credits per slide), and not to pass `request_id`: the server derives one, so a retry never charges twice. Only `create_presentation` and `create_outline` use credits. Download links handed out over MCP work without a key and expire after 15 minutes. The [example](examples/ai-agent-presentations-ai-mcp.json) has a system message that does all of this.

The MCP server has no upload tool. To build from a document, upload it with this node's **File → Upload** and pass the `file_id` to `create_presentation` as a source `{ "type": "file", "file_id": "…" }`, or use **Create From File**.

### 3. One MCP call without an agent

n8n's built-in **MCP Client** node calls a single MCP tool as a normal workflow step. Use the same Endpoint, Server Transport and Authentication as above, then pick the **Tool** and fill in its parameters. Presentations.AI's `get_export` tool (input: `deck_id`) returns a link in `download_url` rather than the file. To get the file, add an **HTTP Request** node after it that fetches `download_url` with **Options → Response → Response Format: File**, within 15 minutes. The link needs no key.

### 4. n8n as an MCP server for other AI apps

n8n's **MCP Server Trigger** can offer this node's tool to an outside MCP client, such as Claude Desktop, through your n8n instance: connect the **Presentations.AI** tool to the trigger instead of an AI Agent. Set the trigger's authentication to Bearer or Header auth so only your client can use it. Tool results go back as text, so file operations don't apply. In queue mode, n8n's docs ask you to route all `/mcp*` traffic to a single webhook replica. If the outside app can connect to an MCP server itself, connecting it straight to `https://api.presentations.ai/mcp` is simpler.

### When to use which

Rule of thumb: use the **node** for fixed, repeatable steps that should return a file. Use **MCP** when an agent should decide which steps to take.

- **The node in a workflow**: forms, schedules, batch jobs, one presentation per row. You get the file.
- **The node as an agent tool**: an agent that only needs to create or find presentations, with settings you fix in advance.
- **MCP Client Tool with an agent**: a chat assistant that plans, revises, finds earlier presentations or shares them.
- **MCP Client node**: one MCP-only step inside a fixed workflow.

## Operations

### Presentation

| Operation               | What it does                                                                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Create From Topic**   | Generates a full deck from a topic or brief. Most workflows start here.                                                                                                                                                                         |
| **Create Single Slide** | Generates one summary slide from a topic.                                                                                                                                                                                                       |
| **Create From Content** | Turns text (an article, notes, a meeting transcript, up to 200,000 characters) into a deck.                                                                                                                                                     |
| **Create From File**    | Turns a file from an earlier node into a deck. Accepts PDF, Word (.docx), PowerPoint (.pptx), Excel (.xls, .xlsx), CSV, TSV, TXT, Markdown, HTML, JSON, EPUB, PNG, JPEG and WebP files up to 150 MB. Older .doc and .ppt files aren't accepted. |
| **Create From Outline** | Builds a deck from an outline, such as one from **Outline → Create** that someone reviewed. Map the `outline` from that step, or JSON text with a `slides` list.                                                                                |

Operation-specific fields:

- **Topic** (Create From Topic, Create Single Slide): what the deck is about. Add instructions here too, such as what to emphasise.
- **Content** (Create From Content): the text to build the deck from.
- **Input Binary Field** (Create From File): the binary field that holds the file. Default `data`.
- **Topic or Instructions** (Create From Content, Create From File): optional title, focus or instructions. Required when Preservation Mode is **Instruction**.
- **Preservation Mode** (Create From Content, Create From File): see [Preservation Mode](#preservation-mode).
- **Slide Count** (all except Create Single Slide and Create From Outline): 1–50, including the cover. Default 10.
- **Outline** (Create From Outline): the outline to build from.

Fields on every create operation:

| Field                   | Default                                           | What it does                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Export Format**       | PDF (version 3), PPTX (versions 1 and 2)          | **PPTX** (editable slides), **PDF**, or **Image** (a ZIP file with one image per slide).                                                                                                                                                                                                                                                                                                                                        |
| **Target Audience**     | Auto                                              | **Auto** lets Presentations.AI work out the audience from the topic and content, or pick Clients / Customers, Executive Leadership, General Audience, General Employees, Students / Trainees or Technical Team. Shapes depth, wording and examples. An expression can pass any short description instead, such as `Series A investors`.                                                                                         |
| **Language**            | English (version 1), `auto` (version 2 and later) | The language name in English, such as `Spanish` or `Japanese`, or `auto` to follow the language of the topic, text or file. Two-letter codes such as `es` also work. See [Node versions](#node-versions).                                                                                                                                                                                                                       |
| **Company Domain**      | (empty)                                           | Web domain of the company the deck is about, such as `example.com`. Used for research and to match the company's branding.                                                                                                                                                                                                                                                                                                      |
| **Visibility**          | Private                                           | Node version 2 and later. Who can open the deck in Presentations.AI: **Private** (the API key's owner and people they share it with), **Project** (members of the project set under Options, or of the project the key is limited to) or **Workspace** (everyone in the key's workspace). Creating a share link changes the deck to Public: anyone with the link, and everyone in your Presentations.AI workspace, can view it. |
| **Wait for Completion** | On                                                | Wait until the deck is ready before continuing. Turn it off to get a request ID straight away and check on it later with **Job → Get Status**.                                                                                                                                                                                                                                                                                  |
| **Max Wait (Seconds)**  | 600                                               | The longest time to wait. If the deck isn't ready by then, the node returns it with status `RUNNING` so a later Get Status can pick it up.                                                                                                                                                                                                                                                                                      |
| **Download File**       | On                                                | Put the finished file in the item's binary data.                                                                                                                                                                                                                                                                                                                                                                                |
| **Create Share Link**   | Off                                               | Create a share link once the deck is ready. **This makes the deck public**: anyone with the link, and everyone in your Presentations.AI workspace, can view it. A notice under the toggle repeats this.                                                                                                                                                                                                                         |
| **Simplify**            | On                                                | Return the ten most useful fields instead of the full response. See [Output](#output).                                                                                                                                                                                                                                                                                                                                          |

Max Wait, Download File and Create Share Link only show when Wait for Completion is on.

Under **Options → Add Option**:

| Option                       | Default  | What it does                                                                                                                                                                                      |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Allowed Graphics**         | (empty)  | Comma-separated graphic types the slides may use; others are redrawn as the closest allowed type.                                                                                                 |
| **Brand Kit**                | (empty)  | Style the deck with a brand's fonts, colours and logo. Pick one from the searchable list, or switch to **By ID**. The list needs an API key with the `brand_kits:read` scope.                     |
| **Company**                  | (empty)  | Company the deck is about, researched instead of guessed from the topic.                                                                                                                          |
| **Deep Research**            | Off      | Consultant-grade research and exhibit slides. Paid plans only; doubles the credits per slide. Not used with Create From Outline.                                                                  |
| **Delivery**                 | Auto     | How the deck will be shown (Meeting, Print, Read, Stage, Video). Sets how many words go on each slide.                                                                                            |
| **Insider Content**          | (empty)  | Private facts about your organisation, used where a slide needs them and never cited.                                                                                                             |
| **Level of Detail**          | Standard | How much text goes on each slide: Brief, Standard, Detailed or Very Detailed.                                                                                                                     |
| **Missing Figures**          | Auto     | What to do when a slide needs a figure nobody gave: Estimate or Placeholder.                                                                                                                      |
| **Model**                    | Standard | Standard, Pro or Ultra. Presentations.AI rejects tiers your plan doesn't include.                                                                                                                 |
| **Name**                     | (empty)  | Name of the deck in your workspace. Empty uses Presentation Title or the generated title.                                                                                                         |
| **Presentation Title**       | (empty)  | Title of the deck. Also used to name the downloaded file.                                                                                                                                         |
| **Project**                  | (empty)  | Project to create the deck in, from a list or by ID. Left empty, the node uses the project your API key is limited to, or the workspace if it has none. The list needs the `projects:read` scope. |
| **Purpose**                  | Auto     | What the deck is for, such as Pitch, Report, Sales or Training.                                                                                                                                   |
| **Put Output File in Field** | `data`   | Name of the binary field for the downloaded file.                                                                                                                                                 |
| **Quality Tier**             | Standard | About 5 (Lite), 10 (Standard) or 20 (Premium) credits per slide.                                                                                                                                  |
| **Request ID**               | (empty)  | Leave empty in most cases (see [Retries and re-runs](#retries-and-re-runs)). Your own ID: the same ID with the same inputs returns the original deck.                                             |
| **Speaker Notes**            | Off      | Write presenter notes for every slide.                                                                                                                                                            |

### Node versions

New Presentations.AI nodes are version 3. Nodes saved in workflows keep the version they were made with and keep working as before.

| Setting                   | Version 1 (before 0.4.0)                              | Version 2 (0.4.x)      | Version 3 (0.5.0 and later)              |
| ------------------------- | ----------------------------------------------------- | ---------------------- | ---------------------------------------- |
| **Export Format** default | PPTX                                                  | PPTX                   | **PDF**                                  |
| **Language** default      | English                                               | `auto`                 | `auto`                                   |
| **Visibility**            | Not sent, so decks are visible to the whole workspace | **Private** by default | **Private** by default                   |
| **Request ID** left empty | New deck on every run                                 | New deck on every run  | Same inputs return the deck already made |

To move a saved workflow to version 3, add a new Presentations.AI node and copy the settings across.

### Preservation Mode

For **Create From Content** and **Create From File**, this sets how closely the deck follows your source:

- **Enhance** (default): builds a new, fuller deck and uses the source as background.
- **Summarize**: keeps the sections of the source and tightens them into key slides.
- **Preserve**: keeps the structure of the source. The source decides the number of slides, so Slide Count is ignored.
- **Instruction**: follows what you write in **Topic or Instructions** to decide how the source is used.

### Find, use and manage presentations

| Operation       | What it does                                                                                                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Get**         | One presentation, its status and the file formats it has. Pick it from a list, paste its ID, or paste its link.                                                                                                                                                                                                                       |
| **Get Many**    | Lists presentations, newest first or by name, with filters for project, name and starred.                                                                                                                                                                                                                                             |
| **Update**      | Renames a presentation, moves it to another project, or changes Visibility to Private, Project or Workspace. It never makes a presentation public. If it has a share link, check afterwards with **Get** whether the link is still on, and use **Share Link → Delete** to stop it. Changing Visibility needs the `decks:share` scope. |
| **Download**    | The newest PDF, PPTX or image file of an existing presentation.                                                                                                                                                                                                                                                                       |
| **Get Outline** | The outline a presentation was built from.                                                                                                                                                                                                                                                                                            |
| **Delete**      | Deletes the presentation for everyone.                                                                                                                                                                                                                                                                                                |

### Outline

- **Create**: drafts an outline (10 credits per slide) for someone to review before **Create From Outline** builds the presentation, which is charged again per slide. Running it again with the same Request ID doesn't charge again, but the outline isn't returned twice.

### Share Link

- **Create**: makes the presentation public and returns its link. Anyone with the link — and everyone in your workspace — can view it. **Make a New Link** replaces an existing link; the old one stops working.
- **Get**: the presentation's public link, or `has_share_link: false` when there is none.
- **Delete**: turns the link off, so it stops working. Then check who can open the presentation with **Presentation → Get** and change it with **Presentation → Update** if needed.

### Access

Share a presentation with one person, without making it public. Needs the `decks:share` scope.

- **Grant**: by email or user ID, as View, Comment or Edit. No email is sent; the person can open it once that email belongs to a verified Presentations.AI user. Granting again replaces the role.
- **Get Many**, **Update** (change the role) and **Revoke**.

### Project, Brand Kit, File and Account

- **Project → Get, Get Many**: the workspace's projects or folders (needs `projects:read`).
- **Brand Kit → Get, Get Many**: brand kits by name, domain or type, with their colours, fonts and logo (needs `brand_kits:read`).
- **File → Upload, Get, Delete**: upload a document and get its `file_id`, for example for the MCP server's `create_presentation`. Upload waits until Presentations.AI has read the file.
- **Account → Get**: who the API key belongs to, the plan, its features and the key's permissions. **Account → Get Credits**: the credit balance (`available`) and `can_start_paid_work`, which is false once the balance is 0 or below (needs `credits:view`).

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

### Retries and re-runs

- **Retry On Fail is safe.** A retry sends the same Request ID, and Presentations.AI returns the presentation it's already working on instead of making and charging for a second one. If the presentation failed, a retry in the same execution gets the same failure back rather than starting a new one. A failed run is refunded if no slides were made; a run that made some slides stays charged.
- **Version 3 nodes:** with Request ID left empty, the ID comes from your API key and the inputs. Running the workflow again with exactly the same inputs returns the presentation already made, without charging again. Change any input, or delete that presentation, to get a new one. If it failed, the next run makes a new one. To get a new presentation on every run with the same inputs, set **Options → Request ID** to an expression that changes each run and item, built from the execution ID and the item index.
- **Version 1 and 2 nodes:** each item, each pass of a loop and each new execution gets its own ID, so it makes its own presentation.
- **Rate limits and outages:** each API key can make 200 requests a minute. When Presentations.AI says to slow down (429), the node waits as asked (at most 30 seconds at a time) and tries again, up to three tries in all. After a temporary outage it retries only what can't charge twice: reads, deletes and creating a presentation.
- If anything fails after the presentation was requested, the error shows the Request ID so you can pick it up with Get Status. Presentations.AI rejects a reused Request ID with different inputs (`REQUEST_ID_CONFLICT`).

## Output

**File.** With Download File on, the finished file is in the binary field `data`. Change the name with **Options → Put Output File in Field**. The file name comes from Presentations.AI, or from Presentation Title, or else `presentation-<deck_id>`. Image exports arrive as a ZIP file.

**JSON.** With **Simplify** on (the default), the item's JSON has these ten fields:

| Field             | Contents                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `status`          | `CREATED`, `RUNNING`, `COMPLETED` or `FAILED`.                                                                                      |
| `request_id`      | ID of this request. Use it with Get Status.                                                                                         |
| `deck_id`         | ID of the deck.                                                                                                                     |
| `deck_url`        | Opens the deck in Presentations.AI. **Not public**: only signed-in people who can access the deck can open it (see **Visibility**). |
| `share_url`       | With Create Share Link on, a **public** link to view the deck. Otherwise `null`.                                                    |
| `export_format`   | `PPTX`, `PDF` or `IMAGE` once the file is ready, else `null`.                                                                       |
| `file_size_bytes` | Size of the finished file, else `null`.                                                                                             |
| `stage`           | Progress: `QUEUED`, `OUTLINE`, `SLIDES`, `EXPORT`, `COMPLETED` or `FAILED`.                                                         |
| `status_url`      | Address for checking status. Get Status accepts it too.                                                                             |
| `error`           | The reason, when `status` is `FAILED`.                                                                                              |

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

**Document to deck.** Any node that outputs a file works: an HTTP Request node with Response Format set to File, a storage node's download operation, or a Form Trigger with a File field. Set **Input Binary Field** to that file's field name. Form Trigger 2.4 and later names the binary field after the form field's Field Name (for example `report`). Without a Field Name, or in older versions, it uses the label with spaces turned into underscores, so `Source Document` arrives as `Source_Document`.

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

**Share a link instead of a file.** Turn Create Share Link on and Download File off, then post `{{ $json.share_url }}` to chat or email. Anyone with the link — and everyone in your workspace — can view it. To share with one person without making it public, use **Access → Grant** instead.

**Review the outline first.** Someone checks the plan before the slides are made.

```
Presentations.AI: Outline → Create → (Form, Slack or email for approval, with a Wait node)
  → Presentations.AI: Create From Outline (Outline: {{ $json.outline }})
```

**Check credits before a big run.** Stop a batch before it starts when the workspace is out of credits.

```
Presentations.AI: Account → Get Credits → If can_start_paid_work is true (or available ≥ your estimate) → the batch
```

## Upgrading from 0.4.x

Saved nodes keep working as before. New nodes are version 3: PDF by default, and a re-run with the same inputs returns the presentation already made (see [Node versions](#node-versions)). The example templates use version 3, so they need 0.5.0 or later. If your n8n installed an older version from n8n's verified list, use the templates from the [0.4.0 tag](https://github.com/slidecraft-in/n8n-nodes-presentations-ai/tree/0.4.0/examples).

## Upgrading from 0.2.x

Presentations.AI removed the API that 0.2.x used on 5 November 2026, so 0.2.x workflows and the credential **Test** button fail. Update the package to the latest version. The node version is still 1, operations keep their names, and most saved settings carry over. Check these changes:

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
- **Create From File** has no 5 MB limit any more (150 MB now). It accepts PDF, Word (.docx), PowerPoint (.pptx), Excel (.xls, .xlsx), CSV, TSV, TXT, Markdown, HTML, JSON, EPUB, PNG, JPEG and WebP. RTF and the older .doc and .ppt formats aren't accepted.
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
