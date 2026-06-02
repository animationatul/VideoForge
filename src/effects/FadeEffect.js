/**
 * @module FadeEffect
 * Fade-in or fade-out opacity/volume ramp applied to a Clip.
 */

import Effect from './Effect.js';
import { EFFECT_TYPES, EASING } from '../utils/Constants.js';

class FadeEffect extends Effect {
  /**
   * @param {'in'|'out'} direction
   * @param {number} [duration=1] - Duration of the fade in seconds.
   * @param {object} [options={}]
   * @param {string} [options.easing=EASING.LINEAR] - Easing function name.
   * @param {number} [options.fromOpacity=null] - Override start opacity (0–1).
   * @param {number} [options.toOpacity=null]   - Override end opacity (0–1).
   */
  constructor(direction = 'in', duration = 1, options = {}) {
    super(direction === 'in' ? EFFECT_TYPES.FADE_IN : EFFECT_TYPES.FADE_OUT, {
      direction,
      duration,
      easing: options.easing ?? EASING.LINEAR,
      fromOpacity: options.fromOpacity ?? (direction === 'in' ? 0 : 1),
      toOpacity: options.toOpacity ?? (direction === 'in' ? 1 : 0),
    });

    /** @type {'in'|'out'} */
    this.direction = direction;
  }

  // ─── Accessors ───────────────────────────────────────────────────────────────

  /** @returns {number} */
  get duration() {
    return this.params.duration;
  }

  /** @param {number} value */
  set duration(value) {
    if (value <= 0) throw new RangeError('FadeEffect duration must be > 0');
    this.params.duration = value;
  }

  /** @returns {string} */
  get easing() {
    return this.params.easing;
  }

  /**
   * Compute the opacity value at a given playhead offset within the fade window.
   *
   * @param {number} t - Seconds elapsed since the fade started (0 ≤ t ≤ duration).
   * @returns {number} Opacity in [0, 1].
   */
  getOpacityAt(t) {
    const { duration, fromOpacity, toOpacity, easing } = this.params;
    const progress = Math.min(Math.max(t / duration, 0), 1);
    const easedProgress = FadeEffect._ease(progress, easing);
    return fromOpacity + (toOpacity - fromOpacity) * easedProgress;
  }

  /**
   * Apply this fade effect within a render context.
   * @param {object} context - { time, opacity, ... }
   * @returns {object}
   */
  apply(context) {
    // TODO: Wire into the renderer's compositing pipeline.
    //       For now, compute and attach the opacity value to the context.
    if (!this.enabled) return context;
    const fadeOffset = context.time - (context.clipStartTime ?? 0);
    const opacity = this.getOpacityAt(fadeOffset);
    return { ...context, opacity };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * @param {number} t - Linear progress [0, 1].
   * @param {string} easing
   * @returns {number}
   */
  static _ease(t, easing) {
    switch (easing) {
      case 'easeIn':     return t * t;
      case 'easeOut':    return t * (2 - t);
      case 'easeInOut':  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default:           return t; // linear
    }
  }

  // ─── Serialisation ───────────────────────────────────────────────────────────

  toJSON() {
    return { ...super.toJSON(), direction: this.direction };
  }

  /**
   * @param {object} data
   * @returns {FadeEffect}
   */
  static fromJSON(data) {
    const fx = new FadeEffect(data.direction, data.params.duration, {
      easing: data.params.easing,
      fromOpacity: data.params.fromOpacity,
      toOpacity: data.params.toOpacity,
    });
    fx.id = data.id;
    fx.enabled = data.enabled;
    fx.createdAt = new Date(data.createdAt);
    return fx;
  }
}

export default FadeEffect;
