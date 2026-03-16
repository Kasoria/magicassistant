# MagicAssistant

AI-powered WordPress assistant with multi-provider chat, SEO analysis, image generation and MCP tools.

## Features

- **AI Chat** - Conversational assistant with streaming responses, chat history and sessions
- **Multi-Provider** - OpenAI (GPT-4o, o1, o3), Anthropic (Claude), Google (Gemini), OpenRouter (hundreds of models)
- **MCP Tool Calling** - AI executes WordPress actions: create posts, query data, manage content via Model Context Protocol
- **SEO Analysis** - SERP analysis, keyword difficulty, domain and competitor research (DataForSEO)
- **PageSpeed Insights** - Google PageSpeed performance analysis with Core Web Vitals
- **Image Generation** - DALL-E 3 and Google Gemini image generation from chat
- **Image Search** - Unsplash integration for searching and inserting images
- **Knowledge Base** - Upload documents and scrape URLs to give AI context about your business
- **Custom Agents** - Create specialized AI agents with custom prompts and tool configs
- **Chatbots** - Build and embed AI chatbots on your frontend
- **Content Mode** - Generate blog posts, meta tags and content with granular settings
- **Public Sharing** - Share conversations via public links
- **Dark Mode** - Full dark/light theme support

## Requirements

- WordPress 6.0+
- PHP 7.4+
- At least one AI provider API key (OpenAI, Anthropic, Google or OpenRouter)

## Installation

1. Download the latest release zip
2. Upload via **Plugins > Add New > Upload Plugin** in WordPress
3. Activate and go to **MagicPlugins > MagicAssistant**
4. Add your AI provider API key(s) in Settings

Or install directly from [WordPress.org](https://wordpress.org/plugins/) (pending approval).

## Optional Integrations

These require their own API keys, configured in Settings:

| Service | What it does | Get a key |
|---------|-------------|-----------|
| [DataForSEO](https://dataforseo.com/) | SEO and keyword analysis | [dataforseo.com](https://dataforseo.com/) |
| [Unsplash](https://unsplash.com/developers) | Image search | [unsplash.com/developers](https://unsplash.com/developers) |
| Google PageSpeed | Performance monitoring | Optional (works without key, higher limits with one) |

## Development

### Prerequisites

- Node.js 18+
- WordPress development environment
- Composer (for PSR-4 autoloading)

### Setup

```bash
npm install
composer install
npm run dev
```

Vite dev server runs at `http://localhost:3000` with HMR. WordPress auto-detects it when `WP_DEBUG` is enabled.

### Production Build

```bash
npm run build        # Compile React assets
node build.js        # Create distribution zip
```

### Tech Stack

- React 18, Vite, TailwindCSS, Flowbite React
- PHP 7.4+ with PSR-4 autoloading, WordPress REST API
- Model Context Protocol (MCP) for AI tool execution

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

## License

[GPL-2.0-or-later](LICENSE)
