=== MagicAssistant ===
Contributors: chrispump
Tags: ai, assistant, chatbot, seo, content
Requires at least: 6.0
Tested up to: 7.0
Stable tag: 2.0.2
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
* **Knowledge Base** - Upload documents or paste text to give the AI context about your business
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

== Source Code ==

The full source code, including unminified JavaScript, is available on GitHub: https://github.com/Kasoria/magicassistant

== Changelog ==

= 2.0.2 =
* Renamed plugin-specific functions, options, transients, nonces and AJAX actions to the unique "magica_" prefix to avoid conflicts (existing settings are migrated automatically)
* Replaced a direct cURL call with the WordPress HTTP API for the vulnerability feed lookup
* Image-edit backups are now stored in a dedicated plugin subfolder inside the uploads directory

= 2.0.1 =
* Render the shared-conversation preview locally with a bundled Markdown library (no remote scripts)
* Added per-IP rate limiting and input sanitization to the public chatbot endpoint
* Fixed an outdated external link in the readme

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

== External services ==

MagicAssistant connects to several third-party services. Each call is triggered by an explicit action you take in the plugin (sending a chat message, running an analysis, searching for an image, scanning for vulnerabilities, etc.). No data is sent automatically in the background. Most services require you to provide your own API key.

**AI providers** — used to generate chat responses, content and images. When you send a message or generate an image, the conversation content, your prompt, and any context you attach (such as selected post content or knowledge-base text) are sent to the provider you selected:

* **OpenAI** (api.openai.com) — when using OpenAI models or DALL-E image generation. [Terms](https://openai.com/policies/terms-of-use/) · [Privacy Policy](https://openai.com/policies/privacy-policy/)
* **Anthropic** (api.anthropic.com) — when using Claude models. [Terms](https://www.anthropic.com/legal/consumer-terms) · [Privacy Policy](https://www.anthropic.com/legal/privacy)
* **Google Gemini** (generativelanguage.googleapis.com) — when using Gemini models or Gemini image generation. [Terms](https://ai.google.dev/gemini-api/terms) · [Privacy Policy](https://policies.google.com/privacy)
* **OpenRouter** (openrouter.ai) — when using OpenRouter models. [Terms](https://openrouter.ai/terms) · [Privacy Policy](https://openrouter.ai/privacy)

**SEO, performance and media services:**

* **DataForSEO** (api.dataforseo.com) — used for SERP, keyword and competitor analysis. Your search keywords and target domains are sent when you run an SEO analysis. [Terms](https://dataforseo.com/terms-of-service/) · [Privacy Policy](https://dataforseo.com/privacy-policy/)
* **Google PageSpeed Insights** (www.googleapis.com) — used for performance analysis. The URL you analyze is sent when you run a PageSpeed report. [Terms](https://developers.google.com/speed/docs/insights/v5/about) · [Privacy Policy](https://policies.google.com/privacy)
* **Unsplash** (api.unsplash.com) — used for image search. Your search query is sent when you search for images. [Terms](https://unsplash.com/terms) · [Privacy Policy](https://unsplash.com/privacy)

**WordPress.org and security data** (no account or API key required):

* **WordPress.org Plugin/Theme API** (api.wordpress.org) — used to search the WordPress.org plugin and theme directories and to install/update plugins and themes you choose. The plugin/theme slug you request is sent. [Privacy Policy](https://wordpress.org/about/privacy/)
* **Wordfence Intelligence** (www.wordfence.com) — used by the optional vulnerability scanner to look up known vulnerabilities for the plugins/themes installed on your site. The component slugs and versions being checked are sent when you run a security scan. [Terms & Privacy Policy](https://www.wordfence.com/terms-of-use-and-privacy-policy/)
* **Gravatar** (gravatar.com / secure.gravatar.com) — WordPress core's avatar service is used to display user avatars in the chat interface, based on the logged-in user's email hash. [Privacy Policy](https://automattic.com/privacy/)

== Plugin & theme management ==

MagicAssistant includes AI tools that can search, install, activate and update plugins and themes from the WordPress.org directory on your request. These actions only run when you explicitly ask the assistant to perform them, and they are gated by the standard WordPress capabilities (install_plugins / activate_plugins / update_plugins for plugins and install_themes for themes). The plugin never changes the active state of other plugins on its own.

== User management ==

The assistant can add and edit WordPress users as part of its site-management tools, the same way you would from the Users screen in wp-admin. These tools use WordPress core functions (wp_insert_user / wp_update_user) and are gated by the standard core capabilities (create_users to add a user, edit_user to edit one). The plugin never logs anyone in, never sets authentication cookies and never creates a session, so it cannot bypass login-attempt limits or other security plugins — it only performs actions the logged-in administrator is already allowed to perform, on their own site, on explicit request.

== Privacy Policy ==

MagicAssistant stores your chat history, settings and knowledge-base content in your own WordPress database. API keys are encrypted at rest. Data is only transmitted to the external services listed above, and only as a result of an explicit action you take. See the "External services" section above for the specific data sent to each service.
