/**
 * GuardrailCache - Caching layer for guardrail results
 * 
 * Improves performance by caching guardrail evaluation results
 * for identical inputs.
 */

const crypto = require('crypto');

class GuardrailCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.options = {
      maxSize: options.maxSize || 1000,
      ttl: options.ttl || 300000, // 5 minutes default
      enabled: options.enabled !== undefined ? options.enabled : true,
      ...options
    };
    
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };

    // Start cleanup interval
    if (this.options.enabled) {
      this._startCleanupInterval();
    }
  }

  /**
   * Generate cache key from input and context
   * @param {string} guardrailName - Name of the guardrail
   * @param {Object} input - Input data
   * @param {Object} context - Context data
   * @returns {string} - Cache key
   */
  _generateKey(guardrailName, input, context) {
    const data = JSON.stringify({ guardrailName, input, context });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get cached result
   * @param {string} guardrailName - Name of the guardrail
   * @param {Object} input - Input data
   * @param {Object} context - Context data
   * @returns {Object|null} - Cached result or null
   */
  get(guardrailName, input, context) {
    if (!this.options.enabled) {
      return null;
    }

    const key = this._generateKey(guardrailName, input, context);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    entry.lastAccessed = Date.now();
    return entry.result;
  }

  /**
   * Set cache entry
   * @param {string} guardrailName - Name of the guardrail
   * @param {Object} input - Input data
   * @param {Object} context - Context data
   * @param {Object} result - Result to cache
   */
  set(guardrailName, input, context, result) {
    if (!this.options.enabled) {
      return;
    }

    // Check cache size limit
    if (this.cache.size >= this.options.maxSize) {
      this._evictOldest();
    }

    const key = this._generateKey(guardrailName, input, context);
    const now = Date.now();

    this.cache.set(key, {
      result,
      createdAt: now,
      lastAccessed: now,
      expiresAt: now + this.options.ttl
    });
  }

  /**
   * Evict oldest cache entry
   * @private
   */
  _evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clear expired entries
   * @private
   */
  _clearExpired() {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`[GuardrailCache] Cleared ${cleared} expired entries`);
    }
  }

  /**
   * Start cleanup interval
   * @private
   */
  _startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this._clearExpired();
    }, 60000); // Run every minute

    // Don't keep process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    console.log('[GuardrailCache] Cleared all cache entries');
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: `${hitRate}%`,
      enabled: this.options.enabled
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Enable caching
   */
  enable() {
    this.options.enabled = true;
    if (!this.cleanupInterval) {
      this._startCleanupInterval();
    }
  }

  /**
   * Disable caching
   */
  disable() {
    this.options.enabled = false;
    this.stopCleanup();
  }
}

module.exports = { GuardrailCache };
