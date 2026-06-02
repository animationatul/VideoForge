/**
 * @module CaptionWord
 * A word within a CaptionSegment.
 *
 * Every word automatically builds a CaptionCharacter for each of its characters,
 * enabling per-character animation and styling.
 */

import IdGenerator from '../utils/IdGenerator.js';
import CaptionCharacter from './CaptionCharacter.js';
import { KeyframeSet } from './CaptionKeyframe.js';

class CaptionWord {
  /**
   * @param {string} text              - The word text (may include punctuation).
   * @param {number} index             - Zero-based index within the parent segment.
   * @param {object} [options={}]
   * @param {{ start: number, end: number }|null} [options.timing=null]
   *   Timing relative to the parent CaptionClip's start (seconds).
   *   Null means this word has no explicit timing (inherited from the segment).
   * @param {object} [options.style={}]  - Partial CaptionStyle override.
   * @param {object} [options.transform] - Initial transform overrides.
   */
  constructor(text, index, options = {}) {
    /** @type {string} */
    this.id = IdGenerator.generate('word');

    /** @type {string} */
    this.text = text;

    /** @type {number} */
    this.index = index;

    /**
     * @type {{ start: number, end: number }|null}
     */
    this.timing = options.timing ?? null;

    /** @type {object} Partial style override. */
    this.style = options.style ?? {};

    /**
     * Runtime transform composited from base values + keyframe interpolation.
     * @type {{ x:number, y:number, scaleX:number, scaleY:number, rotation:number, opacity:number, blur:number }}
     */
    this.transform = {
      x: 0, y: 0,
      scaleX: 1, scaleY: 1,
      rotation: 0,
      opacity: 1,
      blur: 0,
      ...(options.transform ?? {}),
    };

    /**
     * Per-character elements — built by buildCharacters().
     * @type {CaptionCharacter[]}
     */
    this.characters = [];

    /** @type {object[]} Animation chain. */
    this.animations = [];

    /** @type {object[]} Effect chain. */
    this.effects = [];

    /** @type {KeyframeSet} */
    this.keyframeSet = new KeyframeSet();

    /** @type {boolean} Whether this word is highlighted (karaoke / keyword). */
    this.highlighted = false;

    /**
     * Highlight style override applied when `highlighted === true`.
     * @type {object}
     */
    this.highlightStyle = options.highlightStyle ?? { fill: '#FFD700' };

    /** @type {boolean} */
    this.visible = true;

    // Auto-build character array.
    this.buildCharacters();
  }

  // ─── Character management ─────────────────────────────────────────────────────

  /**
   * (Re-)Build the characters array from this.text.
   * Preserves characters that already exist at matching indices/text.
   */
  buildCharacters() {
    const chars = [...this.text]; // Spread handles multi-byte / emoji correctly.
    this.characters = chars.map((ch, i) => {
      const existing = this.characters[i];
      if (existing && existing.text === ch) return existing;
      return new CaptionCharacter(ch, i);
    });
  }

  /**
   * Apply per-character timing derived from the word's timing window.
   * Distributes time evenly unless individual characters already have timing.
   */
  distributeCharacterTiming() {
    if (!this.timing) return;
    const { start, end } = this.timing;
    const n = this.characters.length;
    if (n === 0) return;
    const charDuration = (end - start) / n;
    this.characters.forEach((c, i) => {
      if (!c.timing) {
        c.timing = { start: start + charDuration * i, end: start + charDuration * (i + 1) };
      }
    });
  }

  // ─── Animation ────────────────────────────────────────────────────────────────

  /**
   * Add an animation to this word.
   * @param {object} animation
   * @returns {CaptionWord} this (chainable)
   */
  addAnimation(animation) {
    this.animations.push(animation);
    return this;
  }

  /** @param {string} id @returns {boolean} */
  removeAnimation(id) {
    const before = this.animations.length;
    this.animations = this.animations.filter((a) => a.id !== id);
    return this.animations.length < before;
  }

  /**
   * Apply a named animation type to all characters with stagger.
   * @param {string} type           - Animation type name.
   * @param {object} [options={}]
   * @param {number} [options.stagger=0.03]
   * @returns {CaptionWord} this (chainable)
   */
  animateCharacters(type, options = {}) {
    // TODO: Resolve animation type via ANIMATION_REGISTRY and create StaggerAnimation.
    //       Attach resulting animations to each character with incremental delay.
    return this;
  }

  // ─── Effects ─────────────────────────────────────────────────────────────────

  /** @param {object} effect @returns {CaptionWord} this */
  addEffect(effect) { this.effects.push(effect); return this; }

  /** @param {string} id @returns {boolean} */
  removeEffect(id) {
    const before = this.effects.length;
    this.effects = this.effects.filter((e) => e.id !== id);
    return this.effects.length < before;
  }

  // ─── Keyframes ────────────────────────────────────────────────────────────────

  /**
   * @param {string} property
   * @param {number} time
   * @param {number|string} value
   * @param {string} [easing='linear']
   * @returns {CaptionWord} this (chainable)
   */
  addKeyframe(property, time, value, easing = 'linear') {
    this.keyframeSet.set(property, time, value, easing);
    return this;
  }

  // ─── Highlight API ────────────────────────────────────────────────────────────

  /**
   * Activate the highlight state on this word.
   * @param {object} [styleOverride] - Partial style to merge with this.highlightStyle.
   * @returns {CaptionWord} this (chainable)
   */
  highlight(styleOverride = {}) {
    this.highlighted = true;
    if (Object.keys(styleOverride).length) {
      this.highlightStyle = { ...this.highlightStyle, ...styleOverride };
    }
    return this;
  }

  /** @returns {CaptionWord} this (chainable) */
  unhighlight() {
    this.highlighted = false;
    return this;
  }

  // ─── Computed state ───────────────────────────────────────────────────────────

  /**
   * Resolve full transform at a given time.
   * @param {number} time
   * @returns {object}
   */
  getTransformAtTime(time) {
    const base = { ...this.transform };
    if (this.keyframeSet.isEmpty()) return base;
    return { ...base, ...this.keyframeSet.getAllValuesAtTime(time) };
  }

  /**
   * Whether this word is active at `time` (within its timing window).
   * @param {number} time
   * @returns {boolean}
   */
  isActiveAt(time) {
    if (!this.timing) return true;
    return time >= this.timing.start && time < this.timing.end;
  }

  /** @returns {string} Effective fill colour for rendering (highlight overrides base fill). */
  getEffectiveFill() {
    return this.highlighted ? (this.highlightStyle.fill ?? '#FFD700') : (this.style.fill ?? null);
  }

  // ─── Clone / serialise ────────────────────────────────────────────────────────

  clone() {
    const w = new CaptionWord(this.text, this.index, {
      timing:         this.timing ? { ...this.timing } : null,
      style:          { ...this.style },
      transform:      { ...this.transform },
      highlightStyle: { ...this.highlightStyle },
    });
    w.highlighted = this.highlighted;
    w.visible     = this.visible;
    w.animations  = this.animations.map((a) => a.clone ? a.clone() : { ...a });
    w.effects     = this.effects.map((e)    => e.clone ? e.clone() : { ...e });
    w.keyframeSet = this.keyframeSet.clone();
    w.characters  = this.characters.map((c) => c.clone());
    return w;
  }

  toJSON() {
    return {
      id:             this.id,
      text:           this.text,
      index:          this.index,
      timing:         this.timing,
      style:          { ...this.style },
      transform:      { ...this.transform },
      characters:     this.characters.map((c) => c.toJSON()),
      animations:     this.animations.map((a) => a.toJSON ? a.toJSON() : a),
      effects:        this.effects.map((e)    => e.toJSON ? e.toJSON() : e),
      keyframeSet:    this.keyframeSet.toJSON(),
      highlighted:    this.highlighted,
      highlightStyle: { ...this.highlightStyle },
      visible:        this.visible,
    };
  }

  /**
   * @param {object} data
   * @returns {CaptionWord}
   */
  static fromJSON(data) {
    const w = new CaptionWord(data.text, data.index, {
      timing:         data.timing,
      style:          data.style ?? {},
      transform:      data.transform ?? {},
      highlightStyle: data.highlightStyle ?? {},
    });
    w.id          = data.id;
    w.highlighted = data.highlighted ?? false;
    w.visible     = data.visible ?? true;
    w.keyframeSet = KeyframeSet.fromJSON(data.keyframeSet ?? { tracks: {} });
    w.characters  = (data.characters ?? []).map(CaptionCharacter.fromJSON);
    // TODO: Rehydrate animations and effects via their respective registries.
    w.animations  = data.animations ?? [];
    w.effects     = data.effects ?? [];
    return w;
  }
}

export default CaptionWord;
