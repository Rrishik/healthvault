# HealthVault

> A local-first, privacy-focused health assistant PWA with pluggable AI providers.

HealthVault helps you understand food ingredients, answer health questions, and analyze food labels — all while keeping your data on **your device**. No accounts, no cloud storage, no tracking.

---

## Features

| Feature | Description |
|---|---|
| **Food Scanner** | Type ingredients, upload a photo, or snap a food label. Get a traffic-light verdict (safe / caution / avoid) personalized to your health profile. |
| **Health Chat** | Conversational health Q&A. Answers are personalized using your conditions, allergies, medications, and goals. |
| **Image Analysis** | Point your camera at a food label — AI reads the image directly. Falls back to offline OCR (Tesseract.js) when vision isn't available. |
| **Health Profile** | Store conditions, allergies, medications, dietary preferences, and goals. The AI uses this context for every interaction. |
| **Profile Auto-Detect** | When you mention a new condition or medication in chat, the app prompts you to add it to your profile. |
| **Interaction History** | Browse past food scans and health queries with expandable details. |
| **Encrypted Backup** | Export all data as a passphrase-encrypted `.healthvault` file. Import it on another device. |
| **Installable PWA** | Add to your home screen on any device. Works offline for UI and OCR. |

### Supported AI Providers

| Provider | Models | Setup |
|---|---|---|
| **HealthVault Community (Free)** | GPT-4o mini via shared proxy | No API key needed |
| **OpenAI** | GPT-4o, GPT-4o mini, GPT-4 Turbo | Your own API key |
| **Google Gemini** | Gemini 2.0 Flash, 1.5 Pro, 1.5 Flash | Your own API key |
| **Anthropic (Claude)** | Claude 3.5 Sonnet, 3.5 Haiku, 3 Opus | Your own API key |
| **Azure OpenAI** | Any deployed model | Endpoint + API key + deployment name |

Adding a new provider is one file — copy `src/adapters/_example/` and implement the interface.

---

## How Your Data Stays Safe

HealthVault is designed with a **zero-trust, local-first** architecture. Here's exactly what happens with your data:

### Nothing leaves your device by default

- All health profile data, interaction history, and food scan results are stored in **IndexedDB** inside your browser.
- There is no HealthVault server, no user accounts, no analytics, and no telemetry.
- The app is a static site hosted on GitHub Pages — it serves HTML/JS/CSS and nothing else.

### API keys are encrypted at rest

- Provider API keys are encrypted in IndexedDB using **AES-256-GCM** with a device-bound key.
- The key is derived via **PBKDF2 (600,000 iterations)** from an app constant combined with a random per-device salt stored in `localStorage`.
- This prevents casual inspection of API keys in browser DevTools — an attacker would need access to both IndexedDB and `localStorage` on the same device.
- API keys are **never included in data exports**.

### AI interactions are ephemeral

- When you ask a question or scan food, HealthVault sends your query + relevant health context to the selected AI provider's API.
- The AI provider processes the request and returns a response. **No data is stored on AI provider servers** beyond their standard API data retention policies.
- HealthVault does not send your full history — the `ContextAssembler` selects only the most recent and relevant context for each request.

### Encrypted backups

- The export feature serializes your IndexedDB data and encrypts it with a passphrase you choose using **AES-256-GCM via PBKDF2**.
- The resulting `.healthvault` file is opaque without the passphrase.
- On import, data is merged (newer records win) — API keys are excluded from both export and import.

### Open & auditable

- All prompt templates live in `src/prompts/` as plain TypeScript — you can read exactly what gets sent to the AI.
- The optional "Show Prompt Before Sending" toggle in Settings lets you inspect every prompt before it's transmitted.
- The entire codebase is open source under the MIT license.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (PWA)                        │
│                                                             │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │  Pages   │──▶│    Hooks     │──▶│  Context          │    │
│  │ (React)  │   │ useAIProvider│   │  (AppContext)     │    │
│  │          │   │ useProfile   │   │  Settings/Profile │    │
│  └──────────┘   └──────┬───────┘   └────────┬─────────┘    │
│                        │                     │              │
│                        ▼                     ▼              │
│  ┌─────────────────────────────┐   ┌──────────────────┐    │
│  │     AI Adapter Layer        │   │   Dexie (IDB)    │    │
│  │  ┌───────┐ ┌───────┐       │   │  HealthProfile   │    │
│  │  │OpenAI │ │Gemini │  ...  │   │  InteractionLog  │    │
│  │  └───┬───┘ └───┬───┘       │   │  FoodScanHistory │    │
│  │      │         │            │   │  AppSettings     │    │
│  └──────┼─────────┼────────────┘   └──────────────────┘    │
│         │         │                         ▲              │
│         ▼         ▼                         │              │
│  ┌─────────────────────┐          ┌─────────┴────────┐    │
│  │  Prompt Templates   │          │  Crypto Service   │    │
│  │  system / food /    │          │  AES-256-GCM      │    │
│  │  health / image     │          │  PBKDF2 600K      │    │
│  └─────────────────────┘          └──────────────────┘    │
│                                                             │
└──────────────────────────────────┬──────────────────────────┘
                                   │ HTTPS (per-request only)
                                   ▼
                          ┌──────────────────┐
                          │  AI Provider API │
                          │  (OpenAI / Gemini│
                          │  / Anthropic /   │
                          │  Azure / Proxy)  │
                          └──────────────────┘
```

**Key design choices:**

- **Adapter pattern** — Each AI provider is a single file implementing the `AIProvider` interface. Providers self-register on import. The UI renders config forms dynamically from each adapter's `configSchema`.
- **Context assembly** — Before each AI call, the `ContextAssembler` pulls your profile and recent interaction history from IndexedDB and builds a provider-agnostic `HealthContext` object. No provider ever touches the database directly.
- **Prompt transparency** — All prompts are plain-text templates in `src/prompts/`. They receive a `HealthContext` and produce a string. Easy to audit, test, and modify.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install & Run

```bash
git clone https://github.com/Rrishik/healthvault.git
cd healthvault
npm install
npm run dev
```

Open `http://localhost:5173/healthvault/` in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

### Run Tests

```bash
npm test            # single run
npm run test:watch  # watch mode
```

---

## Project Structure

```
src/
├── adapters/           # AI provider implementations
│   ├── types.ts        # AIProvider interface
│   ├── registry.ts     # Provider registry
│   ├── utils.ts        # Shared utilities (safeParseJSON)
│   ├── openai/         # OpenAI adapter
│   ├── gemini/         # Gemini adapter
│   ├── anthropic/      # Anthropic adapter
│   ├── azure-openai/   # Azure OpenAI adapter
│   ├── community/      # Free community proxy adapter
│   └── _example/       # Template for new providers
├── components/         # Reusable UI components
├── context/            # React context (AppContext)
├── hooks/              # Custom React hooks
├── pages/              # Route pages
├── prompts/            # AI prompt templates
├── services/           # Core services (db, crypto, ocr, export)
├── types/              # TypeScript interfaces
└── constants.ts        # Shared constants
```

---

## Adding a New AI Provider

1. Copy `src/adapters/_example/` to `src/adapters/your-provider/`
2. Implement the `AIProvider` interface methods
3. Call `registerProvider(yourProvider)` at the bottom of the file
4. Import your adapter in `src/context/AppContext.tsx`

The settings UI will automatically render your provider's config form.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | TailwindCSS v4 |
| Routing | react-router-dom v7 (HashRouter) |
| Local DB | Dexie.js v4 (IndexedDB) |
| Encryption | Web Crypto API (AES-256-GCM, PBKDF2) |
| OCR | Tesseract.js v7 |
| PWA | vite-plugin-pwa + Workbox |
| Testing | Vitest |
| Hosting | GitHub Pages (static) |

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

> **Disclaimer:** HealthVault is not a medical device. It does not diagnose, treat, or cure any condition. Always consult a qualified healthcare professional for medical advice.
