/**
 * Bricks MCP Bridge
 * 
 * Connects the MCP Server tools with the Bricks inserter functionality.
 * This bridge handles fetching components from MagicProxy and inserting them into Bricks.
 */

import { insertBricksStructure, isBricksBuilder, getBricksInfo } from './bricksInserter.js';

/**
 * Check if we're in a valid Bricks context
 * @returns {boolean}
 */
export const canUseBricks = () => {
  return isBricksBuilder();
};

/**
 * Get Bricks context information
 * @returns {Object}
 */
export const getBricksContext = () => {
  if (!canUseBricks()) {
    return {
      available: false,
      reason: 'Not in Bricks builder context'
    };
  }
  
  const info = getBricksInfo();
  return {
    available: true,
    ...info
  };
};

/**
 * Fetch component from MagicProxy API
 * @param {string} componentId - Component ID or slug
 * @returns {Promise<Object>}
 */
export const fetchComponent = async (componentId) => {
  try {
    // Get proxy URL from WordPress settings
    const proxyUrl = window.magicAssistantData?.proxyUrl || 'https://proxy.magicplugins.io';
    const endpoint = `${proxyUrl}/api/bricks/components/${encodeURIComponent(componentId)}?incrementUsage=true`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch component: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch component');
    }
    
    return data.data;
  } catch (error) {
    console.error('Error fetching component:', error);
    throw error;
  }
};

/**
 * Search for components
 * @param {Object} criteria - Search criteria
 * @returns {Promise<Array>}
 */
export const searchComponents = async (criteria = {}) => {
  try {
    const proxyUrl = window.magicAssistantData?.proxyUrl || 'https://proxy.magicplugins.io';
    const params = new URLSearchParams();
    
    if (criteria.keywords) {
      params.append('q', criteria.keywords);
    }
    if (criteria.category) {
      params.append('category', criteria.category);
    }
    if (criteria.elements && Array.isArray(criteria.elements)) {
      params.append('elements', criteria.elements.join(','));
    }
    if (criteria.limit) {
      params.append('limit', Math.min(50, Math.max(1, criteria.limit)));
    } else {
      params.append('limit', '10');
    }
    
    const endpoint = `${proxyUrl}/api/bricks/search?${params.toString()}`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search components: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to search components');
    }
    
    return {
      components: data.data.components,
      pagination: data.data.pagination
    };
  } catch (error) {
    console.error('Error searching components:', error);
    throw error;
  }
};

/**
 * Insert component into Bricks canvas
 * @param {string} componentId - Component ID or slug
 * @returns {Promise<Object>}
 */
export const insertComponent = async (componentId) => {
  try {
    // Check if we're in Bricks
    if (!canUseBricks()) {
      throw new Error('Not in Bricks builder context');
    }
    
    console.log('🔄 Fetching component:', componentId);
    
    // Fetch the component
    const component = await fetchComponent(componentId);
    
    console.log('✅ Component fetched:', component.name);
    console.log('📦 Elements:', component.bricksJson?.length || 0);
    console.log('🎨 Global classes:', component.globalClasses?.length || 0);
    
    // Validate component data
    if (!component.bricksJson || !Array.isArray(component.bricksJson)) {
      throw new Error('Invalid component data: bricksJson is missing or invalid');
    }
    
    // Insert into Bricks canvas
    const result = insertBricksStructure(
      component.bricksJson,
      component.globalClasses || []
    );
    
    if (!result) {
      throw new Error('Failed to insert component into Bricks canvas');
    }
    
    console.log('✨ Component inserted successfully!');
    
    return {
      success: true,
      component: {
        name: component.name,
        category: component.category,
        elementsCount: component.bricksJson.length
      },
      message: `Successfully inserted "${component.name}" into Bricks canvas`
    };
    
  } catch (error) {
    console.error('❌ Error inserting component:', error);
    throw error;
  }
};

/**
 * Get available categories
 * @returns {Promise<Array>}
 */
export const getCategories = async () => {
  try {
    const proxyUrl = window.magicAssistantData?.proxyUrl || 'https://proxy.magicplugins.io';
    const endpoint = `${proxyUrl}/api/bricks/categories`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch categories');
    }
    
    return data.data;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

/**
 * Handle MCP tool response for bricks_insert_component
 * This is called by the MCP system when Claude uses the tool
 * @param {Object} toolResponse - Response from MCP tool
 * @returns {Promise<Object>}
 */
export const handleMCPInsertComponent = async (toolResponse) => {
  try {
    if (!toolResponse.success || !toolResponse.component) {
      throw new Error('Invalid tool response');
    }

    const { component, text_replacements_applied, image_replacements_applied, image_replacements } = toolResponse;

    // Validate component data
    if (!component.bricksJson || !Array.isArray(component.bricksJson)) {
      throw new Error('Invalid component data from MCP');
    }

    // Insert into Bricks
    const result = insertBricksStructure(
      component.bricksJson,
      component.globalClasses || []
    );

    if (!result) {
      throw new Error('Failed to insert component');
    }

    // Build success message
    let message = `Successfully inserted "${component.name}" component`;
    const details = [];

    if (text_replacements_applied && text_replacements_applied > 0) {
      details.push(`${text_replacements_applied} text replacement(s)`);
    }

    if (image_replacements_applied && image_replacements_applied > 0) {
      details.push(`${image_replacements_applied} image replacement(s)`);
      // Log image replacement details for debugging
      if (image_replacements && Array.isArray(image_replacements)) {
        console.log('🖼️ Image replacements applied:', image_replacements.map(r => ({
          query: r.search_query,
          photographer: r.photographer
        })));
      }
    }

    if (details.length > 0) {
      message += ` with ${details.join(' and ')}`;
    }

    return {
      success: true,
      message,
      text_replacements_applied: text_replacements_applied || 0,
      image_replacements_applied: image_replacements_applied || 0,
      image_replacements: image_replacements || []
    };

  } catch (error) {
    console.error('Error handling MCP insert:', error);
    throw error;
  }
};

// Expose to window for MCP integration
if (typeof window !== 'undefined') {
  window.MagicAssistantBricksMCP = {
    canUseBricks,
    getBricksContext,
    fetchComponent,
    searchComponents,
    insertComponent,
    getCategories,
    handleMCPInsertComponent
  };
  
  console.log('✅ Bricks MCP Bridge loaded');
}

export default {
  canUseBricks,
  getBricksContext,
  fetchComponent,
  searchComponents,
  insertComponent,
  getCategories,
  handleMCPInsertComponent
};

