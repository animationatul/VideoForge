/**
 * @module CaptionSegment
 * A segment is a phrase or short sequence of words that displays together
 * on the screen — typically one or two lines of a caption.
 *
 * Segments are the primary display unit for social-media captions:
 * each segment appears for its timing window, and the engine cross-fades
 * or animates between consecutive segments.
 */

import IdGenerator from '../utils/IdGenerator.js';
import CaptionWord from './CaptionWord.js';
import { KeyframeSet } from './CaptionKeyframe.js';

class CaptionSegment {
  /**
   * @param {object} [options={}]
   * @param {{ start: number, end: number }|null} [options.timing=null]
   * @param {object} [options.style={}]       - Partial CaptionStyle override.
   * @param {object} [options.transform]
   * @param {number} [options.lineIndex=0]    - Which display line this segment occupies.
   */
  constructor(options = {}) {
    /** @type {string} */
    this.id = IdGenerator.generate('seg');

    /** @type {CaptionWord[]} */
    this.words = [];

    /**
     * Timing window (seconds relative to parent CaptionClip start).
     * @type {{ start: number, end: number }|null}
     */
    this.timing = options.timing ?? null;

    /** @type {object} */
    this.style = options.style ?? {};

    /** @type {{ x:number,y:number,scaleX:number,scaleY:number,rotation:number,opacity:number }} */
    this.transform = {
      x: 0, y: 0,
      scaleX: 1, scaleY: 1,
      rotation: 0,
      opacity: 1,
      blur: 0,
      ...(options.transform ?? {}),
    };

    /** @type {number} Display line index (0-based). */
    this.lineIndex = options.lineIndex ?? 0;

    /** @type {object[]} Animation chain. */
    this.animations = [];

    /** @type {object[]} Effect chain. */
    this.effects = [];

    /** @type {KeyframeSet} */
    this.keyframeSet = new KeyframeSet();

    /** @type {boolean} */
    this.visible = true;
  }

  // ─── Text (computed) ─────────────────────────────────────────────────────────

  /**
   * The full text of this segment (join of all word texts).
   * @returns {string}
   */
  get text() {
    return this.words.map((w) => w.text).join(' ');
  }

  // ─── Word management ──────────────────────────────────────────────────────────

  /**
   * Append a CaptionWord to this segment.
   * @param {CaptionWord} word
   * @returns {CaptionSegment} this (chainable)
   */
  addWord(word) {
    word.index = this.words.length;
    this.words.push(word);
    return this;
  }

  /** @returns {CaptionWord[]} */
  getWords() {
    return [...this.words];
  }

  /**
   * Get a word by its index within this segment.
   * @param {number} index
   * @returns {CaptionWord|undefined}
   */
  getWordAt(index) {
    return this.words[index];
  }

  /**
   * Build the segment from a raw text string and optional per-word timing array.
   *
   * @param {string} text
   * @param {{ start: number, end: number }|null} [segmentTiming]
   * @param {Array<{ start: number, end: number }>|null} [wordTimings]
   *   If provided, must have the same length as the word count.
   * @returns {CaptionSegment} this (chainable)
   */
  buildFromText(text, segmentTiming = null, wordTimings = null) {
    if (segmentTiming) this.timing = segmentTiming;

    this.words = text.trim().split(/\s+/).filter(Boolean).map((w, i) => {
      return new CaptionWord(w, i, {
        timing: wordTimings?.[i] ?? null,
      });
    });

    return this;
  }

  /**
   * Auto-distribute word timing evenly across the segment's time window.
   * Only words that lack explicit timing are assigned one.
   */
  distributeWordTiming() {
    if (!this.timing) return;
    const words = this.words;
    const n = words.length;
    if (n === 0) return;

    const { start, end } = this.timing;
    const wordDuration = (end - start) / n;

    words.forEach((w, i) => {
      if (!w.timing) {
        w.timing = { start: start + wordDuration * i, end: start + wordDuration * (i + 1) };
        w.distributeCharacterTiming();
      }
    });
  }

  // ─── Animation ────────────────────────────────────────────────────────────────

  /** @param {object} animation @returns {CaptionSegment} this */
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
   * Apply a named animation to all words in this segment with stagger.
   * @param {string} type
   * @param {object} [options={}]
   * @returns {CaptionSegment} this (chainable)
   */
  animateWords(type, options = {}) {
    // TODO: Dispatch via ANIMATION_REGISTRY, wrap in StaggerAnimation, apply per word.
    return this;
  }

  /**
   * Apply a named animation to all characters in this segment with stagger.
   * @param {string} type
   * @param {object} [options={}]
   * @returns {CaptionSegment} this (chainable)
   */
  animateCharacters(type, options = {}) {
    this.words.forEach((word) => word.animateCharacters(type, options));
    return this;
  }

  // ─── Effects ─────────────────────────────────────────────────────────────────

  /** @param {object} effect @returns {CaptionSegment} this */
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
   * @returns {CaptionSegment} this (chainable)
   */
  addKeyframe(property, time, value, easing = 'linear') {
    this.keyframeSet.set(property, time, value, easing);
    return this;
  }

  // ─── Highlight API ────────────────────────────────────────────────────────────

  /**
   * Highlight a word at a given index within this segment.
   * Clears all other word highlights first.
   *
   * @param {number} wordIndex
   * @param {object} [style]
   * @returns {CaptionSegment} this (chainable)
   */
  highlightWord(wordIndex, style) {
    this.words.forEach((w, i) => {
      if (i === wordIndex) w.highlight(style);
      else w.unhighlight();
    });
    return this;
  }

  /**
   * Clear all word highlights in this segment.
   * @returns {CaptionSegment} this (chainable)
   */
  clearHighlights() {
    this.words.forEach((w) => w.unhighlight());
    return this;
  }

  /**
   * Highlight words whose text matches `keyword` (case-insensitive).
   * @param {string} keyword
   * @param {object} [style]
   * @returns {CaptionSegment} this (chainable)
   */
  highlightKeyword(keyword, style) {
    const lower = keyword.toLowerCase();
    this.words.forEach((w) => {
      if (w.text.toLowerCase().replace(/[^a-z0-9]/gi, '') === lower.replace(/[^a-z0-9]/gi, '')) {
        w.highlight(style);
      }
    });
    return this;
  }

  // ─── Computed state ───────────────────────────────────────────────────────────

  /**
   * @param {number} time
   * @returns {object}
   */
  getTransformAtTime(time) {
    const base = { ...this.transform };
    if (this.keyframeSet.isEmpty()) return base;
    return { ...base, ...this.keyframeSet.getAllValuesAtTime(time) };
  }

  /**
   * @param {number} time
   * @returns {boolean}
   */
  isActiveAt(time) {
    if (!this.timing) return true;
    return time >= this.timing.start && time < this.timing.end;
  }

  /**
   * Return words that are active at `time`.
   * @param {number} time
   * @returns {CaptionWord[]}
   */
  getActiveWords(time) {
    return this.words.filter((w) => w.isActiveAt(time));
  }

  // ─── Clone / serialise ────────────────────────────────────────────────────────

  clone() {
    const s = new CaptionSegment({
      timing:    this.timing ? { ...this.timing } : null,
      style:     { ...this.style },
      transform: { ...this.transform },
      lineIndex: this.lineIndex,
    });
    s.words      = this.words.map((w) => w.clone());
    s.animations = this.animations.map((a) => a.clone ? a.clone() : { ...a });
    s.effects    = this.effects.map((e)    => e.clone ? e.clone() : { ...e });
    s.keyframeSet = this.keyframeSet.clone();
    s.visible    = this.visible;
    return s;
  }

  toJSON() {
    return {
      id:          this.id,
      timing:      this.timing,
      style:       { ...this.style },
      transform:   { ...this.transform },
      lineIndex:   this.lineIndex,
      words:       this.words.map((w) => w.toJSON()),
      animations:  this.animations.map((a) => a.toJSON ? a.toJSON() : a),
      effects:     this.effects.map((e)    => e.toJSON ? e.toJSON() : e),
      keyframeSet: this.keyframeSet.toJSON(),
      visible:     this.visible,
    };
  }

  /**
   * @param {object} data
   * @returns {CaptionSegment}
   */
  static fromJSON(data) {
    const s = new CaptionSegment({
      timing:    data.timing,
      style:     data.style ?? {},
      transform: data.transform ?? {},
      lineIndex: data.lineIndex ?? 0,
    });
    s.id          = data.id;
    s.visible     = data.visible ?? true;
    s.words       = (data.words ?? []).map(CaptionWord.fromJSON);
    s.keyframeSet = KeyframeSet.fromJSON(data.keyframeSet ?? { tracks: {} });
    // TODO: Rehydrate animations and effects via their respective registries.
    s.animations  = data.animations ?? [];
    s.effects     = data.effects ?? [];
    return s;
  }
}

export default CaptionSegment;
