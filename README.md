<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/logo-square-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="public/logo-square-light.png" />
    <img src="public/logo-square-light.png" alt="Tsugi Logo" width="180" />
  </picture>
</p>

<p align="center">
  <strong>"Explore once. Exploit next."</strong>
</p>

---

<p align="center">
  Tsugi is an agentic harness where AI agents learn from trial-and-error execution and codify learnings into reusable skills.
</p>


<p align="center">
  <img src="https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat&logo=vercel" alt="Deployed on Vercel" />
  <img src="https://img.shields.io/badge/Powered%20by-Gemini%203-4285F4?style=flat&logo=google&logoColor=white" alt="Powered by Gemini 3" />
  <img src="https://img.shields.io/badge/Built%20with-Next.js%2016-000000?style=flat&logo=next.js" alt="Built with Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/pnpm-9.x-F69220?style=flat&logo=pnpm&logoColor=white" alt="pnpm" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat" alt="License MIT" />
</p>

- **Run 1**: Research + Task Execution + Skill Creation
- **Run 2**: Skill Lookup + Skip Research (5-6x faster)

## What It Does

Tsugi captures procedural knowledge from successful task executions and saves them as reusable skills. When you ask an agent to integrate with a new API, it researches, experiments, handles errors, and eventually succeeds. That hard-won knowledge gets codified into a skill that makes the next execution instant.

Skills encode two types of knowledge:
- **Procedural**: Integration gotchas, validation rules, error patterns, multi-step workflows
- **Preferences**: Your taxonomies, classification rules, domain constraints

## Features

- **Dual-Agent System** - Task Agent executes work, Skill Agent codifies learnings
- **Persistent Skill Library** - Skills accumulate and compound over time
- **Sandbox Execution** - Isolated environments with environment variable injection
- **Real-time Streaming** - Watch agent reasoning and tool calls as they happen
- **Extended Thinking** - Full visibility into agent reasoning traces
- **Native Grounding** - Google Search and URL analysis built-in
- **Conversation History** - Persistent chat history with pinned comparisons

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Task     │ ──▶ │   Task Agent    │ ──▶ │  Skill Agent    │
│                 │     │                 │     │                 │
│ "Charge $50     │     │ 1. Search skills│     │ 1. Analyze      │
│  on Stripe"     │     │ 2. Research API │     │    transcript   │
│                 │     │ 3. Execute      │     │ 2. Extract      │
│                 │     │ 4. Verify       │     │    procedure    │
│                 │     │ 5. Suggest      │     │ 3. Save skill   │
│                 │     │    codification │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**First execution** - Agent explores, makes mistakes, self-corrects, and succeeds.

**"Codify Skill"** - Skill Agent extracts the working procedure with parameters.

**Next execution** - Agent finds the skill, skips research, executes directly.

## Tech Stack

- **Framework**: Next.js 16 with React 19 (App Router)
- **LLM**: Gemini 3 via Vercel AI SDK
- **Database**: SQLite/Turso for conversations, Vercel Blob for skills (prod)
- **Sandbox**: Local child_process (dev) or Vercel Sandbox microVM (prod)
- **Observability**: Braintrust for traces and token counting
- **Styling**: Tailwind CSS v4, Framer Motion, Lucide icons

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
```

Add your API key to `.env`:

```
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
```

Get a key from [Google AI Studio](https://aistudio.google.com/).

### Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/agent/          # SSE streaming endpoint
│   ├── api/conversations/  # Chat history CRUD
│   ├── api/skills/         # Skills API
│   └── task/               # Task execution page
├── components/             # React components
│   └── landing/            # Landing page components
├── hooks/                  # useForgeChat, useConversations, useSkills
└── lib/
    ├── agent/              # Task Agent, Skill Agent, tools
    ├── db/                 # SQLite/Turso database
    ├── sandbox/            # Sandbox executors
    ├── skills/             # Skill storage (local/cloud)
    └── tools/              # Command execution
playground/                 # Demo tasks
MEMORY/                     # Plans and changelogs
```

## Development

```bash
pnpm dev        # Start dev server
pnpm build      # Production build
pnpm test       # Run tests (watch mode)
pnpm test:run   # Run tests once
pnpm lint       # Lint code
```

## Example Tasks

Try these to see the system in action:

- "Send a hello world message to Discord" (requires webhook URL)
- "Charge $50 via Stripe API and then refund half" (requires Stripe key)
- "Summarize this YouTube video and save to Notion"

After successful execution, click **"Codify Skill"** to save the procedure. Run the same task again to see the speedup.

## License

MIT
