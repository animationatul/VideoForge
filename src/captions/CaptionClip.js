/**
 * @module CaptionClip
 * The root class of the Caption & Motion Typography Engine.
 *
 * CaptionClip extends Clip and owns:
 *   - A list of CaptionSegments (the primary display units)
 *   - A master CaptionStyle (inherited by all segments/words/characters)
 *   - A CaptionLayout (canvas position, safe zones, wrap rules)
 *   - A clip-level animation chain
 *   - A clip-level effect chain
 *   - A KeyframeSet for animating the clip container itself
 *
 * Hierarchy:
 *   CaptionClip
 *     └── CaptionSegment[]
 *           └── CaptionWord[]
 *                 └── CaptionCharacter[]
 *
 * Each level independently inherits parent styles and transforms, then
 * applies its own overrides.  The renderer resolves the final values by
 * walking this hierarchy top-down.
 */

import Clip from '../core/Clip.js';
import { CLIP_TYPES } from '../utils/Constants.js';
import IdGenerator from '../utils/IdGenerator.js';
import CaptionStyle from './CaptionStyle.js';
import CaptionLayout from './CaptionLayout.js';
import CaptionSegment from './CaptionSegment.js';
import CaptionWord from './CaptionWord.js';
import CaptionCharacter from './CaptionCharacter.js';
import { KeyframeSet } from './CaptionKeyframe.js';
import CaptionAnimation, { ANIMATION_REGISTRY, ANIMATION_TARGET, KaraokeAnimation } from './CaptionAnimation.js';
import CaptionEffect, { EFFECT_REGISTRY } from './CaptionEffect.js';
import { PRESET_REGISTRY, createPreset } from './CaptionPreset.js';

class CaptionClip extends Clip {
  /**
   * @param {null} asset     - CaptionClips are synthetic; asset is always null.
   * @param {object} [options={}]
   * @param {number} [options.startTime=0]
   * @param {number} [options.outPoint=30]    - Default 30-second caption.
   * @param {object} [options.style]          - CaptionStyle instance or plain props.
   * @param {object} [options.layout]         - CaptionLayout instance or plain props.
   * @param {string} [options.name='Caption']
   */
  constructor(asset = null, options = {}) {
    super(asset, {
      ...options,
      type:     CLIP_TYPES.TEXT,
      outPoint: options.outPoint ?? 30,
      name:     options.name     ?? 'Caption',
    });

    // ── Core data ─────────────────────────────────────────────────────────────

    /** @type {string} Raw transcript text. */
    this.transcript = '';

    /** @type {CaptionSegment[]} Active display segments. */
    this.segments = [];

    /**
     * Master style — inherited by all child elements.
     * @type {CaptionStyle}
     */
    this.style = options.style instanceof CaptionStyle
      ? options.style
      : new CaptionStyle(options.style ?? {});

    /**
     * Layout configuration (position, wrap, safe zones).
     * @type {CaptionLayout}
     */
    this.layout = options.layout instanceof CaptionLayout
      ? options.layout
      : new CaptionLayout(options.layout ?? {});

    /** @type {object[]} Clip-level animation chain. */
    this.captionAnimations = [];

    /** @type {object[]} Clip-level effect chain. */
    this.captionEffects = [];

    /**
     * Clip-level keyframe set (animate the caption container as a whole).
     * @type {KeyframeSet}
     */
    this.captionKeyframeSet = new KeyframeSet();

    /** @type {string|null} Applied preset name (for serialisation round-trips). */
    this.presetName = null;
  }

  // ─── Transcript API ───────────────────────────────────────────────────────────

  /**
   * Set the transcript text and (optionally) build segments from it.
   *
   * @param {string} text
   * @param {object} [options={}]
   * @param {Array<{word:string,start:number,end:number}>|null} [options.wordTimings=null]
   *   Pre-parsed word timing data.  If provided, each word gets its own timing window.
   * @param {number} [options.maxWordsPerSegment=5]
   * @param {boolean}[options.autoSegment=true]   - Auto-build segments from text.
   * @returns {CaptionClip} this (chainable)
   */
  setTranscript(text, options = {}) {
    this.transcript = text;

    if (options.autoSegment !== false) {
      this.segments = this._buildSegmentsFromText(
        text,
        options.wordTimings ?? null,
        options.maxWordsPerSegment ?? 5,
      );
    }

    return this;
  }

  /**
   * Replace the current segments with a new array.
   * @param {CaptionSegment[]} segments
   * @returns {CaptionClip} this (chainable)
   */
  setSegments(segments) {
    this.segments = segments;
    return this;
  }

  // ─── Preset API ───────────────────────────────────────────────────────────────

  /**
   * Apply a preset by name or instance.
   * Replaces this clip's style, layout, animations, and effects with preset values.
   *
   * @param {string|import('./CaptionPreset.js').default} preset
   * @returns {CaptionClip} this (chainable)
   */
  applyPreset(preset) {
    const p = typeof preset === 'string' ? createPreset(preset) : preset;
    this.presetName = p.name;

    const { style, layout, animations, effects } = p.build();
    this.style  = style;
    this.layout = layout;

    // Clear existing preset-level animations/effects and replace.
    this.captionAnimations = [];
    this.captionEffects    = [];
    animations.forEach((a) => this.addAnimation(a));
    effects.forEach((e)    => this.addEffect(e));

    return this;
  }

  // ─── Animation API ────────────────────────────────────────────────────────────

  /**
   * Add an animation to the clip-level chain.
   * @param {object} animation - CaptionAnimation instance.
   * @returns {CaptionClip} this (chainable)
   */
  addAnimation(animation) {
    this.captionAnimations.push(animation);
    return this;
  }

  /**
   * Remove a clip-level animation by ID.
   * @param {string} id
   * @returns {boolean}
   */
  removeAnimation(id) {
    const before = this.captionAnimations.length;
    this.captionAnimations = this.captionAnimations.filter((a) => a.id !== id);
    return this.captionAnimations.length < before;
  }

  /**
   * Apply an animation to the entire caption (clip-level).
   * @param {string} type - Animation type name.
   * @param {object} [options={}]
   * @returns {CaptionClip} this (chainable)
   */
  animateCaption(type, options = {}) {
    const Cls = ANIMATION_REGISTRY.get(type);
    if (!Cls) throw new Error(`Unknown animation type: "${type}"`);
    return this.addAnimation(new Cls({ ...options, target: ANIMATION_TARGET.CAPTION }));
  }

  /**
   * Apply an animation to every segment in this clip.
   * @param {string} type
   * @param {object} [options={}]
   * @returns {CaptionClip} this (chainable)
   */
  animateLines(type, options = {}) {
    const Cls = ANIMATION_REGISTRY.get(type);
    if (!Cls) throw new Error(`Unknown animation type: "${type}"`);
    this.segments.forEach((seg, i) => {
      const anim = new Cls({ ...options, delay: (options.stagger ?? 0) * i });
      seg.addAnimation(anim);
    });
    return this;
  }

  /**
   * Alias for animateLines — each segment is treated as one line.
   */
  animateSegments(type, options = {}) {
    return this.animateLines(type, options);
  }

  /**
   * Apply an animation to every word across all segments, with optional stagger.
   * @param {string} type
   * @param {object} [options={}]
   * @param {number} [options.stagger=0] - Per-word delay increment (seconds).
   * @returns {CaptionClip} this (chainable)
   */
  animateWords(type, options = {}) {
    const Cls = ANIMATION_REGISTRY.get(type);
    if (!Cls) throw new Error(`Unknown animation type: "${type}"`);
    const stagger = options.stagger ?? 0;
    let wordIdx = 0;

    this.segments.forEach((seg) => {
      seg.getWords().forEach((word) => {
        const anim = new Cls({ ...options, delay: (options.delay ?? 0) + stagger * wordIdx });
        word.addAnimation(anim);
        wordIdx++;
      });
    });
    return this;
  }

  /**
   * Apply an animation to every character across all words, with optional stagger.
   * @param {string} type
   * @param {object} [options={}]
   * @param {number} [options.stagger=0.03]
   * @returns {CaptionClip} this (chainable)
   */
  animateCharacters(type, options = {}) {
    const Cls = ANIMATION_REGISTRY.get(type);
    if (!Cls) throw new Error(`Unknown animation type: "${type}"`);
    const stagger = options.stagger ?? 0.03;
    let charIdx = 0;

    this.segments.forEach((seg) => {
      seg.getWords().forEach((word) => {
        word.characters.forEach((char) => {
          const anim = new Cls({ ...options, delay: (options.delay ?? 0) + stagger * charIdx });
          char.addAnimation(anim);
          charIdx++;
        });
      });
    });
    return this;
  }

  // ─── Effect API ───────────────────────────────────────────────────────────────

  /**
   * Add a clip-level effect.
   * @param {object} effect - CaptionEffect instance.
   * @returns {CaptionClip} this (chainable)
   */
  addEffect(effect) {
    this.captionEffects.push(effect);
    return this;
  }

  /**
   * Remove a clip-level effect by ID.
   * @param {string} id
   * @returns {boolean}
   */
  removeEffect(id) {
    const before = this.captionEffects.length;
    this.captionEffects = this.captionEffects.filter((e) => e.id !== id);
    return this.captionEffects.length < before;
  }

  // ─── Keyframe API ─────────────────────────────────────────────────────────────

  /**
   * Set a keyframe on the caption clip container.
   * @param {string} property
   * @param {number} time
   * @param {number|string} value
   * @param {string} [easing='linear']
   * @returns {CaptionClip} this (chainable)
   */
  addKeyframe(property, time, value, easing = 'linear') {
    this.captionKeyframeSet.set(property, time, value, easing);
    return this;
  }

  // ─── Highlight API ────────────────────────────────────────────────────────────

  /**
   * Highlight a word at a global flat index (across all segments).
   * Clears all other highlights first.
   *
   * @param {number} globalIndex
   * @param {object} [style]
   * @returns {CaptionClip} this (chainable)
   */
  highlightWord(globalIndex, style) {
    let idx = 0;
    this.segments.forEach((seg) => {
      seg.getWords().forEach((word) => {
        if (idx === globalIndex) word.highlight(style);
        else word.unhighlight();
        idx++;
      });
    });
    return this;
  }

  /**
   * Highlight the word whose timing window contains the given absolute time.
   * Designed for real-time karaoke / transcript playback.
   *
   * @param {number} time - Absolute project time (seconds).
   * @param {object} [style]
   * @returns {CaptionClip} this (chainable)
   */
  highlightCurrentWord(time, style) {
    const clipRelativeTime = time - this.startTime;
    this.segments.forEach((seg) => {
      seg.getWords().forEach((word) => {
        if (word.timing && clipRelativeTime >= word.timing.start && clipRelativeTime < word.timing.end) {
          word.highlight(style);
        } else {
          word.unhighlight();
        }
      });
    });
    return this;
  }

  /**
   * Highlight all words matching a keyword (case-insensitive).
   *
   * @param {string} keyword
   * @param {object} [style]
   * @returns {CaptionClip} this (chainable)
   */
  highlightKeyword(keyword, style) {
    this.segments.forEach((seg) => seg.highlightKeyword(keyword, style));
    return this;
  }

  /**
   * Highlight all words matching any keyword in the list.
   *
   * @param {string[]} keywords
   * @param {object} [style]
   * @returns {CaptionClip} this (chainable)
   */
  highlightKeywords(keywords, style) {
    keywords.forEach((kw) => this.highlightKeyword(kw, style));
    return this;
  }

  /**
   * Clear all word highlights across all segments.
   * @returns {CaptionClip} this (chainable)
   */
  clearHighlights() {
    this.segments.forEach((seg) => seg.clearHighlights());
    return this;
  }

  // ─── Karaoke API ─────────────────────────────────────────────────────────────

  /**
   * Configure this clip for karaoke playback.
   * Attaches a KaraokeAnimation to the clip-level chain.
   *
   * @param {object} [options={}]
   * @param {string} [options.fillColor='#FFD700']
   * @param {'leftToRight'|'word'|'character'} [options.fillStyle='leftToRight']
   * @param {boolean}[options.highlightBar=true]
   * @returns {CaptionClip} this (chainable)
   */
  buildKaraoke(options = {}) {
    const karaokeAnim = new KaraokeAnimation({
      fillColor:    options.fillColor    ?? '#FFD700',
      fillStyle:    options.fillStyle    ?? 'leftToRight',
      highlightBar: options.highlightBar ?? true,
      duration:     this.duration,
    });

    // Distribute word timing so the karaoke engine knows when each word is spoken.
    this.segments.forEach((seg) => seg.distributeWordTiming());

    this.addAnimation(karaokeAnim);
    return this;
  }

  // ─── Query API ────────────────────────────────────────────────────────────────

  /**
   * Return segments whose timing window is active at `time`.
   * @param {number} time - Absolute project time (seconds).
   * @returns {CaptionSegment[]}
   */
  getActiveSegments(time) {
    const clipRelative = time - this.startTime;
    return this.segments.filter((s) => s.isActiveAt(clipRelative));
  }

  /**
   * Return all words (across all segments) active at `time`.
   * @param {number} time
   * @returns {CaptionWord[]}
   */
  getActiveWords(time) {
    return this.getActiveSegments(time).flatMap((s) => s.getActiveWords(time - this.startTime));
  }

  /**
   * Return all characters (across all words) active at `time`.
   * @param {number} time
   * @returns {CaptionCharacter[]}
   */
  getActiveCharacters(time) {
    return this.getActiveWords(time).flatMap((w) =>
      w.characters.filter((c) => c.isActiveAt(time - this.startTime)),
    );
  }

  /**
   * Flat array of all words across all segments.
   * @returns {CaptionWord[]}
   */
  getAllWords() {
    return this.segments.flatMap((s) => s.getWords());
  }

  /**
   * Flat array of all characters across all words.
   * @returns {CaptionCharacter[]}
   */
  getAllCharacters() {
    return this.getAllWords().flatMap((w) => w.characters);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────────

  /**
   * Build segments from a raw text string.
   *
   * @param {string} text
   * @param {Array<{word:string,start:number,end:number}>|null} wordTimings
   * @param {number} maxWordsPerSegment
   * @returns {CaptionSegment[]}
   */
  _buildSegmentsFromText(text, wordTimings, maxWordsPerSegment) {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const segments = [];
    let segStart = 0;

    while (segStart < tokens.length) {
      const segTokens = tokens.slice(segStart, segStart + maxWordsPerSegment);

      // Determine segment timing.
      const firstTiming = wordTimings?.[segStart];
      const lastTiming  = wordTimings?.[Math.min(segStart + segTokens.length - 1, (wordTimings?.length ?? 0) - 1)];
      const segTiming   = firstTiming && lastTiming
        ? { start: firstTiming.start, end: lastTiming.end }
        : null;

      const seg = new CaptionSegment({ timing: segTiming });
      segTokens.forEach((token, localIdx) => {
        const globalIdx = segStart + localIdx;
        const wt = wordTimings?.[globalIdx];
        seg.addWord(new CaptionWord(token, localIdx, {
          timing: wt ? { start: wt.start, end: wt.end } : null,
        }));
      });

      segments.push(seg);
      segStart += maxWordsPerSegment;
    }

    return segments;
  }

  // ─── Clip base override ───────────────────────────────────────────────────────

  _createInstance() {
    return new CaptionClip(null, {
      style:  this.style.clone(),
      layout: this.layout.clone(),
    });
  }

  // ─── Clone / serialise ────────────────────────────────────────────────────────

  /**
   * Deep-clone this CaptionClip.
   * @returns {CaptionClip}
   */
  clone() {
    const c = this._createInstance();
    c.transcript          = this.transcript;
    c.segments            = this.segments.map((s) => s.clone());
    c.captionAnimations   = this.captionAnimations.map((a) => a.clone ? a.clone() : { ...a });
    c.captionEffects      = this.captionEffects.map((e)    => e.clone ? e.clone() : { ...e });
    c.captionKeyframeSet  = this.captionKeyframeSet.clone();
    c.presetName          = this.presetName;
    c.startTime           = this.startTime;
    c.inPoint             = this.inPoint;
    c.outPoint            = this.outPoint;
    c.name                = this.name ? `${this.name} (copy)` : '';
    c.muted               = this.muted;
    c.locked              = this.locked;
    c.visible             = this.visible;
    return c;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      transcript:         this.transcript,
      segments:           this.segments.map((s) => s.toJSON()),
      style:              this.style.toJSON(),
      layout:             this.layout.toJSON(),
      captionAnimations:  this.captionAnimations.map((a) => a.toJSON ? a.toJSON() : a),
      captionEffects:     this.captionEffects.map((e)    => e.toJSON ? e.toJSON() : e),
      captionKeyframeSet: this.captionKeyframeSet.toJSON(),
      presetName:         this.presetName,
    };
  }

  /**
   * @param {object} data
   * @returns {CaptionClip}
   */
  static fromJSON(data) {
    const clip = new CaptionClip(null, {
      startTime: data.startTime,
      inPoint:   data.inPoint,
      outPoint:  data.outPoint,
      name:      data.name,
      style:     CaptionStyle.fromJSON(data.style ?? {}),
      layout:    CaptionLayout.fromJSON(data.layout ?? {}),
    });
    clip.id         = data.id;
    clip.transcript = data.transcript ?? '';
    clip.segments   = (data.segments ?? []).map(CaptionSegment.fromJSON);
    clip.muted      = data.muted  ?? false;
    clip.locked     = data.locked ?? false;
    clip.visible    = data.visible ?? true;
    clip.presetName = data.presetName ?? null;
    clip.createdAt  = new Date(data.createdAt);
    clip.captionKeyframeSet = KeyframeSet.fromJSON(data.captionKeyframeSet ?? { tracks: {} });
    // TODO: Rehydrate captionAnimations via ANIMATION_REGISTRY.
    // TODO: Rehydrate captionEffects via EFFECT_REGISTRY.
    clip.captionAnimations = data.captionAnimations ?? [];
    clip.captionEffects    = data.captionEffects    ?? [];
    return clip;
  }
}

export default CaptionClip;
