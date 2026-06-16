/**
 * @module CropEffect
 * Crops pixels from one or more edges of a video clip and positions the
 * remaining content within the original canvas using an alignment setting.
 */

import Effect from './Effect.js';
import { EFFECT_TYPES, CROP_ALIGNMENT } from '../utils/Constants.js';

class CropEffect extends Effect {
  /**
   * @param {object} [params={}]
   * @param {number} [params.top=0]       - Pixels to remove from the top edge.
   * @param {number} [params.bottom=0]    - Pixels to remove from the bottom edge.
   * @param {number} [params.left=0]      - Pixels to remove from the left edge.
   * @param {number} [params.right=0]     - Pixels to remove from the right edge.
   * @param {string} [params.alignment='center'] - Where to place the cropped content
   *   within the original canvas. One of CROP_ALIGNMENT.*
   */
  constructor(params = {}) {
    super(EFFECT_TYPES.CROP, {
      top:       params.top       ?? 0,
      bottom:    params.bottom    ?? 0,
      left:      params.left      ?? 0,
      right:     params.right     ?? 0,
      alignment: params.alignment ?? CROP_ALIGNMENT.CENTER,
    });
  }

  // ─── Accessors ───────────────────────────────────────────────────────────────

  get top()       { return this.params.top; }
  set top(v)      { this.params.top = Math.max(0, v); }

  get bottom()    { return this.params.bottom; }
  set bottom(v)   { this.params.bottom = Math.max(0, v); }

  get left()      { return this.params.left; }
  set left(v)     { this.params.left = Math.max(0, v); }

  get right()     { return this.params.right; }
  set right(v)    { this.params.right = Math.max(0, v); }

  get alignment() { return this.params.alignment; }
  set alignment(v) { this.params.alignment = v; }

  // ─── Apply ───────────────────────────────────────────────────────────────────

  apply(context) {
    // TODO: Wire into the renderer's compositing pipeline.
    if (!this.enabled) return context;
    return { ...context, crop: { ...this.params } };
  }

  // ─── Serialisation ───────────────────────────────────────────────────────────

  toJSON() {
    return super.toJSON();
  }

  /**
   * @param {object} data
   * @returns {CropEffect}
   */
  static fromJSON(data) {
    const fx = new CropEffect(data.params ?? {});
    fx.id        = data.id;
    fx.enabled   = data.enabled;
    fx.createdAt = new Date(data.createdAt);
    return fx;
  }
}

export default CropEffect;
