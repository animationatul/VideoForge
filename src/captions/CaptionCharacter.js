/**
 * @module CaptionCharacter
 * The finest granularity unit of the caption engine.
 *
 * Each character in a word exists as an independent animatable element with
 * its own timing window, style overrides, transform state, animation chain,
 * effect chain, and keyframe set.
 */

import IdGenerator from '../utils/IdGenerator.js';
import { KeyframeSet } from './CaptionKeyframe.js';

class CaptionCharacter {
  /**
   * @param {string} text         - The single character (or ligature) this represents.
   * @param {number} index        - Zero-based index within the parent word.
   * @param {object} [options={}]
   * @param {object} [options.timing]       - { start, end } seconds relative to clip start.
   * @param {object} [options.style]        - Partial CaptionStyle override (plain object).
   * @param {object} [options.transform]    - Initial transform overrides.
   */
  constructor(text, index, options = {}) {
    /** @type {string} */
    this.id = IdGenerator.generate('char');

    /** @type {string} */
    this.text = text;

    /** @type {number} */
    this.index = index;

    /**
     * Timing window within the parent clip (seconds from clip start).
     * null means "inherit parent word timing".
     * @type {{ start: number, end: number }|null}
     */
    this.timing = options.timing ?? null;

    /**
     * Partial style that overrides the parent word/segment/caption style.
     * Stored as a plain object so it stays lightweight; merged by the renderer.
     * @type {object}
     */
    this.style = options.style ?? {};

    /**
     * Transform state.  The renderer composites keyframe values on top of these.
     * @type {{
     *   x: number, y: number,
     *   scaleX: number, scaleY: number,
     *   rotation: number,
     *   opacity: number,
     *   blur: number,
     *   skewX: number, skewY: number,
     * }}
     */
    this.transform = {
      x: 0, y: 0,
      scaleX: 1, scaleY: 1,
      rotation: 0,
      opacity: 1,
      blur: 0,
      skewX: 0, skewY: 0,
      ...(options.transform ?? {}),
    };

    /**
     * Animation chain — evaluated in order during rendering.
     * Items are CaptionAnimation instances (or plain descriptors for serialisation).
     * @type {object[]}
     */
    this.animations = [];

    /**
     * Effect chain — evaluated after animations.
     * @type {object[]}
     */
    this.effects = [];

    /**
     * Per-character keyframe data.
     * @type {KeyframeSet}
     */
    this.keyframeSet = new KeyframeSet();

    /** @type {boolean} Skip this character during render. */
    this.visible = options.visible ?? true;

    /** @type {boolean} Whether this character is currently karaoke-highlighted. */
    this.highlighted = false;
  }

  // ─── Animation ────────────────────────────────────────────────────────────────

  /**
   * Append an animation to this character's animation chain.
   * @param {object} animation - CaptionAnimation instance.
   * @returns {CaptionCharacter} this (chainable)
   */
  addAnimation(animation) {
    this.animations.push(animation);
    return this;
  }

  /**
   * Remove an animation by ID.
   * @param {string} id
   * @returns {boolean}
   */
  removeAnimation(id) {
    const before = this.animations.length;
    this.animations = this.animations.filter((a) => a.id !== id);
    return this.animations.length < before;
  }

  // ─── Effects ─────────────────────────────────────────────────────────────────

  /**
   * Append an effect.
   * @param {object} effect - CaptionEffect instance.
   * @returns {CaptionCharacter} this (chainable)
   */
  addEffect(effect) {
    this.effects.push(effect);
    return this;
  }

  /**
   * Remove an effect by ID.
   * @param {string} id
   * @returns {boolean}
   */
  removeEffect(id) {
    const before = this.effects.length;
    this.effects = this.effects.filter((e) => e.id !== id);
    return this.effects.length < before;
  }

  // ─── Keyframes ────────────────────────────────────────────────────────────────

  /**
   * Set a keyframe on this character.
   * @param {string} property
   * @param {number} time
   * @param {number|string} value
   * @param {string} [easing='linear']
   * @returns {CaptionCharacter} this (chainable)
   */
  addKeyframe(property, time, value, easing = 'linear') {
    this.keyframeSet.set(property, time, value, easing);
    return this;
  }

  // ─── Computed state ───────────────────────────────────────────────────────────

  /**
   * Resolve the full transform for this character at a given time.
   * Merges base transform + keyframe interpolation.
   *
   * @param {number} time - Seconds relative to the parent clip's start.
   * @returns {object} Resolved transform.
   */
  getTransformAtTime(time) {
    const base = { ...this.transform };
    if (this.keyframeSet.isEmpty()) return base;

    const kfValues = this.keyframeSet.getAllValuesAtTime(time);
    return { ...base, ...kfValues };
  }

  /**
   * Whether this character's timing window is active at `time`.
   * Falls back to always-active if no per-character timing is set.
   *
   * @param {number} time - Seconds relative to clip start.
   * @returns {boolean}
   */
  isActiveAt(time) {
    if (!this.timing) return true;
    return time >= this.timing.start && time < this.timing.end;
  }

  // ─── Clone / serialise ────────────────────────────────────────────────────────

  /**
   * Deep-clone this character with a new ID.
   * @returns {CaptionCharacter}
   */
  clone() {
    const c = new CaptionCharacter(this.text, this.index, {
      timing: this.timing ? { ...this.timing } : null,
      style: { ...this.style },
      transform: { ...this.transform },
    });
    c.visible = this.visible;
    c.highlighted = this.highlighted;
    c.animations = this.animations.map((a) => a.clone ? a.clone() : { ...a });
    c.effects = this.effects.map((e) => e.clone ? e.clone() : { ...e });
    c.keyframeSet = this.keyframeSet.clone();
    return c;
  }

  /** @returns {object} */
  toJSON() {
    return {
      id: this.id,
      text: this.text,
      index: this.index,
      timing: this.timing,
      style: { ...this.style },
      transform: { ...this.transform },
      animations: this.animations.map((a) => a.toJSON ? a.toJSON() : a),
      effects: this.effects.map((e) => e.toJSON ? e.toJSON() : e),
      keyframeSet: this.keyframeSet.toJSON(),
      visible: this.visible,
      highlighted: this.highlighted,
    };
  }

  /**
   * @param {object} data
   * @returns {CaptionCharacter}
   */
  static fromJSON(data) {
    const c = new CaptionCharacter(data.text, data.index, {
      timing: data.timing,
      style: data.style ?? {},
      transform: data.transform ?? {},
    });
    c.id = data.id;
    c.visible = data.visible ?? true;
    c.highlighted = data.highlighted ?? false;
    c.keyframeSet = KeyframeSet.fromJSON(data.keyframeSet ?? { tracks: {} });
    // TODO: Rehydrate animations and effects via their respective registries.
    c.animations = data.animations ?? [];
    c.effects = data.effects ?? [];
    return c;
  }
}

export default CaptionCharacter;
