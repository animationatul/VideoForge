/**
 * @module CaptionStyle
 * Complete typographic style definition for captions at any granularity level
 * (caption → line → segment → word → character).
 *
 * A CaptionStyle at a finer level merges with (overrides) the parent level's style,
 * so characters inherit word style, words inherit segment style, etc.
 */

import IdGenerator from '../utils/IdGenerator.js';

// ─── Gradient descriptor ─────────────────────────────────────────────────────

/**
 * @typedef {object} GradientStop
 * @property {string} color
 * @property {number} position - 0–1
 */

/**
 * @typedef {object} GradientFill
 * @property {'linear'|'radial'|'conic'} type
 * @property {number} angle         - Degrees (linear gradient).
 * @property {GradientStop[]} stops
 */

// ─── CaptionStyle ────────────────────────────────────────────────────────────

class CaptionStyle {
  /**
   * @param {object} [props={}]
   *
   * Typography
   * @param {string}  [props.fontFamily='Arial']
   * @param {number|string} [props.fontWeight=700]  - 100–900 or 'bold' / 'normal'
   * @param {number}  [props.fontSize=48]           - px
   * @param {'normal'|'italic'|'oblique'} [props.fontStyle='normal']
   * @param {'none'|'uppercase'|'lowercase'|'capitalize'} [props.textTransform='none']
   *
   * Spacing
   * @param {number}  [props.letterSpacing=0]       - px
   * @param {number}  [props.tracking=0]            - em (additional tracking on top of letterSpacing)
   * @param {number}  [props.lineHeight=1.2]        - multiplier
   * @param {number}  [props.wordSpacing=0]         - px
   * @param {number}  [props.paragraphSpacing=0]    - px between caption blocks
   *
   * Fill
   * @param {string|GradientFill} [props.fill='#FFFFFF']
   * @param {number}  [props.fillOpacity=1]         - 0–1
   *
   * Stroke
   * @param {object|null} [props.stroke=null]       - { color, width, join: 'miter'|'round'|'bevel' }
   *
   * Shadow
   * @param {object|null} [props.shadow=null]       - { color, offsetX, offsetY, blur, spread }
   *
   * Glow
   * @param {object|null} [props.glow=null]         - { color, blur, strength, layers }
   *
   * Background
   * @param {object|null} [props.background=null]   - { color, padding, borderRadius, opacity }
   *   padding: number | { top, right, bottom, left }
   *
   * Decorations
   * @param {boolean} [props.underline=false]
   * @param {object|null} [props.underlineStyle=null] - { color, thickness, style, offset }
   * @param {boolean} [props.strikethrough=false]
   * @param {object|null} [props.strikethroughStyle=null]
   *
   * Alignment
   * @param {'left'|'center'|'right'|'justify'} [props.textAlign='center']
   * @param {'top'|'middle'|'bottom'} [props.verticalAlign='bottom']
   *
   * Rendering
   * @param {string}  [props.blendMode='normal']    - CSS blend mode
   * @param {boolean} [props.antiAlias=true]
   * @param {'auto'|'optimizeSpeed'|'optimizeLegibility'|'geometricPrecision'} [props.textRendering='auto']
   */
  constructor(props = {}) {
    this.id = IdGenerator.generate('style');

    // ── Typography ───────────────────────────────────────────────────────────
    this.fontFamily           = props.fontFamily    ?? 'Arial';
    this.fontWeight           = props.fontWeight    ?? 700;
    this.fontSize             = props.fontSize      ?? 48;
    this.fontStyle            = props.fontStyle     ?? 'normal';
    this.textTransform        = props.textTransform ?? 'none';

    // ── Spacing ──────────────────────────────────────────────────────────────
    this.letterSpacing        = props.letterSpacing    ?? 0;
    this.tracking             = props.tracking         ?? 0;
    this.lineHeight           = props.lineHeight        ?? 1.2;
    this.wordSpacing          = props.wordSpacing       ?? 0;
    this.paragraphSpacing     = props.paragraphSpacing  ?? 0;

    // ── Fill ─────────────────────────────────────────────────────────────────
    this.fill                 = props.fill        ?? '#FFFFFF';
    this.fillOpacity          = props.fillOpacity ?? 1;

    // ── Stroke ───────────────────────────────────────────────────────────────
    this.stroke               = props.stroke ?? null;

    // ── Shadow ───────────────────────────────────────────────────────────────
    this.shadow               = props.shadow ?? null;

    // ── Glow ─────────────────────────────────────────────────────────────────
    this.glow                 = props.glow ?? null;

    // ── Background ───────────────────────────────────────────────────────────
    this.background           = props.background ?? null;

    // ── Decorations ──────────────────────────────────────────────────────────
    this.underline            = props.underline          ?? false;
    this.underlineStyle       = props.underlineStyle     ?? null;
    this.strikethrough        = props.strikethrough      ?? false;
    this.strikethroughStyle   = props.strikethroughStyle ?? null;

    // ── Alignment ────────────────────────────────────────────────────────────
    this.textAlign            = props.textAlign    ?? 'center';
    this.verticalAlign        = props.verticalAlign ?? 'bottom';

    // ── Rendering ────────────────────────────────────────────────────────────
    this.blendMode            = props.blendMode    ?? 'normal';
    this.antiAlias            = props.antiAlias    ?? true;
    this.textRendering        = props.textRendering ?? 'auto';
  }

  // ─── Merge ───────────────────────────────────────────────────────────────────

  /**
   * Merge another style into this one, with the other taking precedence.
   * Returns a new CaptionStyle; does not mutate either object.
   *
   * @param {CaptionStyle|object} other
   * @returns {CaptionStyle}
   */
  merge(other) {
    const merged = this.clone();
    const src = other instanceof CaptionStyle ? other.toJSON() : other;
    for (const [key, value] of Object.entries(src)) {
      if (key === 'id') continue;
      if (value !== null && value !== undefined) {
        merged[key] = typeof value === 'object' && !Array.isArray(value)
          ? { ...merged[key], ...value }
          : value;
      }
    }
    return merged;
  }

  // ─── Convenience setters (chainable) ─────────────────────────────────────────

  /** @param {string} family @returns {CaptionStyle} */
  setFont(family) { this.fontFamily = family; return this; }

  /** @param {number} size @returns {CaptionStyle} */
  setFontSize(size) { this.fontSize = size; return this; }

  /** @param {string|GradientFill} fill @returns {CaptionStyle} */
  setFill(fill) { this.fill = fill; return this; }

  /** @param {{ color: string, width: number, join?: string }} stroke @returns {CaptionStyle} */
  setStroke(color, width = 2, join = 'round') {
    this.stroke = { color, width, join };
    return this;
  }

  /**
   * Set a drop shadow.
   * @param {string} color
   * @param {number} offsetX
   * @param {number} offsetY
   * @param {number} blur
   * @returns {CaptionStyle}
   */
  setShadow(color, offsetX = 2, offsetY = 2, blur = 4) {
    this.shadow = { color, offsetX, offsetY, blur, spread: 0 };
    return this;
  }

  /**
   * Set a text glow.
   * @param {string} color
   * @param {number} blur
   * @param {number} strength
   * @returns {CaptionStyle}
   */
  setGlow(color, blur = 10, strength = 1) {
    this.glow = { color, blur, strength, layers: 2 };
    return this;
  }

  /**
   * Set a background box behind the text.
   * @param {string} color
   * @param {number|object} padding
   * @param {number} borderRadius
   * @param {number} opacity
   * @returns {CaptionStyle}
   */
  setBackground(color, padding = 8, borderRadius = 4, opacity = 1) {
    this.background = {
      color,
      padding: typeof padding === 'number'
        ? { top: padding, right: padding, bottom: padding, left: padding }
        : padding,
      borderRadius,
      opacity,
    };
    return this;
  }

  // ─── Clone / serialise ────────────────────────────────────────────────────────

  /**
   * Deep-clone this style.
   * @returns {CaptionStyle}
   */
  clone() {
    return CaptionStyle.fromJSON(this.toJSON());
  }

  /**
   * Serialise to a plain object.
   * @returns {object}
   */
  toJSON() {
    return {
      id:                 this.id,
      fontFamily:         this.fontFamily,
      fontWeight:         this.fontWeight,
      fontSize:           this.fontSize,
      fontStyle:          this.fontStyle,
      textTransform:      this.textTransform,
      letterSpacing:      this.letterSpacing,
      tracking:           this.tracking,
      lineHeight:         this.lineHeight,
      wordSpacing:        this.wordSpacing,
      paragraphSpacing:   this.paragraphSpacing,
      fill:               this.fill,
      fillOpacity:        this.fillOpacity,
      stroke:             this.stroke ? { ...this.stroke } : null,
      shadow:             this.shadow ? { ...this.shadow } : null,
      glow:               this.glow   ? { ...this.glow   } : null,
      background:         this.background ? {
        ...this.background,
        padding: { ...this.background.padding },
      } : null,
      underline:          this.underline,
      underlineStyle:     this.underlineStyle ? { ...this.underlineStyle } : null,
      strikethrough:      this.strikethrough,
      strikethroughStyle: this.strikethroughStyle ? { ...this.strikethroughStyle } : null,
      textAlign:          this.textAlign,
      verticalAlign:      this.verticalAlign,
      blendMode:          this.blendMode,
      antiAlias:          this.antiAlias,
      textRendering:      this.textRendering,
    };
  }

  /**
   * @param {object} data
   * @returns {CaptionStyle}
   */
  static fromJSON(data) {
    const style = new CaptionStyle(data);
    if (data.id) style.id = data.id;
    return style;
  }

  // ─── Static factory presets ───────────────────────────────────────────────────

  /** Bold white with black stroke — general purpose. */
  static bold() {
    return new CaptionStyle({ fontWeight: 900, fill: '#FFFFFF' })
      .setStroke('#000000', 3, 'round');
  }

  /** Yellow highlighted word for Hormozi-style. */
  static hormozi() {
    return new CaptionStyle({
      fontFamily: 'Impact',
      fontWeight: 900,
      fontSize: 72,
      fill: '#FFFFFF',
      textTransform: 'uppercase',
      letterSpacing: 2,
    }).setStroke('#000000', 4, 'round');
  }

  /** Minimal clean subtitle style. */
  static minimal() {
    return new CaptionStyle({
      fontFamily: 'Helvetica Neue, sans-serif',
      fontWeight: 400,
      fontSize: 36,
      fill: '#FFFFFF',
    }).setBackground('rgba(0,0,0,0.5)', 6, 2);
  }

  /** News chyron style. */
  static news() {
    return new CaptionStyle({
      fontFamily: 'Arial Narrow, Arial, sans-serif',
      fontWeight: 700,
      fontSize: 32,
      fill: '#FFFFFF',
      textTransform: 'uppercase',
      textAlign: 'left',
    });
  }

  /** Luxury / editorial style. */
  static luxury() {
    return new CaptionStyle({
      fontFamily: 'Playfair Display, Georgia, serif',
      fontWeight: 400,
      fontSize: 42,
      fill: '#D4AF37',
      letterSpacing: 4,
      textTransform: 'uppercase',
    });
  }
}

export default CaptionStyle;
