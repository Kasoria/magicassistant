/**
 * Text Enhancement Service
 *
 * Handles AI-powered text enhancement requests using the existing
 * MagicAssistant chat API endpoint.
 */

/**
 * Enhancement type configurations with system prompts
 */
export const ENHANCEMENT_TYPES = {
  proofread: {
    id: 'proofread',
    label: 'Proofread',
    description: 'Fix grammar, spelling, and punctuation',
    icon: 'check-circle',
    systemPrompt: `You are a professional proofreader. Your task is to fix grammar, spelling, and punctuation errors ONLY.
Do NOT change the style, tone, meaning, or structure of the text.
Do NOT add or remove content.
Return ONLY the corrected text without any explanation or commentary.`
  },
  shorten: {
    id: 'shorten',
    label: 'Shorten',
    description: 'Make the text more concise',
    icon: 'compress',
    systemPrompt: `You are an expert editor specializing in concise writing.
Your task is to shorten the text by 30-50% while preserving the essential message and meaning.
Remove redundant words, phrases, and unnecessary details.
Maintain the original tone and style.
Return ONLY the shortened text without any explanation.`
  },
  lengthen: {
    id: 'lengthen',
    label: 'Lengthen',
    description: 'Expand the text with more detail',
    icon: 'expand',
    systemPrompt: `You are an expert content writer.
Your task is to expand the text by 50-100% by adding relevant details, clarifications, and supporting information.
Maintain the original tone, style, and core message.
Make additions feel natural and well-integrated.
Return ONLY the expanded text without any explanation.`
  },
  formal: {
    id: 'formal',
    label: 'Make Formal',
    description: 'Convert to professional tone',
    icon: 'briefcase',
    systemPrompt: `You are an expert in professional business communication.
Your task is to rewrite the text in a formal, professional tone.
Use professional vocabulary, remove contractions and slang.
Maintain the core message while making it suitable for professional contexts.
Return ONLY the formal version without any explanation.`
  },
  casual: {
    id: 'casual',
    label: 'Make Casual',
    description: 'Convert to friendly, conversational tone',
    icon: 'smile',
    systemPrompt: `You are an expert in conversational writing.
Your task is to rewrite the text in a casual, friendly tone.
Use natural phrasing, contractions where appropriate, and a warm approach.
Make it feel like a conversation between friends while keeping the message clear.
Return ONLY the casual version without any explanation.`
  },
  simplify: {
    id: 'simplify',
    label: 'Simplify',
    description: 'Make easier to understand',
    icon: 'lightbulb',
    systemPrompt: `You are an expert in clear communication.
Your task is to simplify the text for easy understanding.
Use simple, common words and break complex sentences into shorter ones.
Target an 8th-grade reading level.
Maintain the core message while making it accessible to everyone.
Return ONLY the simplified text without any explanation.`
  },
  translate: {
    id: 'translate',
    label: 'Translate',
    description: 'Translate to another language',
    icon: 'globe',
    requiresOption: 'targetLanguage',
    systemPrompt: `You are a professional translator.
Your task is to translate the text to {targetLanguage}.
Preserve the original tone, style, and meaning.
Handle idioms and cultural references appropriately for the target language.
Return ONLY the translated text without any explanation.`
  },
  rewrite: {
    id: 'rewrite',
    label: 'Rewrite as...',
    description: 'Rewrite with specific tone/style',
    icon: 'edit',
    requiresOption: 'tone',
    systemPrompt: `You are an expert writer skilled in various tones and styles.
Your task is to rewrite the text with a {tone} tone/style.
Keep the core message intact while transforming the delivery.
Make the rewrite feel natural and authentic to the chosen style.
Return ONLY the rewritten text without any explanation.`
  },
  custom: {
    id: 'custom',
    label: 'Custom Prompt',
    description: 'Use your own instructions',
    icon: 'wand',
    requiresOption: 'customPrompt',
    systemPrompt: `You are a helpful writing assistant.
Your task is to modify the text according to these instructions: {customPrompt}
Return ONLY the modified text without any explanation or commentary.`
  }
};

/**
 * Available languages for translation
 */
export const TRANSLATION_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese (Simplified)' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'fi', name: 'Finnish' }
];

/**
 * Available tones for rewrite
 */
export const REWRITE_TONES = [
  { id: 'professional', name: 'Professional' },
  { id: 'friendly', name: 'Friendly' },
  { id: 'enthusiastic', name: 'Enthusiastic' },
  { id: 'confident', name: 'Confident' },
  { id: 'empathetic', name: 'Empathetic' },
  { id: 'persuasive', name: 'Persuasive' },
  { id: 'humorous', name: 'Humorous' },
  { id: 'urgent', name: 'Urgent' },
  { id: 'inspirational', name: 'Inspirational' },
  { id: 'educational', name: 'Educational' }
];

/**
 * Build the system prompt for an enhancement type
 * @param {string} enhancementType - Type from ENHANCEMENT_TYPES
 * @param {Object} options - Additional options (targetLanguage, tone, customPrompt)
 * @returns {string} System prompt
 */
const buildSystemPrompt = (enhancementType, options = {}) => {
  const enhancement = ENHANCEMENT_TYPES[enhancementType];
  if (!enhancement) {
    throw new Error(`Unknown enhancement type: ${enhancementType}`);
  }

  let prompt = enhancement.systemPrompt;

  // Replace placeholders with actual values
  if (options.targetLanguage) {
    const language = TRANSLATION_LANGUAGES.find(l => l.code === options.targetLanguage);
    prompt = prompt.replace('{targetLanguage}', language?.name || options.targetLanguage);
  }
  if (options.tone) {
    const tone = REWRITE_TONES.find(t => t.id === options.tone);
    prompt = prompt.replace('{tone}', tone?.name || options.tone);
  }
  if (options.customPrompt) {
    prompt = prompt.replace('{customPrompt}', options.customPrompt);
  }

  return prompt;
};

/**
 * Build the user message for single text enhancement
 * @param {string} text - Text to enhance
 * @returns {string} User message
 */
const buildUserMessage = (text) => {
  return `Please enhance the following text:\n\n${text}`;
};

/**
 * Build the user message for multiple texts enhancement
 * @param {Array} texts - Array of {id, text, label} objects
 * @returns {string} User message
 */
const buildMultiTextUserMessage = (texts) => {
  const formattedTexts = texts.map((item, index) =>
    `[TEXT ${index + 1}: ${item.label}]\n${item.text}\n[/TEXT ${index + 1}]`
  ).join('\n\n');

  return `Please enhance each of the following texts separately. Return each enhanced text in the same format with the same tags:\n\n${formattedTexts}`;
};

/**
 * Parse multi-text response from AI
 * @param {string} response - AI response with tagged texts
 * @param {number} expectedCount - Expected number of texts
 * @returns {Array} Array of enhanced texts
 */
const parseMultiTextResponse = (response, expectedCount) => {
  const results = [];

  for (let i = 1; i <= expectedCount; i++) {
    const regex = new RegExp(`\\[TEXT ${i}[^\\]]*\\]([\\s\\S]*?)\\[\\/TEXT ${i}\\]`, 'i');
    const match = response.match(regex);

    if (match && match[1]) {
      results.push(match[1].trim());
    } else {
      // Fallback: try to split by number patterns
      results.push('');
    }
  }

  // If parsing failed, return the full response for first item
  if (results.every(r => !r) && expectedCount === 1) {
    return [response.trim()];
  }

  return results;
};

/**
 * Get plugin data from window
 * @returns {Object|null}
 */
const getPluginData = () => {
  return window.magicAssistantAdmin || window.matAdminData || window.matPublicData || window.magicAssistantData || null;
};

/**
 * Enhance a single text using AI
 * @param {string} text - Text to enhance
 * @param {string} enhancementType - Type from ENHANCEMENT_TYPES
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Enhanced text
 */
export const enhanceText = async (text, enhancementType, options = {}) => {
  const pluginData = getPluginData();

  if (!pluginData?.restUrl) {
    throw new Error('MagicAssistant plugin data not found');
  }

  const systemPrompt = buildSystemPrompt(enhancementType, options);
  const userMessage = buildUserMessage(text);

  try {
    const response = await fetch(`${pluginData.restUrl}chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': pluginData.nonces?.wp_rest || '',
      },
      body: JSON.stringify({
        message: userMessage,
        history: [],
        custom_system_message: systemPrompt,
        max_tokens: 2000,
        agent_mode: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `API error: ${response.status}`);
    }

    if (!data.success) {
      throw new Error(data.message || 'Enhancement failed');
    }

    // Extract the content from response
    const content = data.content || data.response || data.message || '';
    return content.trim();

  } catch (error) {
    console.error('Text enhancement error:', error);
    throw error;
  }
};

/**
 * Enhance multiple texts using AI
 * @param {Array} texts - Array of {id, text, label} objects
 * @param {string} enhancementType - Type from ENHANCEMENT_TYPES
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Array of {id, enhancedText} objects
 */
export const enhanceMultipleTexts = async (texts, enhancementType, options = {}) => {
  if (!texts || texts.length === 0) {
    return [];
  }

  // For single text, use the simpler method
  if (texts.length === 1) {
    const result = await enhanceText(texts[0].text, enhancementType, options);
    return [{ id: texts[0].id, enhancedText: result }];
  }

  const pluginData = getPluginData();

  if (!pluginData?.restUrl) {
    throw new Error('MagicAssistant plugin data not found');
  }

  const systemPrompt = buildSystemPrompt(enhancementType, options) +
    '\n\nIMPORTANT: You will receive multiple texts. Enhance each one separately and return them in the exact same format with [TEXT N]...[/TEXT N] tags.';
  const userMessage = buildMultiTextUserMessage(texts);

  try {
    const response = await fetch(`${pluginData.restUrl}chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': pluginData.nonces?.wp_rest || '',
      },
      body: JSON.stringify({
        message: userMessage,
        history: [],
        custom_system_message: systemPrompt,
        max_tokens: 4000,
        agent_mode: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `API error: ${response.status}`);
    }

    if (!data.success) {
      throw new Error(data.message || 'Enhancement failed');
    }

    // Extract and parse the content
    const content = data.content || data.response || data.message || '';
    const enhancedTexts = parseMultiTextResponse(content, texts.length);

    return texts.map((item, index) => ({
      id: item.id,
      enhancedText: enhancedTexts[index] || item.text // Fallback to original if parsing failed
    }));

  } catch (error) {
    console.error('Multi-text enhancement error:', error);
    throw error;
  }
};

/**
 * Get available enhancement types as array
 * @returns {Array} Enhancement types
 */
export const getEnhancementTypes = () => {
  return Object.values(ENHANCEMENT_TYPES);
};

/**
 * Check if enhancement type requires additional options
 * @param {string} enhancementType - Type ID
 * @returns {string|null} Required option name or null
 */
export const getRequiredOption = (enhancementType) => {
  const enhancement = ENHANCEMENT_TYPES[enhancementType];
  return enhancement?.requiresOption || null;
};

// Export for external use
export default {
  ENHANCEMENT_TYPES,
  TRANSLATION_LANGUAGES,
  REWRITE_TONES,
  enhanceText,
  enhanceMultipleTexts,
  getEnhancementTypes,
  getRequiredOption
};
