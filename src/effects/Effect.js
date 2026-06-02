/**
 * @module Effect
 * Abstract base class for all effects that can be attached to a Clip.
 *
 * Concrete subclasses override apply() to describe their behaviour and
 * provide their own parameter schemas.
 */

import IdGenerator from '../utils/IdGenerator.js';
import { EFFECT_TYPES } from '../utils/Constants.js';

class Effect {
  /**
   * @param {string} [type=EFFECT_TYPES.CUSTOM] - Effect type identifier.
   * @param {object} [params={}] - Type-specific effect parameters.
   */
  constructor(type = EFFECT_TYPES.CUSTOM, params = {}) {
    /** @type {string} */
    this.id = IdGenerator.generate('fx');

    /** @type {string} */
    this.type = type;

    /** @type {boolean} */
    this.enabled = true;

    /**
     * Free-form parameter bag — each concrete subclass defines its own shape.
     * @type {object}
     */
    this.params = { ...params };

    /** @type {Date} */
    this.createdAt = new Date();
  }

  // ─── Core API ────────────────────────────────────────────────────────────────

  /**
   * Apply this effect to a render frame or export context.
   * Subclasses must override this.
   *
   * @param {object} _context - Renderer-supplied context (frame data, timeline position, etc.)
   * @returns {object} Modified context.
   */
  apply(_context) {
    // TODO: Override in subclasses with effect-specific rendering logic.
    return _context;
  }

  /**
   * Enable the effect.
   * @returns {Effect} this (chainable)
   */
  enable() {
    this.enabled = true;
    return this;
  }

  /**
   * Disable the effect (keeps it in the effect list but skips apply()).
   * @returns {Effect} this (chainable)
   */
  disable() {
    this.enabled = false;
    return this;
  }

  /**
   * Update one or more parameters.
   * @param {object} updates - Key/value pairs to merge into this.params.
   * @returns {Effect} this (chainable)
   */
  setParams(updates) {
    Object.assign(this.params, updates);
    return this;
  }

  // ─── Serialisation ───────────────────────────────────────────────────────────

  /**
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      enabled: this.enabled,
      params: { ...this.params },
      createdAt: this.createdAt.toISOString(),
    };
  }

  /**
   * Reconstruct from a plain object.  Subclasses should override to restore
   * any additional state they introduce.
   * @param {object} data
   * @returns {Effect}
   */
  static fromJSON(data) {
    const effect = new Effect(data.type, data.params);
    effect.id = data.id;
    effect.enabled = data.enabled;
    effect.createdAt = new Date(data.createdAt);
    return effect;
  }
}

export default Effect;
