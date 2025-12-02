/**
 * Image Enhancement Service
 *
 * Handles AI-powered image search and context analysis using the
 * Unsplash API through MagicProxy.
 */

import { getImageContextHints } from './bricksImageUtils';

/**
 * Available image orientations
 */
export const IMAGE_ORIENTATIONS = [
  { id: 'landscape', name: 'Landscape', description: 'Wide images, good for banners and headers' },
  { id: 'portrait', name: 'Portrait', description: 'Tall images, good for sidebar and cards' },
  { id: 'squarish', name: 'Square', description: 'Balanced images, versatile for any use' }
];

/**
 * Get plugin data from window
 * @returns {Object|null}
 */
const getPluginData = () => {
  return window.magicAssistantAdmin || window.matAdminData || window.matPublicData || window.magicAssistantData || null;
};

/**
 * Search Unsplash for images
 * @param {string} query - Search query
 * @param {Object} options - Search options { per_page, orientation }
 * @returns {Promise<Array>} Array of image results
 */
export const searchUnsplashImages = async (query, options = {}) => {
  const pluginData = getPluginData();

  if (!pluginData?.restUrl) {
    throw new Error('MagicAssistant plugin data not found');
  }

  const {
    per_page = 12,
    orientation = 'landscape'
  } = options;

  try {
    // Call the MCP endpoint with unsplash_search_images method
    const response = await fetch(`${pluginData.restUrl}unsplash/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': pluginData.nonces?.wp_rest || '',
      },
      body: JSON.stringify({
        query,
        per_page,
        orientation
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `API error: ${response.status}`);
    }

    if (!data.success) {
      throw new Error(data.message || 'Failed to search images');
    }

    // Normalize the response to a consistent format
    // Proxy returns data as array directly, not as { results: [...] }
    const results = Array.isArray(data.data) ? data.data : (data.data?.results || data.results || []);

    return results.map(img => ({
      id: img.id,
      // Handle both nested (urls.regular) and flattened (url_regular/url_small) formats from proxy
      // Priority: regular > small (with fallbacks for both nested and flattened)
      url: img.urls?.regular || img.url_regular || img.urls?.small || img.url_small || img.url,
      thumbUrl: img.urls?.thumb || img.urls?.small || img.url_thumb || img.url_small || img.thumb_url,
      fullUrl: img.urls?.full || img.url_full || img.urls?.regular || img.url_regular || img.full_url,
      rawUrl: img.urls?.raw || img.url_raw || img.raw_url,
      width: img.width,
      height: img.height,
      description: img.description || img.alt_description || img.alt || '',
      altDescription: img.alt_description || img.alt || img.description || '',
      photographer: img.user?.name || img.photographer || 'Unknown',
      photographerUrl: img.user?.links?.html || img.photographer_url || '',
      downloadLocation: img.links?.download_location || img.download_location || '',
      color: img.color,
      blurHash: img.blur_hash
    }));

  } catch (error) {
    console.error('Unsplash search error:', error);
    throw error;
  }
};

/**
 * Get random images from Unsplash
 * @param {Object} options - Options { count, orientation, query }
 * @returns {Promise<Array>} Array of image results
 */
export const getRandomUnsplashImages = async (options = {}) => {
  const pluginData = getPluginData();

  if (!pluginData?.restUrl) {
    throw new Error('MagicAssistant plugin data not found');
  }

  const {
    count = 12,
    orientation = 'landscape',
    query = ''
  } = options;

  try {
    const response = await fetch(`${pluginData.restUrl}unsplash/random`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': pluginData.nonces?.wp_rest || '',
      },
      body: JSON.stringify({
        count,
        orientation,
        query
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `API error: ${response.status}`);
    }

    if (!data.success) {
      throw new Error(data.message || 'Failed to get random images');
    }

    // Random endpoint returns array directly
    const results = Array.isArray(data.data) ? data.data : [data.data];

    return results.map(img => ({
      id: img.id,
      // Handle both nested (urls.regular) and flattened (url_regular/url_small) formats from proxy
      // Priority: regular > small (with fallbacks for both nested and flattened)
      url: img.urls?.regular || img.url_regular || img.urls?.small || img.url_small || img.url,
      thumbUrl: img.urls?.thumb || img.urls?.small || img.url_thumb || img.url_small || img.thumb_url,
      fullUrl: img.urls?.full || img.url_full || img.urls?.regular || img.url_regular || img.full_url,
      rawUrl: img.urls?.raw || img.url_raw || img.raw_url,
      width: img.width,
      height: img.height,
      description: img.description || img.alt_description || img.alt || '',
      altDescription: img.alt_description || img.alt || img.description || '',
      photographer: img.user?.name || img.photographer || 'Unknown',
      photographerUrl: img.user?.links?.html || img.photographer_url || '',
      downloadLocation: img.links?.download_location || img.download_location || '',
      color: img.color,
      blurHash: img.blur_hash
    }));

  } catch (error) {
    console.error('Unsplash random images error:', error);
    throw error;
  }
};

/**
 * Analyze image context to generate search suggestions
 * Uses element context, surrounding text, and AI to suggest search terms
 * @param {Object} element - Bricks image element
 * @param {Object} siteContext - Site context { title, description }
 * @returns {Promise<string>} Suggested search query
 */
export const analyzeImageContext = async (element, siteContext = {}) => {
  // Get context hints from the element
  const hints = getImageContextHints(element);

  // Priority order for context:
  // 1. Alt text (most specific)
  // 2. Element label
  // 3. Filename hints
  // 4. Surrounding text
  // 5. Site context

  // Check alt text first
  if (hints.altText && hints.altText.length > 2) {
    return hints.altText;
  }

  // Check element label
  if (hints.label && hints.label.length > 2 && !hints.label.toLowerCase().includes('image')) {
    return hints.label;
  }

  // Check filename hints
  if (hints.filename && hints.filename.length > 2) {
    return hints.filename;
  }

  // Check surrounding text - extract keywords
  if (hints.surroundingText.length > 0) {
    // Combine surrounding text and extract meaningful words
    const combinedText = hints.surroundingText.join(' ');
    const keywords = extractKeywords(combinedText);
    if (keywords.length > 0) {
      return keywords.slice(0, 3).join(' ');
    }
  }

  // Fall back to site context
  if (siteContext.title) {
    return siteContext.title;
  }

  // Default fallback
  return 'professional business';
};

/**
 * Use AI to generate a search query based on context
 * @param {Object} element - Bricks image element
 * @param {Object} siteContext - Site context
 * @returns {Promise<string>} AI-generated search query
 */
export const generateAISearchQuery = async (element, siteContext = {}) => {
  const pluginData = getPluginData();

  if (!pluginData?.restUrl) {
    // Fall back to local analysis
    return analyzeImageContext(element, siteContext);
  }

  const hints = getImageContextHints(element);

  // Build context for AI
  const contextParts = [];
  if (hints.altText) contextParts.push(`Alt text: ${hints.altText}`);
  if (hints.label) contextParts.push(`Label: ${hints.label}`);
  if (hints.filename) contextParts.push(`Filename: ${hints.filename}`);
  if (hints.surroundingText.length > 0) {
    contextParts.push(`Nearby text: ${hints.surroundingText.slice(0, 2).join(', ')}`);
  }
  if (siteContext.title) contextParts.push(`Site: ${siteContext.title}`);
  if (siteContext.description) contextParts.push(`Description: ${siteContext.description}`);

  // If we have good context hints, use them directly without AI call
  if (hints.altText && hints.altText.length > 5) {
    return hints.altText;
  }

  // If context is minimal, use a simple local extraction
  if (contextParts.length === 0) {
    return 'professional business';
  }

  try {
    // Use the chat endpoint to generate a search query
    const response = await fetch(`${pluginData.restUrl}chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': pluginData.nonces?.wp_rest || '',
      },
      body: JSON.stringify({
        message: `Based on this context, suggest a 2-4 word search query for finding a relevant stock photo. Return ONLY the search query, nothing else.\n\nContext:\n${contextParts.join('\n')}`,
        history: [],
        custom_system_message: 'You are a stock photo search assistant. Generate concise, descriptive search queries for finding relevant images. Return only the search query with no explanation.',
        max_tokens: 50,
        agent_mode: false
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const query = (data.content || data.response || '').trim();
      // Clean up the query - remove quotes and limit length
      return query.replace(/^["']|["']$/g, '').substring(0, 50) || 'professional business';
    }
  } catch (error) {
    console.warn('AI search query generation failed, using local analysis:', error);
  }

  // Fallback to local analysis
  return analyzeImageContext(element, siteContext);
};

/**
 * Extract keywords from text
 * @param {string} text - Text to extract keywords from
 * @returns {Array<string>} Array of keywords
 */
const extractKeywords = (text) => {
  if (!text) return [];

  // Common stop words to filter out
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'it', 'its', 'we', 'our', 'you', 'your', 'they', 'their', 'he', 'she',
    'his', 'her', 'i', 'me', 'my', 'click', 'here', 'more', 'learn', 'read'
  ]);

  // Split text into words, filter, and get unique
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Count word frequency
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  // Sort by frequency and return top words
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 5);
};

/**
 * Track image download for Unsplash API compliance
 * @param {string} downloadLocation - Unsplash download location URL
 * @returns {Promise<void>}
 */
export const trackUnsplashDownload = async (downloadLocation) => {
  if (!downloadLocation) return;

  const pluginData = getPluginData();
  if (!pluginData?.restUrl) return;

  try {
    await fetch(`${pluginData.restUrl}unsplash/track-download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': pluginData.nonces?.wp_rest || '',
      },
      body: JSON.stringify({
        download_location: downloadLocation
      })
    });
  } catch (error) {
    // Silently fail - tracking is not critical
    console.warn('Failed to track Unsplash download:', error);
  }
};

/**
 * Format Unsplash attribution
 * @param {Object} image - Image object from search results
 * @returns {string} Attribution text
 */
export const formatUnsplashAttribution = (image) => {
  if (!image?.photographer) return '';
  return `Photo by ${image.photographer} on Unsplash`;
};

// Export for external use
export default {
  IMAGE_ORIENTATIONS,
  searchUnsplashImages,
  getRandomUnsplashImages,
  analyzeImageContext,
  generateAISearchQuery,
  trackUnsplashDownload,
  formatUnsplashAttribution
};
