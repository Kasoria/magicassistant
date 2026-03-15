=== MagicAssistant ===
Contributors: chrispump
Tags: ai, assistant, chatbot, seo, content
Requires at least: 6.0
Tested up to: 6.9
Stable tag: 2.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

AI-powered WordPress assistant with multi-provider chat, SEO analysis, image generation and MCP tools.

== Description ==

MagicAssistant is an AI-powered WordPress plugin that provides an intelligent chat interface for website management, content creation, SEO analysis and more. Connect your own API keys and use the AI models of your choice.

**Core Features:**

* **AI Chat Interface** - Conversational AI assistant with streaming responses, chat history and session management
* **Multi-Provider Support** - Connect to OpenAI (GPT-4o, o1, o3), Anthropic (Claude), Google (Gemini) and OpenRouter (hundreds of models)
* **Tool Calling / MCP** - AI can execute WordPress actions: create posts, query the database, manage content and more via Model Context Protocol
* **SEO Analysis** - SERP analysis, keyword difficulty, domain analysis and competitor research via DataForSEO
* **PageSpeed Insights** - Google PageSpeed performance analysis with Core Web Vitals tracking
* **Image Generation** - Generate images with DALL-E 3 and Google Gemini directly from the chat
* **Image Search** - Search and insert Unsplash images
* **Knowledge Base** - Upload documents and scrape URLs to give the AI context about your business
* **Custom AI Agents** - Create specialized agents with custom system prompts and tool configurations
* **Chatbots** - Build and embed AI chatbots on your frontend
* **Content Mode** - Generate blog posts, meta tags and content with granular settings
* **Public Sharing** - Share chat conversations via public links
* **Dark Mode** - Full dark and light theme support
* **Internationalization** - Fully translatable

**Supported AI Providers:**

* OpenAI (GPT-4o, GPT-4o-mini, o1, o3, DALL-E 3)
* Anthropic (Claude Sonnet, Claude Opus, Claude Haiku)
* Google (Gemini 2.5 Pro, Gemini 2.5 Flash)
* OpenRouter (access to hundreds of models)

**Optional Integrations (bring your own API keys):**

* DataForSEO - SEO and keyword analysis
* Google PageSpeed Insights - Performance monitoring
* Unsplash - Image search

== Installation ==

1. Upload the `magicassistant` folder to `/wp-content/plugins/`
2. Activate the plugin through the Plugins menu
3. Navigate to MagicPlugins > MagicAssistant
4. Add your AI provider API key(s) in Settings
5. Start chatting with your AI assistant

== Frequently Asked Questions ==

= Do I need my own API keys? =

Yes. You need at least one AI provider API key (OpenAI, Anthropic, Google or OpenRouter). Optional services like DataForSEO, Unsplash and PageSpeed also require their own keys.

= Which AI provider should I use? =

All providers work well. OpenAI and Anthropic are the most popular. OpenRouter gives you access to hundreds of models with a single API key. Google Gemini offers generous free tiers.

= Is my data secure? =

API keys are encrypted at rest using AES-256-CBC. Chat data stays in your WordPress database. API calls go directly from your server to the provider - no intermediary services.

= What is MCP / Tool Calling? =

Model Context Protocol allows the AI to perform actions in WordPress - like creating posts, querying data or managing content. You control which tools are available and the AI asks for confirmation before executing actions.

= Can I embed a chatbot on my frontend? =

Yes. Create a chatbot in the Chatbots section, configure its appearance and behavior, then embed it on any page.

== Screenshots ==

1. AI chat interface with streaming responses
2. Settings panel with multi-provider configuration
3. SEO analysis dashboard
4. Knowledge base management
5. Custom AI agents
6. Chatbot builder

== Changelog ==

= 2.0 =
* Open source release - all features free, no license required
* Direct API connections - calls go straight to AI providers (no proxy)
* Added Google Gemini as a native AI provider
* Users provide their own API keys for all services
* Removed MagicDash dependency
* Removed custom update checker (now on WordPress.org)
* Added GPL-2.0 license

= 1.3.7 =
* Bug fixes and performance improvements

= 1.3.6 =
* Transition to custom dashboard system
* UI improvements

= 1.3.5 =
* MCP Server improvements
* New AI tools for WordPress management

= 1.0.0 =
* Initial release

== Upgrade Notice ==

= 2.0 =
Major update: all features are now free and open source. API calls go directly to providers. You must configure your own API keys in Settings.

== Privacy Policy ==

MagicAssistant processes data locally on your WordPress site. When using AI features, data is sent directly to your configured AI provider.

**External Services:**

* **OpenAI** (api.openai.com) - When using OpenAI models for chat or image generation. [Privacy Policy](https://openai.com/privacy/)
* **Anthropic** (api.anthropic.com) - When using Claude models. [Privacy Policy](https://www.anthropic.com/privacy)
* **Google** (generativelanguage.googleapis.com) - When using Gemini models. [Privacy Policy](https://policies.google.com/privacy)
* **OpenRouter** (openrouter.ai) - When using OpenRouter models. [Privacy Policy](https://openrouter.ai/privacy)
* **DataForSEO** (api.dataforseo.com) - When using SEO analysis features. [Privacy Policy](https://dataforseo.com/privacy-policy)
* **Unsplash** (api.unsplash.com) - When searching for images. [Privacy Policy](https://unsplash.com/privacy)
* **Google PageSpeed** (googleapis.com) - When running performance analysis. [Privacy Policy](https://policies.google.com/privacy)

All external service usage requires explicit user action. No data is sent automatically.
