# MagicAssistant - Features Overview

**Version:** 1.3.1
**Your Personal AI Assistant for WordPress**

---

## AI Chat Interface

- **Chat with AI about your WordPress site** - Ask questions, get recommendations, and have the AI perform actions on your site through natural conversation
- **Multi-provider support** - Choose between OpenAI (GPT-4), Anthropic (Claude), Google AI, or OpenRouter to access dozens of AI models
- **Streaming responses** - See AI responses appear in real-time as they're generated
- **Conversation history** - All your chat sessions are saved and organized for easy reference
- **Share conversations** - Generate public links to share interesting AI conversations with others
- **Web search integration** - Enable web search to give the AI access to current information beyond its training data
- **File attachments** - Attach images and documents to your messages for the AI to analyze

---

## AI-Powered WordPress Management

- **Fetch WordPress settings and server data** - Ask the AI to retrieve any WordPress setting, server configuration, PHP info, or site data
- **Create, edit, and manage content** - Tell the AI to create posts, pages, or custom post type entries with full Gutenberg block support
- **Manage media library** - Have the AI upload images from URLs, update metadata, set featured images, or organize your media
- **User management** - Let the AI help you audit user accounts, check permissions, or gather user statistics
- **WooCommerce integration** - Manage products, view orders, and handle customers through natural conversation (when WooCommerce is active)

---

## AI Image Generation & Enhancement

- **Generate images with DALL-E 3 or Google Imagen** - Create custom images from text descriptions directly in WordPress
- **AI image editing** - Apply AI transformations to existing images in your media library
- **Background removal** - Remove backgrounds from product photos or portraits
- **Style transfer** - Apply artistic styles to your images
- **Unsplash integration** - Search and import high-quality stock photos with proper attribution
- **Media Library integration** - Generate and edit images directly from the WordPress media library

---

## Comprehensive SEO Analysis

- **Full site SEO audit** - Tell the AI to analyze your site for SEO, comparing your current values against optimal benchmarks
- **On-page SEO analysis** - Get detailed breakdowns of title tags, meta descriptions, heading structure, image alt texts, and internal/external links
- **SEO plugin integration** - Works with RankMath, Yoast SEO, SEOPress, AIOSEO, The SEO Framework, and Squirrly SEO
- **Keyword research** - Access keyword difficulty scores, search volumes, and related keyword suggestions through DataForSEO integration
- **SERP analysis** - Analyze search engine results pages for your target keywords
- **Competitor analysis** - Discover and analyze your SEO competitors
- **Backlink analysis** - Get summaries of your site's backlink profile
- **PageSpeed Insights** - Run Google PageSpeed tests and get Core Web Vitals metrics with improvement recommendations

---

## Security Monitoring

- **Vulnerability scanning** - Check your WordPress core, plugins, and themes against known vulnerability databases
- **File integrity monitoring** - Verify WordPress core files haven't been modified from their official versions
- **Plugin & theme checksum verification** - Ensure your plugins and themes match their official WordPress.org versions
- **PHP version security check** - Verify your PHP version is current and secure
- **HTTPS enforcement check** - Verify SSL/TLS is properly configured
- **File permissions audit** - Check that critical files have secure permissions
- **Admin user audit** - Review administrator accounts for suspicious activity
- **Login event tracking** - Monitor login attempts and detect potential brute force attacks
- **HTTP security headers analysis** - Check for missing security headers like CSP, HSTS, X-Frame-Options
- **.htaccess protection check** - Verify your .htaccess has proper security rules

---

## Debug Manager

- **Works even when WordPress crashes** - A standalone debug interface that functions even when WordPress has fatal errors
- **Parse all error logs** - View WordPress debug.log, PHP error logs, and plugin logs in one place
- **Filter and search logs** - Filter by error level (Fatal, Error, Warning, Notice) or search for specific terms
- **View error context** - Click any error to see the surrounding code with the error line highlighted
- **AI-assisted debugging** - Ask the AI to help explain and fix errors directly from the debug view
- **Edit files directly** - Fix code issues right from the debug interface (when enabled in settings)

---

## Bricks Builder Integration

- **Pre-built component library** - Access hundreds of professionally designed Bricks sections (headers, footers, heroes, features, testimonials, pricing, CTAs, etc.)
- **AI-powered text enhancement** - Enhance any text element directly within Bricks builder with tone adjustment, length modification, grammar correction, and SEO optimization
- **AI-powered image enhancement** - Edit and transform images directly within Bricks builder
- **Smart component insertion** - AI analyzes your request and selects the best-matching component from the library
- **Automatic text replacement** - Have placeholder text automatically replaced with content relevant to your site
- **Automatic image replacement** - Replace placeholder images with contextually appropriate Unsplash photos
- **Framework support** - Components available for Native Bricks, ACSS, CoreFramework, and ATF

---

## AI Agents & Knowledge Base

- **Create custom AI agents** - Define specialized AI assistants with specific personalities, expertise areas, and instructions
- **Custom system prompts** - Give each agent unique instructions and context
- **Tonality settings** - Configure agents as professional, casual, friendly, technical, etc.
- **Knowledge base** - Build a library of information the AI can reference when answering questions
- **Import content from URLs** - Scrape and import content from web pages into your knowledge base
- **Categorization and tagging** - Organize knowledge base entries for efficient retrieval

---

## Frontend Chatbot Builder

- **Create customer-facing chatbots** - Build AI chatbots that appear on your public website
- **Link to AI agents** - Connect chatbots to your custom AI agents for specialized responses
- **Custom branding** - Set custom header names, logos, and color schemes
- **Trigger button styling** - Customize the floating chat button appearance and position
- **Quick message buttons** - Add pre-defined quick action buttons for common questions
- **Display conditions** - Control which pages show the chatbot and when it appears
- **Rate limiting** - Prevent abuse with configurable rate limits

---

## WordPress.org Repository Tools

- **Search plugins** - Have the AI search the WordPress.org plugin directory for you
- **Plugin information** - Get detailed information about any plugin including ratings, reviews, and compatibility
- **Search themes** - Find themes from the WordPress.org theme directory
- **Theme information** - View detailed theme information and preview links

---

## Analytics & Logging

- **API usage tracking** - Monitor your AI API usage including tokens, requests, and costs
- **Provider breakdown** - See usage statistics broken down by AI provider
- **Response time tracking** - Monitor AI response times
- **Error rate monitoring** - Track API errors and failures
- **Date range filtering** - Filter analytics by custom date ranges

---

## Settings & Configuration

- **Choose default AI provider** - Set your preferred AI provider and model
- **Secure API key storage** - API keys are encrypted using AES-256-CBC
- **Tool permissions** - Enable or disable create, update, and delete operations for safety
- **Floating chat settings** - Configure the floating chat widget behavior
- **Dark/Light theme** - User-selectable interface theme
- **Export/Import settings** - Backup and restore your configuration
- **Complete data removal** - Option to remove all plugin data on uninstall

---

## Developer Features

- **Built-in MCP Server** - Model Context Protocol server that enables external AI tools (like Claude Desktop) to interact with your WordPress site
- **90+ registered tools** - Comprehensive WordPress management capabilities exposed via MCP
- **REST API** - Full REST API for all plugin functionality
- **Hooks and filters** - Extend the plugin with custom functionality via `magic_assistant_mcp_init`
- **JWT authentication** - Secure token-based authentication for external connections
- **Development mode** - Hot module replacement and React Fast Refresh for development
