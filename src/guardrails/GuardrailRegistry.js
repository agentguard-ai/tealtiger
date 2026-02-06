/**
 * GuardrailRegistry - Central registry for managing guardrails
 * 
 * Provides dynamic registration, discovery, and management of guardrails
 * across the platform.
 */

class GuardrailRegistry {
  constructor() {
    this.guardrails = new Map();
    this.categories = new Map();
  }

  /**
   * Register a guardrail class
   * @param {string} name - Unique name for the guardrail
   * @param {Class} GuardrailClass - Guardrail class constructor
   * @param {Object} metadata - Additional metadata
   */
  register(name, GuardrailClass, metadata = {}) {
    if (this.guardrails.has(name)) {
      throw new Error(`Guardrail '${name}' is already registered`);
    }

    this.guardrails.set(name, {
      name,
      GuardrailClass,
      metadata: {
        category: metadata.category || 'custom',
        description: metadata.description || 'No description',
        version: metadata.version || '1.0.0',
        author: metadata.author || 'unknown',
        tags: metadata.tags || [],
        ...metadata
      },
      registeredAt: new Date().toISOString()
    });

    // Add to category index
    const category = metadata.category || 'custom';
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    this.categories.get(category).push(name);

    console.log(`[GuardrailRegistry] Registered guardrail: ${name} (${category})`);
  }

  /**
   * Unregister a guardrail
   * @param {string} name - Name of guardrail to remove
   */
  unregister(name) {
    const guardrail = this.guardrails.get(name);
    if (!guardrail) {
      throw new Error(`Guardrail '${name}' not found`);
    }

    // Remove from category index
    const category = guardrail.metadata.category;
    if (this.categories.has(category)) {
      const categoryGuardrails = this.categories.get(category);
      const index = categoryGuardrails.indexOf(name);
      if (index !== -1) {
        categoryGuardrails.splice(index, 1);
      }
    }

    this.guardrails.delete(name);
    console.log(`[GuardrailRegistry] Unregistered guardrail: ${name}`);
  }

  /**
   * Get a guardrail class by name
   * @param {string} name - Guardrail name
   * @returns {Class} - Guardrail class constructor
   */
  get(name) {
    const guardrail = this.guardrails.get(name);
    if (!guardrail) {
      throw new Error(`Guardrail '${name}' not found in registry`);
    }
    return guardrail.GuardrailClass;
  }

  /**
   * Create an instance of a guardrail
   * @param {string} name - Guardrail name
   * @param {Object} config - Configuration for the guardrail
   * @returns {Guardrail} - Guardrail instance
   */
  create(name, config = {}) {
    const GuardrailClass = this.get(name);
    return new GuardrailClass(config);
  }

  /**
   * Check if a guardrail is registered
   * @param {string} name - Guardrail name
   * @returns {boolean}
   */
  has(name) {
    return this.guardrails.has(name);
  }

  /**
   * Get all registered guardrail names
   * @returns {Array<string>}
   */
  list() {
    return Array.from(this.guardrails.keys());
  }

  /**
   * Get guardrails by category
   * @param {string} category - Category name
   * @returns {Array<string>}
   */
  getByCategory(category) {
    return this.categories.get(category) || [];
  }

  /**
   * Get all categories
   * @returns {Array<string>}
   */
  getCategories() {
    return Array.from(this.categories.keys());
  }

  /**
   * Get metadata for a guardrail
   * @param {string} name - Guardrail name
   * @returns {Object}
   */
  getMetadata(name) {
    const guardrail = this.guardrails.get(name);
    if (!guardrail) {
      throw new Error(`Guardrail '${name}' not found`);
    }
    return guardrail.metadata;
  }

  /**
   * Get all guardrails with their metadata
   * @returns {Array<Object>}
   */
  getAllWithMetadata() {
    return Array.from(this.guardrails.values()).map(g => ({
      name: g.name,
      metadata: g.metadata,
      registeredAt: g.registeredAt
    }));
  }

  /**
   * Search guardrails by tags
   * @param {Array<string>} tags - Tags to search for
   * @returns {Array<string>} - Matching guardrail names
   */
  searchByTags(tags) {
    const results = [];
    
    for (const [name, guardrail] of this.guardrails.entries()) {
      const guardrailTags = guardrail.metadata.tags || [];
      const hasMatchingTag = tags.some(tag => guardrailTags.includes(tag));
      
      if (hasMatchingTag) {
        results.push(name);
      }
    }
    
    return results;
  }

  /**
   * Clear all registered guardrails
   */
  clear() {
    this.guardrails.clear();
    this.categories.clear();
    console.log('[GuardrailRegistry] Cleared all guardrails');
  }

  /**
   * Get registry statistics
   * @returns {Object}
   */
  getStats() {
    return {
      totalGuardrails: this.guardrails.size,
      categories: this.categories.size,
      guardrailsByCategory: Object.fromEntries(
        Array.from(this.categories.entries()).map(([cat, names]) => [cat, names.length])
      )
    };
  }
}

// Singleton instance
const registry = new GuardrailRegistry();

module.exports = { GuardrailRegistry, registry };
