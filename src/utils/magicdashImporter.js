/**
 * MagicDash Importer
 *
 * Connects MagicAssistant to MagicDash AI Builder for importing projects into Bricks.
 * Uses WordPress REST API to proxy requests (avoids CORS issues).
 */

import { insertBricksStructure, isBricksBuilder } from './bricksInserter.js';

/**
 * Get the WordPress REST API base URL and nonce
 * @returns {Object} { restUrl, nonce }
 */
const getWpRestConfig = () => {
  // Try multiple possible variable names used by the plugin
  const pluginData = window.magicAssistantAdmin || window.matAdminData || window.magicAssistantData;

  return {
    restUrl: pluginData?.restUrl || '/wp-json/magicassistant/v1/',
    nonce: pluginData?.nonces?.wp_rest || '',
  };
};

/**
 * Fetch user's MagicDash projects
 * @param {Object} options - Options for fetching projects
 * @param {number} options.limit - Maximum number of projects to return
 * @returns {Promise<Object>} { success, projects, error? }
 */
export const fetchMagicDashProjects = async (options = {}) => {
  try {
    const { restUrl, nonce } = getWpRestConfig();
    const limit = options.limit || 20;

    const endpoint = `${restUrl}magicdash/projects?limit=${limit}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-WP-Nonce': nonce,
      },
      credentials: 'same-origin',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Failed to fetch projects (HTTP ${response.status})`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch projects');
    }

    return {
      success: true,
      projects: data.projects || [],
    };
  } catch (error) {
    console.error('Error fetching MagicDash projects:', error);
    return {
      success: false,
      projects: [],
      error: error.message,
    };
  }
};

/**
 * Fetch Bricks JSON for a specific project
 * @param {string} projectId - The project ID to fetch
 * @returns {Promise<Object>} { success, bricksData, projectTitle, error? }
 */
export const fetchProjectBricksJson = async (projectId) => {
  try {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const { restUrl, nonce } = getWpRestConfig();
    const endpoint = `${restUrl}magicdash/projects/${encodeURIComponent(projectId)}/bricks`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-WP-Nonce': nonce,
      },
      credentials: 'same-origin',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Failed to fetch Bricks data (HTTP ${response.status})`
      );
    }

    const data = await response.json();

    if (!data.success || !data.bricksJson) {
      throw new Error(data.error || 'No Bricks data returned');
    }

    // Parse the Bricks JSON string
    const bricksData = JSON.parse(data.bricksJson);

    return {
      success: true,
      bricksData,
      projectTitle: data.projectTitle,
    };
  } catch (error) {
    console.error('Error fetching Bricks JSON:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Import a MagicDash project directly into Bricks Builder
 * @param {string} projectId - The project ID to import
 * @returns {Promise<Object>} { success, message, error? }
 */
export const importMagicDashProject = async (projectId) => {
  try {
    // Check if we're in Bricks
    if (!isBricksBuilder()) {
      throw new Error('Not in Bricks builder context');
    }

    console.log('Fetching MagicDash project:', projectId);

    // Fetch the Bricks JSON
    const result = await fetchProjectBricksJson(projectId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch project');
    }

    const { bricksData, projectTitle } = result;

    console.log('Project fetched:', projectTitle);
    console.log('Elements:', bricksData.content?.length || 0);
    console.log('Global classes:', bricksData.globalClasses?.length || 0);

    // Validate data
    if (!bricksData.content || !Array.isArray(bricksData.content)) {
      throw new Error('Invalid Bricks data: content is missing or invalid');
    }

    // Insert into Bricks canvas
    const insertResult = insertBricksStructure(
      bricksData.content,
      bricksData.globalClasses || []
    );

    if (!insertResult) {
      throw new Error('Failed to insert project into Bricks canvas');
    }

    console.log('Project imported successfully!');

    return {
      success: true,
      message: `Successfully imported "${projectTitle || 'Untitled'}" into Bricks canvas`,
      projectTitle,
      elementsCount: bricksData.content.length,
    };
  } catch (error) {
    console.error('Error importing MagicDash project:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Handle MCP tool response for magicdash_import_project
 * Called by the MCP system when Claude uses the tool
 * @param {Object} toolResponse - Response from MCP tool
 * @returns {Promise<Object>}
 */
export const handleMCPImportProject = async (toolResponse) => {
  try {
    if (!toolResponse.success || !toolResponse.component) {
      throw new Error(toolResponse.error || 'Invalid tool response');
    }

    const { component } = toolResponse;

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
      throw new Error('Failed to insert project');
    }

    return {
      success: true,
      message: `Successfully imported "${component.name}" into Bricks canvas`,
    };
  } catch (error) {
    console.error('Error handling MCP import:', error);
    throw error;
  }
};

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
export const formatProjectDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  } catch {
    return '';
  }
};

// Expose to window for MCP integration
if (typeof window !== 'undefined') {
  window.MagicAssistantMagicDash = {
    fetchMagicDashProjects,
    fetchProjectBricksJson,
    importMagicDashProject,
    handleMCPImportProject,
    formatProjectDate,
  };

  console.log('MagicDash Importer loaded');
}

export default {
  fetchMagicDashProjects,
  fetchProjectBricksJson,
  importMagicDashProject,
  handleMCPImportProject,
  formatProjectDate,
};
