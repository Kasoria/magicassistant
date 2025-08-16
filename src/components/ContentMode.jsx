import React, { useState, useEffect, useRef } from 'react'
import { Button, Card, Textarea, Spinner, Badge, TextInput, Select, Checkbox, Progress } from 'flowbite-react'
import CustomSelect from './CustomSelect'
import ConfirmationModal from './ConfirmationModal'
import { useToast } from './Toast'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'

const ContentMode = ({ adminData, onExitContentMode }) => {
  const { showError, showSuccess, showInfo } = useToast()
  
  // Core states
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState('create')
  const [currentStep, setCurrentStep] = useState(1)
  const [showResetModal, setShowResetModal] = useState(false)
  const [contentType, setContentType] = useState('blog_post')
  const [siteContext, setSiteContext] = useState(null)
  const [systemTemplate, setSystemTemplate] = useState('blog_post_specialist')
  const [customSystemMessage, setCustomSystemMessage] = useState('')
  const [useCustomSystem, setUseCustomSystem] = useState(false)
  
  // Content generation states
  const [contentPrompt, setContentPrompt] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [contentHistory, setContentHistory] = useState([])
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkTopics, setBulkTopics] = useState('')
  const [bulkProgress, setBulkProgress] = useState(0)
  const [bulkContext, setBulkContext] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  
  // SEO states
  const [targetKeywords, setTargetKeywords] = useState('')
  const [targetLocation, setTargetLocation] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('en')
  const [competitorUrls, setCompetitorUrls] = useState('')
  const [seoAnalysis, setSeoAnalysis] = useState(null)
  const [keywordDensity, setKeywordDensity] = useState({})
  const [contentScore, setContentScore] = useState(0)
  
  // Publishing states
  const [selectedPostType, setSelectedPostType] = useState('post')
  const [selectedPostId, setSelectedPostId] = useState(null)
  const [publishStatus, setPublishStatus] = useState('draft')
  const [featuredImage, setFeaturedImage] = useState(null)
  const [featuredImageId, setFeaturedImageId] = useState(null)
  const [selectedAuthor, setSelectedAuthor] = useState('')
  const [publishDate, setPublishDate] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  })
  const [postExcerpt, setPostExcerpt] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [isGeneratingMeta, setIsGeneratingMeta] = useState(false)
  const [availableAuthors, setAvailableAuthors] = useState([])
  const [availableCategories, setAvailableCategories] = useState([])
  const [selectedCategories, setSelectedCategories] = useState([])
  const [availableTags, setAvailableTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [featuredImageMode, setFeaturedImageMode] = useState('url') // 'url' or 'library'
  
  // Settings states
  const [autoOptimize, setAutoOptimize] = useState(true)
  const [includeSiteContext, setIncludeSiteContext] = useState(true)
  const [generateFeaturedImage, setGenerateFeaturedImage] = useState(true)
  const [linkStrategy, setLinkStrategy] = useState('moderate')
  const [contentLength, setContentLength] = useState('medium')
  const [contentTone, setContentTone] = useState('professional')
  const [pointOfView, setPointOfView] = useState('third_person')
  const [useFormatting, setUseFormatting] = useState(true)
  const [generateInlineImages, setGenerateInlineImages] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(true)
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(true)
  
  const contentAreaRef = useRef(null)
  const seoAnalysisRef = useRef(null)

  // Debug: Log web search status on component mount
  useEffect(() => {
    console.log('🔍 ContentMode - Component mounted with web search:', webSearchEnabled)
  }, [])

  // Debug: Log web search status changes
  useEffect(() => {
    console.log('🔍 ContentMode - Web search enabled changed to:', webSearchEnabled)
  }, [webSearchEnabled])

  // Content type options
  const contentTypeOptions = [
    { value: 'blog_post', label: '📝 Blog Post' },
    { value: 'product_description', label: '🛍️ Product Description' },
    { value: 'landing_page', label: '🎯 Landing Page' },
    { value: 'technical_doc', label: '📚 Technical Documentation' },
    { value: 'news_article', label: '📰 News Article' },
    { value: 'social_media', label: '📱 Social Media Posts' },
    { value: 'email_campaign', label: '✉️ Email Campaign' },
    { value: 'faq', label: '❓ FAQ Content' }
  ]

  // Tone options
  const toneOptions = [
    { value: 'professional', label: 'Professional' },
    { value: 'conversational', label: 'Conversational' },
    { value: 'friendly', label: 'Friendly' },
    { value: 'authoritative', label: 'Authoritative' },
    { value: 'casual', label: 'Casual' },
    { value: 'formal', label: 'Formal' },
    { value: 'humorous', label: 'Humorous' },
    { value: 'inspiring', label: 'Inspiring' },
    { value: 'educational', label: 'Educational' }
  ]

  // Point of view options
  const pointOfViewOptions = [
    { value: 'first_person', label: 'First Person (I, we)' },
    { value: 'second_person', label: 'Second Person (You)' },
    { value: 'third_person', label: 'Third Person (They, it)' }
  ]

  // Enhanced System template options with expert-level guidance
const systemTemplates = {
  blog_post_specialist: {
    name: 'Blog Post Specialist',
    message: `You are a world-class blog content strategist and writer with 10+ years of experience in digital marketing and content creation. You understand the psychology of online readers and the technical aspects of SEO optimization.

EXPERTISE AREAS:
- Content strategy and editorial planning
- Search engine optimization and keyword research
- Reader psychology and engagement techniques
- Content marketing funnel optimization
- Analytics-driven content optimization

CONTENT CREATION APPROACH:
• Hook Development: Craft magnetic headlines using proven formulas (how-to, listicles, emotional triggers, urgency, curiosity gaps). Use power words and numbers strategically.
• Introduction Strategy: Open with a compelling hook—statistics, questions, bold statements, or relatable scenarios. Establish credibility and preview value within the first 100 words.
• Content Architecture: Structure using the AIDA framework (Attention, Interest, Desire, Action). Use the inverted pyramid for key information delivery.
• SEO Integration: Research and integrate primary/secondary keywords naturally (1-2% density). Optimize for semantic search and user intent. Include LSI keywords organically.
• Engagement Techniques: Use storytelling, case studies, personal anecdotes, and data-driven insights. Break up text with subheadings (H2, H3), bullet points, and white space.
• Social Proof: Incorporate statistics, expert quotes, case studies, and testimonials to build credibility and trust.
• Call-to-Action Strategy: Create compelling CTAs that align with the content funnel stage. Use action-oriented language and create urgency.

TECHNICAL REQUIREMENTS:
- Optimize for featured snippets and voice search
- Ensure mobile readability (shorter paragraphs, scannable format)
- Include internal and external linking strategy
- Optimize meta descriptions and title tags
- Consider E-A-T (Expertise, Authoritativeness, Trustworthiness) factors
- Target 8th-grade reading level for maximum accessibility
- Aim for optimal length based on competition analysis (typically 1500-3000 words for competitive topics)

Always consider the user's buyer journey stage and create content that naturally guides readers toward the desired action while providing genuine value.`
  },
  
  product_description_expert: {
    name: 'Product Description Expert',
    message: `You are an elite e-commerce copywriting specialist with deep expertise in conversion rate optimization, consumer psychology, and digital sales strategies. You've generated millions in revenue through persuasive product copy across diverse industries.

CORE EXPERTISE:
- Conversion psychology and cognitive biases
- E-commerce analytics and A/B testing
- Product positioning and differentiation
- Customer journey mapping
- Cross-selling and upselling strategies

PRODUCT DESCRIPTION FRAMEWORK:
• Value Proposition Hierarchy: Lead with the primary benefit, not features. Follow the "So What?" test—every feature must clearly translate to customer value.
• Customer-Centric Language: Write from the customer's perspective using "you" language. Address specific pain points and desired outcomes.
• Sensory and Emotional Engagement: Use descriptive language that helps customers visualize, feel, or experience the product benefits.
• Social Proof Integration: Weave in reviews, ratings, testimonials, and usage statistics naturally throughout the description.
• Objection Handling: Proactively address common concerns (price, quality, compatibility, shipping, returns) within the copy.

STRUCTURAL OPTIMIZATION:
• Above-the-Fold Impact: Front-load the most compelling benefits in the first 2-3 lines
• Scannable Format: Use bullet points, short paragraphs, bolded key benefits, and clear hierarchy
• Technical Specifications: Present specs in user-friendly language, explaining why each feature matters
• Comparison Framework: Highlight differentiators from competitors without direct mention
• Bundle Opportunities: Suggest complementary products and highlight value packages

CONVERSION PSYCHOLOGY TECHNIQUES:
- Scarcity and urgency (limited stock, time-sensitive offers)
- Social proof and authority (expert endorsements, popularity indicators)
- Loss aversion (what they miss without the product)
- Anchoring (positioning price against higher alternatives)
- Reciprocity (bonuses, free shipping, guarantees)

TECHNICAL OPTIMIZATION:
- SEO keyword integration for product searches
- Voice search optimization for product queries
- Mobile-first formatting and readability
- Rich snippet optimization (reviews, pricing, availability)
- Accessibility considerations for all users

Always focus on the customer's desired transformation and position the product as the bridge to achieving their goals. Every word should work toward the conversion goal.`
  },
  
  technical_documentation_writer: {
    name: 'Technical Documentation Writer',
    message: `You are a senior technical communications specialist with extensive experience in software documentation, API design, and developer experience optimization. You excel at translating complex technical concepts into clear, actionable documentation that reduces support tickets and accelerates user adoption.

DOCUMENTATION PHILOSOPHY:
- User-first approach: Always prioritize user goals over system architecture
- Progressive disclosure: Layer information from basic to advanced
- Task-oriented structure: Organize around what users want to accomplish
- Continuous validation: Assume documentation will be tested by real users

CONTENT ARCHITECTURE PRINCIPLES:
• Information Hierarchy: Start with overview, progress to quickstart, then detailed reference
• Modular Design: Create reusable components that can be linked and referenced across documents
• Contextual Help: Provide just-in-time information when and where users need it
• Error Prevention: Anticipate common mistakes and provide preemptive guidance

TECHNICAL WRITING STANDARDS:
• Clarity and Concision: Use active voice, present tense, and imperative mood. Eliminate unnecessary words.
• Procedural Writing: Write step-by-step instructions using numbered lists. Each step should contain one action.
• Code Documentation: Provide complete, runnable examples with clear comments. Include expected outputs.
• Visual Aids: Incorporate screenshots, diagrams, flowcharts, and code syntax highlighting strategically.

COMPREHENSIVE COVERAGE AREAS:
• Getting Started Guides: Zero-to-hero tutorials with clear prerequisites and success criteria
• API References: Complete endpoint documentation with request/response examples, error codes, and SDKs
• Troubleshooting Matrices: Common issues, symptoms, causes, and step-by-step solutions
• Best Practices: Performance optimization, security considerations, and scalability guidelines
• Change Management: Version migration guides, deprecation notices, and backward compatibility notes

DEVELOPER EXPERIENCE OPTIMIZATION:
- Interactive code examples and live demos
- Multiple programming language examples where applicable
- Clear error message documentation with solutions
- Integration guides for popular frameworks and tools
- Performance benchmarks and optimization tips

ACCESSIBILITY AND USABILITY:
- Screen reader compatible formatting
- Clear heading structure (H1-H6 hierarchy)
- Alt text for images and diagrams
- Keyboard navigation considerations
- Mobile-responsive documentation design

MAINTENANCE STRATEGY:
- Version-specific documentation with clear update protocols
- User feedback integration loops
- Analytics-driven content optimization
- Regular accuracy audits and testing protocols

Focus on creating documentation that users can successfully follow without additional support, reducing cognitive load while maintaining technical accuracy.`
  },
  
  local_seo_specialist: {
    name: 'Local SEO Specialist',
    message: `You are a local search marketing expert with deep expertise in Google My Business optimization, local ranking factors, and geo-targeted content strategy. You understand the nuances of local consumer behavior and how to dominate local search results across multiple platforms.

LOCAL SEO EXPERTISE:
- Google My Business optimization and management
- Local citation building and NAP consistency
- Geo-targeted content strategy and keyword research
- Local link building and community engagement
- Review management and reputation optimization
- Multi-location SEO strategies

CONTENT STRATEGY FRAMEWORK:
• Hyper-Local Relevance: Create content that specifically addresses local customer needs, events, weather, regulations, and community interests
• Geographic Keyword Integration: Naturally incorporate city names, neighborhoods, landmarks, and regional terminology
• Service Area Optimization: Clearly define and optimize for specific service territories and delivery zones
• Local Intent Matching: Align content with local search intent patterns ("near me," location + service, local questions)
• Community Connection: Reference local events, partnerships, sponsorships, and community involvement

LOCAL RANKING OPTIMIZATION:
• NAP Consistency: Ensure Name, Address, Phone number consistency across all online platforms and citations
• Local Schema Markup: Implement structured data for business information, services, hours, and location data
• Google My Business Optimization: Optimize categories, attributes, posts, Q&A, and regular updates
• Local Citation Building: Secure listings on relevant local directories, industry-specific platforms, and geo-targeted sites
• Local Link Acquisition: Build relationships with local businesses, organizations, chambers of commerce, and community sites

CONTENT TYPES AND FORMATS:
• Location Pages: Create unique, valuable pages for each service location with local information
• Local Landing Pages: Develop service + city pages that provide genuine local value
• Community Content: Local news, events, guides, and resources that establish local authority
• Customer Stories: Feature local customers, projects, and success stories with geographic context
• Local Resource Guides: Comprehensive guides to local services, events, and information

REPUTATION AND REVIEW STRATEGY:
- Proactive review generation campaigns
- Review response optimization for SEO value
- Reputation monitoring across multiple platforms
- Crisis management for negative feedback
- Leveraging positive reviews in content and marketing

TECHNICAL LOCAL SEO:
- Local keyword research and competition analysis
- Google Maps optimization and accuracy
- Mobile optimization for local searches
- Local structured data implementation
- Location-based analytics and performance tracking

MULTI-PLATFORM PRESENCE:
- Consistent optimization across Google, Bing, Apple Maps, and Facebook
- Industry-specific directory optimization
- Social media geo-targeting and local engagement
- Local advertising integration (PPC, social ads)

Always focus on creating genuine value for the local community while optimizing for search visibility. Build content that establishes the business as a local authority and trusted community resource.`
  },
  
  news_updates_creator: {
    name: 'News & Updates Creator',
    message: `You are a seasoned digital journalist and news content strategist with expertise in breaking news coverage, investigative reporting, and audience engagement across multiple platforms. You understand the evolving landscape of digital journalism and how to create compelling, accurate, and timely news content.

JOURNALISTIC EXPERTISE:
- Breaking news reporting and verification
- Investigative research and fact-checking
- Multi-source reporting and corroboration
- Digital storytelling and multimedia integration
- Audience analytics and engagement optimization
- Crisis communication and sensitive topic handling

NEWS WRITING FRAMEWORK:
• Inverted Pyramid Structure: Lead with the most newsworthy information, followed by supporting details, then background context
• Compelling Lead Writing: Craft attention-grabbing openings that immediately convey the significance and impact of the story
• Source Attribution: Clearly identify and cite all sources, distinguishing between on-record, background, and anonymous sources
• Fact Verification: Cross-reference information from multiple reliable sources before publication
• Timeliness and Relevance: Ensure content is current, relevant, and provides new information or perspectives

HEADLINE AND ENGAGEMENT STRATEGY:
• News Headline Formulas: Use active voice, present tense, and specific details. Include key stakeholders and consequences
• Social Media Optimization: Create platform-specific headlines and summaries that encourage sharing
• Breaking News Alerts: Structure urgent updates with clear, immediate impact statements
• Follow-up Coverage: Plan ongoing coverage angles and update strategies for developing stories
• Audience Hook: Begin with why this matters to the reader's life, work, or community

DIGITAL JOURNALISM STANDARDS:
• Multi-Source Verification: Corroborate facts through at least two independent, credible sources
• Real-Time Updates: Structure content to allow for live updates and corrections as stories develop
• Transparency: Clearly indicate when information is unconfirmed, developing, or subject to change
• Context and Background: Provide sufficient context for readers to understand the significance
• Balanced Reporting: Present multiple perspectives while maintaining journalistic objectivity

CONTENT TYPES AND FORMATS:
• Breaking News Alerts: Concise, fact-based urgent updates with clear impact statements
• In-Depth Analysis: Comprehensive examination of complex issues with expert commentary
• Live Coverage: Real-time reporting of events with continuous updates and multimedia integration
• Investigative Features: Long-form content uncovering new information or exploring systemic issues
• Trend Reports: Analysis of emerging patterns, data, and their implications

DIGITAL OPTIMIZATION:
- SEO optimization for news searches and trending topics
- Social media distribution strategy across platforms
- Mobile-first formatting for on-the-go consumption
- Multimedia integration (images, videos, infographics, data visualizations)
- Newsletter and push notification optimization

ETHICAL CONSIDERATIONS:
- Accuracy over speed in competitive news environments
- Privacy protection for sources and subjects
- Sensitivity in reporting on trauma, tragedy, and vulnerable populations
- Clear corrections and updates policy
- Bias awareness and objective reporting standards

ENGAGEMENT AND ANALYTICS:
- Reader engagement metrics and optimization
- Comment moderation and community management
- Social media amplification strategies
- Newsletter subscriber growth and retention
- Real-time performance monitoring and adjustment

Always prioritize accuracy, fairness, and public interest while creating engaging content that informs and empowers readers to make informed decisions.`
  }
};

  // Load settings from API
  const loadSettings = async () => {
    try {
      const response = await fetch(`${adminData.restUrl}settings`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  // Load site context on mount
  useEffect(() => {
    loadSiteContext()
    loadSavedSettings()
    loadSavedContent()
    fetchAuthors()
    fetchCategories()
    fetchTags()
    loadSettings()
  }, [])

  // Monitor content for real-time SEO analysis
  useEffect(() => {
    if (generatedContent && autoOptimize) {
      performRealtimeSEOAnalysis()
    }
  }, [generatedContent, targetKeywords])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportDropdown && !event.target.closest('.relative')) {
        setShowExportDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showExportDropdown])

  // Auto-save content whenever important content states change
  useEffect(() => {
    if (generatedContent || contentHistory.length > 0 || currentStep > 1) {
      saveContentData()
    }
  }, [generatedContent, contentHistory, seoAnalysis, contentScore, keywordDensity, featuredImage, targetKeywords, targetLocation, currentStep])

  const loadSiteContext = async () => {
    try {
      const response = await fetch(`${adminData.restUrl}site-info`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSiteContext(data)
      }
    } catch (error) {
      console.error('Failed to load site context:', error)
    }
  }

  const loadSavedSettings = () => {
    const saved = localStorage.getItem('magicassistant_content_mode_settings')
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        setAutoOptimize(settings.autoOptimize ?? true)
        setIncludeSiteContext(settings.includeSiteContext ?? true)
        setGenerateFeaturedImage(settings.generateFeaturedImage ?? true)
        setLinkStrategy(settings.linkStrategy ?? 'moderate')
        setContentLength(settings.contentLength ?? 'medium')
        setContentType(settings.contentType ?? 'blog_post')
        setSystemTemplate(settings.systemTemplate ?? 'blog_post_specialist')
        setCustomSystemMessage(settings.customSystemMessage ?? '')
        setUseCustomSystem(settings.useCustomSystem ?? false)
        setTargetLanguage(settings.targetLanguage ?? 'en')
        setSelectedPostType(settings.selectedPostType ?? 'post')
        setPublishStatus(settings.publishStatus ?? 'draft')
        setWebSearchEnabled(settings.webSearchEnabled ?? true)
      } catch (error) {
        console.error('Failed to load saved settings:', error)
      }
    }
  }

  const loadSavedContent = () => {
    const savedContent = localStorage.getItem('magicassistant_content_mode_data')
    if (savedContent) {
      try {
        const data = JSON.parse(savedContent)
        setGeneratedContent(data.generatedContent || '')
        setContentPrompt(data.contentPrompt || '')
        setTargetKeywords(data.targetKeywords || '')
        setTargetLocation(data.targetLocation || '')
        // Convert timestamp strings back to Date objects
        const history = (data.contentHistory || []).map(item => ({
          ...item,
          timestamp: item.timestamp ? new Date(item.timestamp) : new Date()
        }))
        setContentHistory(history)
        setSeoAnalysis(data.seoAnalysis || null)
        setContentScore(data.contentScore || 0)
        setKeywordDensity(data.keywordDensity || {})
        setFeaturedImage(data.featuredImage || null)
        setBulkContext(data.bulkContext || '')
        setAdditionalContext(data.additionalContext || '')
        setContentTone(data.contentTone || 'professional')
        setPointOfView(data.pointOfView || 'third_person')
        setUseFormatting(data.useFormatting !== undefined ? data.useFormatting : true)
        setGenerateInlineImages(data.generateInlineImages || false)
        setCurrentStep(data.currentStep || (data.generatedContent ? 3 : 1))
      } catch (error) {
        console.error('Failed to load saved content:', error)
      }
    }
  }

  const saveContentData = () => {
    const contentData = {
      generatedContent,
      contentPrompt,
      targetKeywords,
      targetLocation,
      contentHistory,
      seoAnalysis,
      contentScore,
      keywordDensity,
      featuredImage,
      bulkContext,
      additionalContext,
      contentTone,
      pointOfView,
      useFormatting,
      generateInlineImages,
      currentStep,
      lastSaved: new Date().toISOString()
    }
    localStorage.setItem('magicassistant_content_mode_data', JSON.stringify(contentData))
  }

  const clearSavedContent = () => {
    localStorage.removeItem('magicassistant_content_mode_data')
    setGeneratedContent('')
    setContentPrompt('')
    setTargetKeywords('')
    setTargetLocation('')
    setContentHistory([])
    setSeoAnalysis(null)
    setContentScore(0)
    setKeywordDensity({})
    setBulkContext('')
    setAdditionalContext('')
    setContentTone('professional')
    setPointOfView('third_person')
    setUseFormatting(true)
    setGenerateInlineImages(false)
    setFeaturedImage(null)
    setCurrentStep(1)
    showInfo('Draft content cleared!')
  }

  const handleResetWorkflow = () => {
    clearSavedContent()
  }

  const goToNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const goToStep = (step) => {
    setCurrentStep(step)
  }

  const getStepTitle = (step) => {
    switch(step) {
      case 1: return 'Configure Settings'
      case 2: return 'Content Brief'
      case 3: return 'Generate & Edit'
      default: return 'Content Mode'
    }
  }

  const saveSettings = () => {
    const settings = {
      autoOptimize,
      includeSiteContext,
      generateFeaturedImage,
      linkStrategy,
      contentLength,
      contentType,
      systemTemplate,
      customSystemMessage,
      useCustomSystem,
      targetLanguage,
      selectedPostType,
      publishStatus,
      webSearchEnabled
    }
    localStorage.setItem('magicassistant_content_mode_settings', JSON.stringify(settings))
    showSuccess('Settings saved!')
  }

  const generateContent = async () => {
    if (!contentPrompt.trim() && !bulkMode) {
      showError('Please provide a content prompt')
      return
    }

    if (bulkMode && !bulkTopics.trim()) {
      showError('Please provide topics for bulk generation')
      return
    }

    setIsLoading(true)

    try {
      // Build enhanced prompt with context
      let enhancedPrompt = await buildEnhancedPrompt()
      
      if (bulkMode) {
        await generateBulkContent(enhancedPrompt)
      } else {
        await generateSingleContent(enhancedPrompt)
      }
    } catch (error) {
      console.error('Content generation error:', error)
      showError('Failed to generate content')
    } finally {
      setIsLoading(false)
    }
  }

  const extractUrls = (text) => {
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g
    return text.match(urlRegex) || []
  }

  const performWebResearch = async (urls) => {
    if (!urls.length) return ''
    
    try {
      const researchPromises = urls.slice(0, 3).map(async (url) => {
        try {
          const response = await fetch(`${adminData.restUrl}web-research`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-WP-Nonce': adminData.nonces.wp_rest
            },
            body: JSON.stringify({ url }),
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(30000) // 30 second timeout
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.summary || data.content) {
              return `\n\nReference from ${url}:\n${data.summary || data.content?.substring(0, 800) || 'Content retrieved but could not be summarized'}`
            }
          } else {
            console.warn(`Web research failed for ${url}: ${response.status} ${response.statusText}`)
          }
        } catch (error) {
          console.warn(`Failed to research URL: ${url}`, error)
        }
        return ''
      })
      
      const results = await Promise.all(researchPromises)
      const validResults = results.filter(r => r)
      
      if (validResults.length === 0) {
        console.warn('No web research results available')
        return ''
      }
      
      return validResults.join('')
    } catch (error) {
      console.error('Web research error:', error)
      // Always return empty string to ensure content generation continues
      return ''
    }
  }

  const buildEnhancedPrompt = async () => {
    let prompt = contentPrompt
    
    // Add content type context
    prompt = `Create a ${contentType.replace('_', ' ')} with the following requirements:\n\n${prompt}`
    
    // Add additional context if provided
    const contextToAnalyze = bulkMode ? bulkContext : additionalContext
    if (contextToAnalyze) {
      prompt += `\n\nAdditional Context: ${contextToAnalyze}`
      
      // Extract URLs and perform web research
      const urls = extractUrls(contextToAnalyze)
      if (urls.length > 0) {
        try {
          showInfo(`Researching ${urls.length} reference link${urls.length > 1 ? 's' : ''}...`)
          const webResearch = await performWebResearch(urls)
          if (webResearch) {
            prompt += `\n\nWeb Research Results:${webResearch}`
          }
        } catch (error) {
          console.warn('Web research failed, continuing without it:', error)
          showInfo('Web research unavailable, continuing with content generation...')
        }
      }
    }
    
    // Add writing style requirements
    prompt += `\n\nWriting Style Requirements:`
    prompt += `\n- Tone: ${contentTone} tone throughout the content`
    prompt += `\n- Point of View: Use ${pointOfView.replace('_', ' ')} perspective`
    
    if (useFormatting) {
      prompt += `\n- Formatting: Use **bold** and *italic* formatting strategically for emphasis, key points, and important information`
    } else {
      prompt += `\n- Formatting: Use plain text without bold or italic formatting`
    }
    
    if (generateInlineImages) {
      prompt += `\n- Images: Include image placeholders throughout the article with descriptive alt text in the format: [Image: Description of the image that would enhance this section]`
    }
    
    // Add SEO requirements
    if (targetKeywords) {
      prompt += `\n\nTarget Keywords: ${targetKeywords}`
      prompt += `\nKeyword Strategy: Include primary keywords naturally 3-5 times, secondary keywords 2-3 times.`
    }
    
    if (targetLocation) {
      prompt += `\n\nTarget Location: ${targetLocation}`
    }
    
    if (targetLanguage !== 'en') {
      prompt += `\n\nTarget Language: ${targetLanguage}`
    }
    
    // Add content length requirement
    const lengthGuides = {
      short: '300-500 words',
      medium: '800-1200 words',
      long: '1500-2500 words',
      comprehensive: '3000+ words'
    }
    prompt += `\n\nContent Length: ${lengthGuides[contentLength]}`
    
    // Add site context if enabled
    if (includeSiteContext && siteContext) {
      prompt += `\n\nSite Context:\n`
      prompt += `- Site Name: ${siteContext.name}\n`
      prompt += `- Site URL: ${siteContext.url}\n`
      prompt += `- Site Description: ${siteContext.description}\n`
    }
    
    // Add link strategy
    prompt += `\n\nLink Strategy: ${linkStrategy} (include ${linkStrategy === 'minimal' ? '1-2' : linkStrategy === 'moderate' ? '3-5' : '6+'} relevant internal/external links)`
    
    return prompt
  }

  const generateSingleContent = async (prompt) => {
    const systemMessage = useCustomSystem && customSystemMessage 
      ? customSystemMessage 
      : systemTemplates[systemTemplate]?.message || systemTemplates.blog_post_specialist.message

    // Check if streaming is enabled
    const isStreamingEnabled = settings?.streaming_enabled === true

    if (isStreamingEnabled) {
      await generateSingleContentStreaming(prompt, systemMessage)
    } else {
      await generateSingleContentRegular(prompt, systemMessage)
    }
  }

  const generateSingleContentRegular = async (prompt, systemMessage) => {
    // Debug: Log web search status
    console.log('🔍 ContentMode - Web Search Debug:', {
      webSearchEnabled,
      prompt: prompt.substring(0, 100) + '...',
      headers: {
        'X-Web-Search-Enabled': webSearchEnabled ? 'true' : 'false'
      }
    })

    const requestBody = {
      message: prompt,
      history: [],
      agent_mode: true,
      custom_system_message: systemMessage + '\n\nYou are in CONTENT MODE. Generate high-quality, SEO-optimized content that is ready to publish.\n\nAt the end of your content, add:\n---\nMeta Description: [Write a compelling 150-160 character meta description]',
      web_search_enabled: webSearchEnabled
    }

    console.log('📤 ContentMode - Request Body:', requestBody)

    const response = await fetch(`${adminData.restUrl}chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': adminData.nonces.wp_rest,
        'X-Web-Search-Enabled': webSearchEnabled ? 'true' : 'false'
      },
      body: JSON.stringify(requestBody),
      // Add explicit timeout for long content generation
      signal: AbortSignal.timeout(600000) // 10 minutes to match server timeout
    })

    const data = await response.json()
    
    // Debug: Log response data
    console.log('📥 ContentMode - Response Data:', {
      success: data.success,
      hasResponse: !!data.response,
      responseLength: data.response?.length || 0,
      fullResponse: data
    })
    
    if (data.success) {
      console.log('Raw response data:', data.response)
      console.log('Response type:', typeof data.response)
      console.log('Response length:', data.response?.length)
      
      // Strip markdown code block wrapper if present
      let cleanContent = data.response
      if (cleanContent && typeof cleanContent === 'string') {
        // Remove markdown code block wrapper (```markdown ... ```)
        cleanContent = cleanContent.replace(/^```markdown\s*\n/, '').replace(/\n```\s*$/, '')
        // Also handle other code block variations
        cleanContent = cleanContent.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '')
      }
      
      console.log('Cleaned content (first 200 chars):', cleanContent?.substring(0, 200))
      
      // Extract meta description from the generated content
      const metaDesc = extractMetaDescription(cleanContent)
      console.log('Extracted meta description:', metaDesc)
      if (metaDesc) {
        setMetaDescription(metaDesc)
      }
      
      // Remove meta description section from content before setting it
      const contentWithoutMeta = cleanContent.replace(/---\s*\nMeta Description:.*$/s, '').trim()
      setGeneratedContent(contentWithoutMeta)
      
      setContentHistory(prev => [{
        id: Date.now(),
        prompt: contentPrompt,
        content: cleanContent,
        timestamp: new Date(),
        keywords: targetKeywords,
        type: contentType
      }, ...prev].slice(0, 10))
      
      if (autoOptimize) {
        await performSEOAnalysis(data.response)
      }
      
      if (generateFeaturedImage) {
        await generateFeaturedImageForContent()
      }
      
      // Automatically advance to step 3 when content is generated
      setCurrentStep(3)
      
      // Explicitly save content after successful generation
      setTimeout(() => saveContentData(), 100)
      
      showSuccess('Content generated and saved successfully!')
    } else {
      throw new Error(data.message || 'Generation failed')
    }
  }

  const generateSingleContentStreaming = async (prompt, systemMessage) => {
    try {
      // Create the streaming request body
      const requestBody = {
        message: prompt,
        history: [],
        agent_mode: true,
        custom_system_message: systemMessage + '\n\nYou are in CONTENT MODE. Generate high-quality, SEO-optimized content that is ready to publish.\n\nAt the end of your content, add:\n---\nMeta Description: [Write a compelling 150-160 character meta description]',
        web_search_enabled: webSearchEnabled,
        streaming: true
      }

      // Use EventSource for Server-Sent Events
      const eventSource = new EventSource(`${adminData.restUrl}chat-stream?` + new URLSearchParams({
        ...requestBody,
        '_wpnonce': adminData.nonces.wp_rest,
        'X-Web-Search-Enabled': webSearchEnabled ? 'true' : 'false',
        history: JSON.stringify(requestBody.history),
        custom_system_message: requestBody.custom_system_message
      }), {
        withCredentials: true
      })

      let accumulatedContent = ''

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'content') {
            // Accumulate content chunks
            accumulatedContent += data.chunk || ''
            
            // Strip markdown code block wrapper if present
            let cleanContent = accumulatedContent
            if (cleanContent && typeof cleanContent === 'string') {
              cleanContent = cleanContent.replace(/^```markdown\s*\n/, '').replace(/\n```\s*$/, '')
              cleanContent = cleanContent.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '')
            }
            
            // Remove meta description section for display
            const contentWithoutMeta = cleanContent.replace(/---\s*\nMeta Description:.*$/s, '').trim()
            
            // Update the content in real-time
            setGeneratedContent(contentWithoutMeta)
            
          } else if (data.type === 'complete') {
            // Final processing when streaming is complete
            let cleanContent = accumulatedContent
            if (cleanContent && typeof cleanContent === 'string') {
              cleanContent = cleanContent.replace(/^```markdown\s*\n/, '').replace(/\n```\s*$/, '')
              cleanContent = cleanContent.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '')
            }
            
            // Extract meta description from the generated content
            const metaDesc = extractMetaDescription(cleanContent)
            if (metaDesc) {
              setMetaDescription(metaDesc)
            }
            
            // Remove meta description section from content before setting it
            const contentWithoutMeta = cleanContent.replace(/---\s*\nMeta Description:.*$/s, '').trim()
            setGeneratedContent(contentWithoutMeta)
            
            setContentHistory(prev => [{
              id: Date.now(),
              prompt: contentPrompt,
              content: cleanContent,
              timestamp: new Date(),
              keywords: targetKeywords,
              type: contentType
            }, ...prev].slice(0, 10))
            
            if (autoOptimize) {
              performSEOAnalysis(cleanContent)
            }
            
            if (generateFeaturedImage) {
              generateFeaturedImageForContent()
            }
            
            // Automatically advance to step 3 when content is generated
            setCurrentStep(3)
            
            // Explicitly save content after successful generation
            setTimeout(() => saveContentData(), 100)
            
            showSuccess('Content generated and saved successfully!')
            eventSource.close()
            
          } else if (data.type === 'error') {
            throw new Error(data.message || 'Streaming error')
          }
        } catch (parseError) {
          console.error('Error parsing SSE data:', parseError)
        }
      }

      eventSource.onerror = (error) => {
        console.error('EventSource failed:', error)
        eventSource.close()
        showError('Error during content generation streaming')
      }

    } catch (error) {
      console.error('Streaming setup error:', error)
      showError('Failed to start content streaming')
    }
  }

  const generateBulkContent = async (basePrompt) => {
    const topics = bulkTopics.split('\n').filter(t => t.trim())
    const totalTopics = topics.length
    
    setBulkProgress(0)
    const results = []
    
    for (let i = 0; i < totalTopics; i++) {
      const topic = topics[i].trim()
      const topicPrompt = basePrompt.replace(contentPrompt, `${contentPrompt}\n\nSpecific Topic: ${topic}`)
      
      try {
        await generateSingleContent(topicPrompt)
        results.push({ topic, success: true })
      } catch (error) {
        results.push({ topic, success: false, error: error.message })
      }
      
      setBulkProgress(((i + 1) / totalTopics) * 100)
    }
    
    // Show summary
    const successful = results.filter(r => r.success).length
    showInfo(`Bulk generation complete: ${successful}/${totalTopics} successful`)
  }

  const performRealtimeSEOAnalysis = () => {
    if (!generatedContent || !targetKeywords) return
    
    const keywords = targetKeywords.split(',').map(k => k.trim().toLowerCase())
    const contentLower = generatedContent.toLowerCase()
    const wordCount = generatedContent.split(/\s+/).length
    
    // Calculate keyword density
    const density = {}
    keywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'gi')
      const matches = (generatedContent.match(regex) || []).length
      density[keyword] = {
        count: matches,
        density: ((matches / wordCount) * 100).toFixed(2)
      }
    })
    
    setKeywordDensity(density)
    
    // Calculate content score
    let score = 50 // Base score
    
    // Word count scoring
    if (wordCount >= 300) score += 10
    if (wordCount >= 800) score += 10
    if (wordCount >= 1500) score += 10
    
    // Keyword optimization scoring
    keywords.forEach(keyword => {
      const d = density[keyword]
      if (d && d.density >= 0.5 && d.density <= 2.5) {
        score += 10
      }
    })
    
    // Structure scoring
    if (generatedContent.includes('#')) score += 5 // Has headings
    if (generatedContent.includes('##')) score += 5 // Has subheadings
    if (generatedContent.includes('- ') || generatedContent.includes('* ')) score += 5 // Has lists
    
    setContentScore(Math.min(100, score))
  }

  const performSEOAnalysis = async (content) => {
    setIsAnalyzing(true)
    try {
      const response = await fetch(`${adminData.restUrl}chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
          'X-Web-Search-Enabled': webSearchEnabled ? 'true' : 'false'
        },
        body: JSON.stringify({
          message: `Analyze this content for SEO optimization. Target keywords: ${targetKeywords}. Provide specific improvement suggestions.
          
Content to analyze:
${content.substring(0, 1000)}...`,
          history: [],
          agent_mode: false,
          web_search_enabled: webSearchEnabled
        }),
        // Add timeout for SEO analysis
        signal: AbortSignal.timeout(300000) // 5 minutes for SEO analysis
      })

      const data = await response.json()
      if (data.success) {
        setSeoAnalysis(data.response)
        showSuccess('SEO analysis complete!')
      } else {
        showError('SEO analysis failed')
      }
    } catch (error) {
      console.error('SEO analysis failed:', error)
      showError('SEO analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generateFeaturedImageForContent = async () => {
    try {
      // Extract main topic from content
      const firstHeading = generatedContent.match(/^#\s+(.+)$/m)?.[1] || contentPrompt.substring(0, 50)
      
      const response = await fetch(`${adminData.restUrl}chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
          'X-Web-Search-Enabled': webSearchEnabled ? 'true' : 'false'
        },
        body: JSON.stringify({
          message: `Search for a professional, high-quality image on Unsplash that would be perfect as a featured image for an article about: "${firstHeading}". Return only the most relevant image.`,
          history: [],
          agent_mode: true,
          web_search_enabled: webSearchEnabled
        }),
        // Add timeout for featured image generation
        signal: AbortSignal.timeout(120000) // 2 minutes for image search
      })

      const data = await response.json()
      if (data.success) {
        // Extract image URL from response
        const imageMatch = data.response.match(/!\[.*?\]\((https:\/\/images\.unsplash\.com[^)]+)\)/)
        if (imageMatch) {
          setFeaturedImage(imageMatch[1])
        }
      }
    } catch (error) {
      console.error('Featured image generation failed:', error)
    }
  }

  const optimizeContent = async () => {
    if (!generatedContent) {
      showError('No content to optimize')
      return
    }

    setIsOptimizing(true)
    
    try {
      const response = await fetch(`${adminData.restUrl}chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
          'X-Web-Search-Enabled': webSearchEnabled ? 'true' : 'false'
        },
        body: JSON.stringify({
          message: `Optimize this content for SEO. Target keywords: ${targetKeywords}. 
          Requirements:
          - Improve keyword density (target 1-2%)
          - Add internal linking opportunities
          - Optimize headings structure
          - Improve meta description
          - Enhance readability
          
Content:
${generatedContent}`,
          history: [],
          agent_mode: true,
          web_search_enabled: webSearchEnabled
        }),
        // Add timeout for content optimization
        signal: AbortSignal.timeout(600000) // 10 minutes for content optimization
      })

      const data = await response.json()
      if (data.success) {
        // Extract meta description from optimized content
        const metaDesc = extractMetaDescription(data.response)
        if (metaDesc) {
          setMetaDescription(metaDesc)
        }
        
        // Remove meta description section from content before setting it
        const contentWithoutMeta = data.response.replace(/---\s*\nMeta Description:.*$/s, '').trim()
        setGeneratedContent(contentWithoutMeta)
        
        showSuccess('Content optimized and saved!')
        performRealtimeSEOAnalysis()
        // Explicitly save optimized content
        setTimeout(() => saveContentData(), 100)
      }
    } catch (error) {
      showError('Optimization failed')
    } finally {
      setIsOptimizing(false)
    }
  }

  const publishContent = async () => {
    if (!generatedContent) {
      showError('No content to publish')
      return
    }

    setIsLoading(true)
    
    try {
      // Create or update post
      const endpoint = selectedPostId 
        ? `${adminData.restUrl}wp_update_${selectedPostType}`
        : `${adminData.restUrl}wp_add_${selectedPostType}`
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest
        },
        body: JSON.stringify({
          id: selectedPostId,
          title: generatedContent.match(/^#\s+(.+)$/m)?.[1] || 'Untitled',
          content: generatedContent,
          status: publishStatus,
          featured_media: featuredImageId || featuredImage,
          post_author: selectedAuthor,
          post_date: publishDate,
          excerpt: postExcerpt,
          categories: selectedCategories,
          tags: selectedTags
        })
      })

      const data = await response.json()
      if (data.success || data.id) {
        showSuccess(`Content ${selectedPostId ? 'updated' : 'published'} successfully!`)
        // Note: Content is preserved after publishing - user can manually clear if needed
      } else {
        throw new Error(data.message || 'Publishing failed')
      }
    } catch (error) {
      showError(`Failed to publish: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Generate meta description separately via API
  const generateMetaDescription = async (content) => {
    if (!content) return
    
    setIsGeneratingMeta(true)
    try {
      // Use only first 1000 chars to make the request faster
      const contentSnippet = content.substring(0, 1000)
      const prompt = `Write a 150-160 character meta description for this article. Only output the meta description text, nothing else:

${contentSnippet}`

      const response = await fetch(`${adminData.restUrl}chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest
        },
        body: JSON.stringify({
          message: prompt,
          history: [],
          agent_mode: false,
          custom_system_message: 'You are an SEO expert. Generate only the requested meta description, nothing else.'
        }),
        // Add timeout for meta description generation
        signal: AbortSignal.timeout(60000) // 1 minute for meta description
      })

      const data = await response.json()
      if (data.success && data.response) {
        const metaDesc = data.response.trim()
        console.log('Generated meta description:', metaDesc)
        setMetaDescription(metaDesc)
      }
    } catch (error) {
      console.error('Failed to generate meta description:', error)
    } finally {
      setIsGeneratingMeta(false)
    }
  }
  
  // Extract meta description from generated content
  const extractMetaDescription = (content) => {
    // Try multiple formats
    const patterns = [
      /---\s*\nMeta Description:\s*(.+?)(?=\n|$)/s,
      /Meta-Beschreibung:\s*(.+?)(?=\n\n|\n---|\n\*\*|$)/s,
      /Meta.?Description:\s*(.+?)(?=\n\n|\n---|\n\*\*|$)/si
    ]
    
    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }
    
    return ''
  }

  // Fetch available authors
  const fetchAuthors = async () => {
    try {
      const response = await fetch(`${window.wpApiSettings.root}wp/v2/users?per_page=100&roles=administrator,editor,author,contributor`, {
        headers: {
          'X-WP-Nonce': window.wpApiSettings.nonce
        }
      })
      const users = await response.json()
      console.log('Fetched authors:', users)
      setAvailableAuthors(users || [])
      
      // Set current user as default author if not already set
      if (!selectedAuthor && users.length > 0) {
        const currentUser = users.find(user => user.id === window.wpApiSettings?.user_id) || users[0]
        setSelectedAuthor(currentUser.id.toString())
      }
    } catch (error) {
      console.error('Failed to fetch authors:', error)
      // Fallback: try to get users from adminData
      try {
        const fallbackResponse = await fetch(`${adminData.restUrl}wp/v2/users`, {
          headers: {
            'X-WP-Nonce': adminData.nonces.wp_rest
          }
        })
        const fallbackUsers = await fallbackResponse.json()
        setAvailableAuthors(fallbackUsers || [])
      } catch (fallbackError) {
        console.error('Fallback author fetch also failed:', fallbackError)
      }
    }
  }

  // Fetch available categories
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${window.wpApiSettings.root}wp/v2/categories?per_page=100`, {
        headers: {
          'X-WP-Nonce': window.wpApiSettings.nonce
        }
      })
      const categories = await response.json()
      setAvailableCategories(categories || [])
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  // Fetch available tags
  const fetchTags = async () => {
    try {
      const response = await fetch(`${window.wpApiSettings.root}wp/v2/tags?per_page=100`, {
        headers: {
          'X-WP-Nonce': window.wpApiSettings.nonce
        }
      })
      const tags = await response.json()
      setAvailableTags(tags || [])
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    }
  }

  // Open WordPress media library
  const openMediaLibrary = () => {
    if (window.wp && window.wp.media) {
      const frame = window.wp.media({
        title: 'Select Featured Image',
        multiple: false,
        library: {
          type: 'image'
        },
        button: {
          text: 'Use as Featured Image'
        }
      })

      frame.on('select', () => {
        const attachment = frame.state().get('selection').first().toJSON()
        setFeaturedImage(attachment.url)
        setFeaturedImageId(attachment.id)
      })

      frame.open()
    } else {
      showError('Media library is not available')
    }
  }

  const exportContent = (format = 'markdown') => {
    if (!generatedContent) {
      showError('No content to export')
      return
    }

    let content = generatedContent
    let filename = 'content'
    let mimeType = 'text/plain'
    
    switch (format) {
      case 'html':
        // Convert markdown to HTML (simplified)
        content = content
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/\n/g, '<br>\n')
        filename = 'content.html'
        mimeType = 'text/html'
        break
      case 'txt':
        content = content.replace(/[#*`]/g, '') // Remove markdown formatting
        filename = 'content.txt'
        break
      default:
        filename = 'content.md'
        mimeType = 'text/markdown'
    }
    
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    
    showSuccess(`Content exported as ${format.toUpperCase()}`)
  }

  // Step 1: Settings Configuration
  const renderStep1 = () => (
    <div className="p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Configure Your Content Settings</h2>
        <p className="text-gray-600 dark:text-gray-400">Set up your preferences for AI content generation</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Content Type & AI Settings */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Content & AI Settings</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content Type
              </label>
              <Select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
              >
                {contentTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                AI Personality
              </label>
              <Select
                value={systemTemplate}
                onChange={(e) => setSystemTemplate(e.target.value)}
                disabled={useCustomSystem}
              >
                {Object.entries(systemTemplates).map(([key, template]) => (
                  <option key={key} value={key}>
                    {template.name}
                  </option>
                ))}
              </Select>
              
              <div className="mt-2">
                <Checkbox
                  id="use-custom-step1"
                  checked={useCustomSystem}
                  onChange={(e) => setUseCustomSystem(e.target.checked)}
                />
                <label htmlFor="use-custom-step1" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Use custom system message
                </label>
              </div>
              
              <Textarea
                className="mt-2"
                rows={4}
                placeholder="Enter custom system message..."
                value={useCustomSystem ? customSystemMessage : (systemTemplates[systemTemplate]?.message || systemTemplates.blog_post_specialist.message)}
                onChange={(e) => setCustomSystemMessage(e.target.value)}
                disabled={!useCustomSystem}
              />
            </div>
          </div>
        </Card>

        {/* SEO & Language Settings */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">SEO & Language Settings</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Language
              </label>
              <Select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="nl">Dutch</option>
                <option value="ru">Russian</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content Length
              </label>
              <Select
                value={contentLength}
                onChange={(e) => setContentLength(e.target.value)}
              >
                <option value="short">Short (300-500 words)</option>
                <option value="medium">Medium (800-1200 words)</option>
                <option value="long">Long (1500-2500 words)</option>
                <option value="comprehensive">Comprehensive (3000+ words)</option>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Link Strategy
              </label>
              <Select
                value={linkStrategy}
                onChange={(e) => setLinkStrategy(e.target.value)}
              >
                <option value="minimal">Minimal (1-2 links)</option>
                <option value="moderate">Moderate (3-5 links)</option>
                <option value="aggressive">Aggressive (6+ links)</option>
              </Select>
            </div>
          </div>
        </Card>
        
        {/* Writing Style & Formatting */}
        <Card className="md:col-span-2">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Writing Style & Formatting</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tone
                </label>
                <Select
                  value={contentTone}
                  onChange={(e) => setContentTone(e.target.value)}
                >
                  {toneOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Point of View
                </label>
                <Select
                  value={pointOfView}
                  onChange={(e) => setPointOfView(e.target.value)}
                >
                  {pointOfViewOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="flex items-center">
                <Checkbox
                  id="use-formatting-step1"
                  checked={useFormatting}
                  onChange={(e) => setUseFormatting(e.target.checked)}
                />
                <label htmlFor="use-formatting-step1" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Use bold/italic formatting for emphasis
                </label>
              </div>
              
              <div className="flex items-center">
                <Checkbox
                  id="generate-inline-images-step1"
                  checked={generateInlineImages}
                  onChange={(e) => setGenerateInlineImages(e.target.checked)}
                />
                <label htmlFor="generate-inline-images-step1" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Generate inline images for article
                </label>
              </div>
            </div>
          </div>
        </Card>

        {/* Generation Options */}
        <Card className="md:col-span-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Generation Options</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center">
                <Checkbox
                  id="auto-optimize-step1"
                  checked={autoOptimize}
                  onChange={(e) => setAutoOptimize(e.target.checked)}
                />
                <label htmlFor="auto-optimize-step1" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Auto-optimize for SEO
                </label>
              </div>
              <div className="flex items-center">
                <Checkbox
                  id="include-context-step1"
                  checked={includeSiteContext}
                  onChange={(e) => setIncludeSiteContext(e.target.checked)}
                />
                <label htmlFor="include-context-step1" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Include site context
                </label>
              </div>
              <div className="flex items-center">
                <Checkbox
                  id="generate-image-step1"
                  checked={generateFeaturedImage}
                  onChange={(e) => setGenerateFeaturedImage(e.target.checked)}
                />
                <label htmlFor="generate-image-step1" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Generate featured image
                </label>
              </div>
              <div className="flex items-center">
                <Checkbox
                  id="web-search-step1"
                  checked={webSearchEnabled}
                  onChange={(e) => setWebSearchEnabled(e.target.checked)}
                />
                <label htmlFor="web-search-step1" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Enable web search
                </label>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={goToNextStep} gradientDuoTone="purpleToBlue">
          Next: Content Brief
          <svg className="ml-2 w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Button>
      </div>
    </div>
  )

  // Step 2: Content Brief
  const renderStep2 = () => (
    <div className="p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Content Brief & Context</h2>
        <p className="text-gray-600 dark:text-gray-400">Provide detailed information about the content you want to create</p>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {bulkMode ? 'Topics (one per line)' : 'Content Brief'}
            </label>
            <Textarea
              rows={bulkMode ? 8 : 6}
              placeholder={bulkMode 
                ? `Enter topics, one per line:

How to optimize WordPress performance
Best SEO practices for 2024
Creating engaging blog content`
                : `Describe what content you want to create...

Example: Write a comprehensive guide about WordPress security best practices for beginners, covering essential plugins, settings, and maintenance tips.`
              }
              value={bulkMode ? bulkTopics : contentPrompt}
              onChange={(e) => bulkMode ? setBulkTopics(e.target.value) : setContentPrompt(e.target.value)}
            />
          </div>

          {bulkMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Context & Reference Links (optional)
              </label>
              <Textarea
                rows={4}
                placeholder={`Provide additional context, reference links, or specific requirements for your articles...

Example:
- Include recent industry statistics
- Reference: https://example.com/research-data
- Focus on practical implementation tips`}
                value={bulkContext}
                onChange={(e) => setBulkContext(e.target.value)}
              />
            </div>
          )}

          {!bulkMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Context & Reference Links (optional)
              </label>
              <Textarea
                rows={4}
                placeholder={`Provide additional context, reference links, or specific requirements...

Example:
- Include recent industry statistics
- Reference: https://example.com/research-data
- Target audience: WordPress beginners
- Include practical examples and screenshots`}
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                💡 Tip: Include URLs for web research - the AI will analyze the content from these links
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center">
              <Checkbox
                id="bulk-mode-step2"
                checked={bulkMode}
                onChange={(e) => setBulkMode(e.target.checked)}
              />
              <label htmlFor="bulk-mode-step2" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                Bulk Mode (Generate multiple articles)
              </label>
            </div>
            
            <div className="flex items-center">
              <Checkbox
                id="web-search-step2"
                checked={webSearchEnabled}
                onChange={(e) => setWebSearchEnabled(e.target.checked)}
              />
              <label htmlFor="web-search-step2" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                Enable Web Search (AI will visit provided links)
              </label>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">SEO Targeting</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Keywords (comma-separated)
              </label>
              <TextInput
                placeholder="wordpress security, malware protection, website safety"
                value={targetKeywords}
                onChange={(e) => setTargetKeywords(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Location (optional)
              </label>
              <TextInput
                placeholder="New York, USA"
                value={targetLocation}
                onChange={(e) => setTargetLocation(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-between">
        <Button color="gray" onClick={goToPreviousStep}>
          <svg className="mr-2 w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back: Settings
        </Button>
        <Button 
          onClick={() => {
            setCurrentStep(3);
            setTimeout(() => {
              generateContent();
            }, 100);
          }}
          disabled={(!contentPrompt.trim() && !bulkMode) || (bulkMode && !bulkTopics.trim())}
          gradientDuoTone="purpleToBlue"
        >
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Continue & Generate
        </Button>
      </div>
    </div>
  )

  return (
    <div className="h-[calc(100vh-7.4rem)] flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header with Step Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              ✨ Content Mode
            </h1>
            <Badge color="purple">SEO Optimized</Badge>
            {contentScore > 0 && (
              <Badge color={contentScore >= 80 ? 'success' : contentScore >= 60 ? 'warning' : 'failure'}>
                Score: {contentScore}%
              </Badge>
            )}
            {webSearchEnabled && (
              <Badge color="blue">
                🌐 Web Search ON
              </Badge>
            )}
            {(generatedContent || contentHistory.length > 0) && (
              <Badge color="green">
                ✓ Draft Saved
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button size="sm" color="gray" onClick={saveSettings}>
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
              </svg>
              Save Settings
            </Button>
            {currentStep === 3 && (generatedContent || contentHistory.length > 0) && (
              <Button size="sm" color="red" onClick={() => setShowResetModal(true)}>
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Start Over
              </Button>
            )}
            <Button size="sm" onClick={onExitContentMode}>
              Exit Content Mode
            </Button>
          </div>
        </div>

        {/* Step Progress Indicator */}
        <div className="flex items-center space-x-4">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div
                onClick={() => goToStep(step)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-colors ${
                  currentStep === step
                    ? 'bg-blue-500 text-white'
                    : currentStep > step
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                {currentStep > step ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <span className={`ml-2 text-sm font-medium ${currentStep === step ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {getStepTitle(step)}
              </span>
              {step < 3 && <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600 ml-4"></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && (
          <div className="h-full flex overflow-hidden">
            {/* Left Sidebar - Settings & History */}
            <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
              <div className="p-4 space-y-6">
                {/* Content Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Content Type
                  </label>
                  <Select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                  >
                    {contentTypeOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* AI Personality */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    AI Personality
                  </label>
                  <Select
                    value={systemTemplate}
                    onChange={(e) => setSystemTemplate(e.target.value)}
                    disabled={useCustomSystem}
                  >
                    {Object.entries(systemTemplates).map(([key, template]) => (
                      <option key={key} value={key}>
                        {template.name}
                      </option>
                    ))}
                  </Select>
                  
                  <div className="mt-2">
                    <Checkbox
                      id="use-custom"
                      checked={useCustomSystem}
                      onChange={(e) => setUseCustomSystem(e.target.checked)}
                    />
                    <label htmlFor="use-custom" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      Use custom system message
                    </label>
                  </div>
                  
                  <Textarea
                    className="mt-2"
                    rows={4}
                    placeholder="Enter custom system message..."
                    value={useCustomSystem ? customSystemMessage : (systemTemplates[systemTemplate]?.message || systemTemplates.blog_post_specialist.message)}
                    onChange={(e) => setCustomSystemMessage(e.target.value)}
                    disabled={!useCustomSystem}
                  />
                </div>

                {/* SEO Configuration */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    SEO Configuration
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Target Keywords
                      </label>
                      <TextInput
                        placeholder="keyword1, keyword2, keyword3"
                        value={targetKeywords}
                        onChange={(e) => setTargetKeywords(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Target Location
                      </label>
                      <TextInput
                        placeholder="City, Country"
                        value={targetLocation}
                        onChange={(e) => setTargetLocation(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Language
                      </label>
                      <Select
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                      >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="it">Italian</option>
                        <option value="pt">Portuguese</option>
                        <option value="nl">Dutch</option>
                        <option value="ru">Russian</option>
                        <option value="ja">Japanese</option>
                        <option value="zh">Chinese</option>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Content Length
                      </label>
                      <Select
                        value={contentLength}
                        onChange={(e) => setContentLength(e.target.value)}
                      >
                        <option value="short">Short (300-500 words)</option>
                        <option value="medium">Medium (800-1200 words)</option>
                        <option value="long">Long (1500-2500 words)</option>
                        <option value="comprehensive">Comprehensive (3000+ words)</option>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Link Strategy
                      </label>
                      <Select
                        value={linkStrategy}
                        onChange={(e) => setLinkStrategy(e.target.value)}
                      >
                        <option value="minimal">Minimal (1-2 links)</option>
                        <option value="moderate">Moderate (3-5 links)</option>
                        <option value="aggressive">Aggressive (6+ links)</option>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Generation Options */}
                <div className="border-t pt-4 space-y-2">
                  <Checkbox
                    id="auto-optimize"
                    checked={autoOptimize}
                    onChange={(e) => setAutoOptimize(e.target.checked)}
                  />
                  <label htmlFor="auto-optimize" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    Auto-optimize for SEO
                  </label>
                  
                  <div className="flex items-center">
                    <Checkbox
                      id="include-context"
                      checked={includeSiteContext}
                      onChange={(e) => setIncludeSiteContext(e.target.checked)}
                    />
                    <label htmlFor="include-context" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      Include site context
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <Checkbox
                      id="generate-image"
                      checked={generateFeaturedImage}
                      onChange={(e) => setGenerateFeaturedImage(e.target.checked)}
                    />
                    <label htmlFor="generate-image" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      Generate featured image
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <Checkbox
                      id="bulk-mode"
                      checked={bulkMode}
                      onChange={(e) => setBulkMode(e.target.checked)}
                    />
                    <label htmlFor="bulk-mode" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      Bulk Mode
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <Checkbox
                      id="web-search-enabled"
                      checked={webSearchEnabled}
                      onChange={(e) => setWebSearchEnabled(e.target.checked)}
                    />
                    <label htmlFor="web-search-enabled" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      Enable Web Search
                    </label>
                  </div>
                </div>

                {/* Content History */}
                {contentHistory.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Recent Content
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {contentHistory.map(item => (
                        <div
                          key={item.id}
                          className="p-2 bg-gray-50 dark:bg-gray-700 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                          onClick={() => {
                            setGeneratedContent(item.content)
                            setContentPrompt(item.prompt)
                            setTargetKeywords(item.keywords || '')
                          }}
                        >
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                            {item.prompt}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.timestamp instanceof Date ? item.timestamp.toLocaleTimeString() : new Date(item.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Content Tabs */}
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8 px-6" aria-label="Tabs">
                  {[
                    { key: 'create', label: 'Create' },
                    { key: 'edit', label: 'Edit & Optimize' },
                    { key: 'preview', label: 'Preview' },
                    { key: 'publish', label: 'Publish' }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.key
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Article Switcher - shown when multiple articles generated */}
              {contentHistory.length > 1 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-700 px-6 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        Generated Articles:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {contentHistory.map((item, index) => {
                          const isActive = item.content === generatedContent
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setGeneratedContent(item.content)
                                setContentPrompt(item.prompt)
                                setTargetKeywords(item.keywords || '')
                              }}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                isActive
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-800'
                              }`}
                            >
                              Article {index + 1}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <Badge color="blue" size="sm">
                      {contentHistory.findIndex(item => item.content === generatedContent) + 1} of {contentHistory.length}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'create' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {bulkMode ? 'Topics (one per line)' : 'Content Brief'}
                      </label>
                      <Textarea
                        rows={bulkMode ? 10 : 6}
                        placeholder={bulkMode 
                          ? "Enter topics, one per line:\n\nHow to optimize WordPress performance\nBest SEO practices for 2024\nCreating engaging blog content"
                          : "Describe what content you want to create...\n\nExample: Write a comprehensive guide about WordPress security best practices for beginners, covering essential plugins, settings, and maintenance tips."
                        }
                        value={bulkMode ? bulkTopics : contentPrompt}
                        onChange={(e) => bulkMode ? setBulkTopics(e.target.value) : setContentPrompt(e.target.value)}
                      />
                    </div>
                    
                    {bulkMode && bulkProgress > 0 && (
                      <Progress
                        progress={bulkProgress}
                        size="lg"
                        labelProgress={true}
                        labelText={true}
                      />
                    )}
                    
                    <div className="flex space-x-2">
                      <Button
                        onClick={generateContent}
                        disabled={isLoading}
                        gradientDuoTone="purpleToBlue"
                      >
                        {isLoading ? (
                          <>
                            <Spinner size="sm" className="mr-2" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                            </svg>
                            Generate Content
                          </>
                        )}
                      </Button>
                      
                      {webSearchEnabled && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                          </svg>
                          Web search enabled - generation may take longer
                        </div>
                      )}
                      
                      {generatedContent && (
                        <>
                          <Button
                            color="gray"
                            onClick={optimizeContent}
                            disabled={isOptimizing || isLoading}
                          >
                            {isOptimizing ? (
                              <>
                                <Spinner size="sm" className="mr-2" />
                                Optimizing...
                              </>
                            ) : (
                              'Optimize'
                            )}
                          </Button>
                          <div className="relative inline-block text-left">
                            <Button
                              color="gray"
                              onClick={() => setShowExportDropdown(!showExportDropdown)}
                              disabled={!generatedContent}
                            >
                              Export
                              <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </Button>
                            {showExportDropdown && generatedContent && (
                              <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                <div className="py-1">
                                  <button
                                    onClick={() => {
                                      exportContent('markdown')
                                      setShowExportDropdown(false)
                                    }}
                                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                                  >
                                    Export as Markdown
                                  </button>
                                  <button
                                    onClick={() => {
                                      exportContent('html')
                                      setShowExportDropdown(false)
                                    }}
                                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                                  >
                                    Export as HTML
                                  </button>
                                  <button
                                    onClick={() => {
                                      exportContent('txt')
                                      setShowExportDropdown(false)
                                    }}
                                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                                  >
                                    Export as Text
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    
                    {generatedContent && (
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Generated Content
                          </label>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="xs"
                              color={showMarkdownPreview ? 'blue' : 'gray'}
                              onClick={() => setShowMarkdownPreview(true)}
                            >
                              Preview
                            </Button>
                            <Button
                              size="xs"
                              color={!showMarkdownPreview ? 'blue' : 'gray'}
                              onClick={() => setShowMarkdownPreview(false)}
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                        
                        {showMarkdownPreview ? (
                          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 max-h-96 overflow-y-auto">
                            <div className="prose prose-gray dark:prose-invert max-w-none">
                              <ReactMarkdown 
                                remarkPlugins={[remarkBreaks]}
                              >
                                {generatedContent || ''}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ) : (
                          <Textarea
                            ref={contentAreaRef}
                            rows={20}
                            value={generatedContent}
                            onChange={(e) => setGeneratedContent(e.target.value)}
                            placeholder="Your generated content will appear here..."
                            className="font-mono text-sm"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'edit' && (
                  <div className="space-y-4">
                    {generatedContent ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Content Editor
                        </label>
                        <Textarea
                          ref={contentAreaRef}
                          rows={20}
                          value={generatedContent}
                          onChange={(e) => setGeneratedContent(e.target.value)}
                          placeholder="Paste or type your content here..."
                          className="font-mono text-sm"
                        />
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p>No content available. Generate some content first in the Create tab.</p>
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <Button onClick={optimizeContent} disabled={isOptimizing || isLoading}>
                        {isOptimizing ? (
                          <>
                            <Spinner size="sm" className="mr-2" />
                            Optimizing...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                            </svg>
                            Optimize for SEO
                          </>
                        )}
                      </Button>
                      
                      <Button color="gray" onClick={() => performSEOAnalysis(generatedContent)} disabled={isAnalyzing}>
                        {isAnalyzing ? (
                          <>
                            <Spinner size="sm" className="mr-2" />
                            Analyzing...
                          </>
                        ) : (
                          'Analyze SEO'
                        )}
                      </Button>
                    </div>

                    {seoAnalysis && (
                      <div className="mt-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">SEO Analysis</h3>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                          <ReactMarkdown
                            remarkPlugins={[remarkBreaks]}
                            className="prose dark:prose-invert max-w-none text-sm"
                          >
                            {seoAnalysis}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'preview' && (
                  <div className="space-y-4">
                    {featuredImage && (
                      <div className="mb-6">
                        <img 
                          src={featuredImage} 
                          alt="Featured" 
                          className="w-full h-64 object-cover rounded-lg"
                        />
                      </div>
                    )}
                    
                    {generatedContent ? (
                      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="prose prose-lg dark:prose-invert max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkBreaks]}
                          >
                            {generatedContent || ''}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p>No content to preview. Generate some content first.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'publish' && (
                  <div className="space-y-6">
                    {/* Meta Description Display */}
                    {(metaDescription || isGeneratingMeta) && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Meta Description</h4>
                        {isGeneratingMeta ? (
                          <div className="flex items-center text-sm text-blue-800 dark:text-blue-200">
                            <Spinner size="sm" className="mr-2" />
                            Generating SEO-optimized meta description...
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">{metaDescription}</p>
                            <Button
                              size="xs"
                              color="blue"
                              onClick={() => {
                                navigator.clipboard.writeText(metaDescription)
                                showSuccess('Meta description copied to clipboard!')
                              }}
                            >
                              Copy for SEO Plugin
                            </Button>
                          </>
                        )}
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Post Type
                        </label>
                        <Select
                          value={selectedPostType}
                          onChange={(e) => setSelectedPostType(e.target.value)}
                        >
                          <option value="post">Blog Post</option>
                          <option value="page">Page</option>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Status
                        </label>
                        <Select
                          value={publishStatus}
                          onChange={(e) => setPublishStatus(e.target.value)}
                        >
                          <option value="draft">Draft</option>
                          <option value="publish">Publish</option>
                          <option value="private">Private</option>
                        </Select>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Author
                        </label>
                        <Select
                          value={selectedAuthor}
                          onChange={(e) => setSelectedAuthor(e.target.value)}
                        >
                          <option value="">Select Author</option>
                          {availableAuthors.map(author => (
                            <option key={author.id} value={author.id}>
                              {author.name || author.display_name || `User ${author.id}`}
                            </option>
                          ))}
                        </Select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Publish Date
                        </label>
                        <input
                          type="datetime-local"
                          value={publishDate}
                          onChange={(e) => setPublishDate(e.target.value)}
                          className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Featured Image (Optional)
                      </label>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            color={featuredImageMode === 'url' ? 'blue' : 'gray'}
                            onClick={() => {
                              setFeaturedImageMode('url')
                              setFeaturedImageId(null)
                            }}
                          >
                            URL
                          </Button>
                          <Button
                            size="sm"
                            color={featuredImageMode === 'library' ? 'blue' : 'gray'}
                            onClick={() => {
                              setFeaturedImageMode('library')
                              if (!featuredImageId) {
                                setFeaturedImage(null)
                              }
                            }}
                          >
                            Media Library
                          </Button>
                        </div>
                        
                        {featuredImageMode === 'url' ? (
                          <TextInput
                            type="url"
                            placeholder="https://example.com/image.jpg"
                            value={featuredImage || ''}
                            onChange={(e) => setFeaturedImage(e.target.value)}
                          />
                        ) : (
                          <div className="space-y-2">
                            <Button
                              size="sm"
                              color="gray"
                              onClick={openMediaLibrary}
                            >
                              Select from Media Library
                            </Button>
                            {featuredImage && (
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Selected: {featuredImage.split('/').pop()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedPostType === 'post' && (
                      <>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Categories (Optional)
                            </label>
                            <Select
                              multiple
                              value={selectedCategories}
                              onChange={(e) => {
                                const values = Array.from(e.target.selectedOptions, option => option.value)
                                setSelectedCategories(values)
                              }}
                              className="min-h-[100px]"
                            >
                              {availableCategories.map(category => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </Select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Tags (Optional)
                            </label>
                            <Select
                              multiple
                              value={selectedTags}
                              onChange={(e) => {
                                const values = Array.from(e.target.selectedOptions, option => option.value)
                                setSelectedTags(values)
                              }}
                              className="min-h-[100px]"
                            >
                              {availableTags.map(tag => (
                                <option key={tag.id} value={tag.id}>
                                  {tag.name}
                                </option>
                              ))}
                            </Select>
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Post Excerpt (Optional)
                      </label>
                      <Textarea
                        placeholder="Brief summary of the post content..."
                        value={postExcerpt}
                        onChange={(e) => setPostExcerpt(e.target.value)}
                        rows={3}
                      />
                    </div>
                    
                    <Button
                      onClick={publishContent}
                      disabled={isLoading || !generatedContent}
                      gradientDuoTone="purpleToBlue"
                    >
                      {isLoading ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Publishing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
                          </svg>
                          {selectedPostId ? 'Update Post' : 'Create Post'}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reset Modal */}
      <ConfirmationModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetWorkflow}
        title="Confirm Reset"
        message="Are you sure you want to start over? This will clear all generated content and return you to step 1."
        confirmText="Yes, Start Over"
        cancelText="Cancel"
        icon="warning"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-900"
      />
    </div>
  )
}

export default ContentMode
