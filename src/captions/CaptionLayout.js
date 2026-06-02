/**
 * @module CaptionLayout
 * Spatial layout engine for the Caption & Motion Typography Engine.
 *
 * CaptionLayout defines HOW and WHERE captions are positioned on the canvas —
 * anchor points, safe zones, wrap strategy, responsive scaling, and caption regions.
 */

import IdGenerator from '../utils/IdGenerator.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const WRAP_MODE = Object.freeze({
  NONE:      'none',
  WORD:      'word',
  CHARACTER: 'character',
  AUTO:      'auto',
});

export const ANCHOR_POINT = Object.freeze({
  TOP_LEFT:      'topLeft',
  TOP_CENTER:    'topCenter',
  TOP_RIGHT:     'topRight',
  MIDDLE_LEFT:   'middleLeft',
  CENTER:        'center',
  MIDDLE_RIGHT:  'middleRight',
  BOTTOM_LEFT:   'bottomLeft',
  BOTTOM_CENTER: 'bottomCenter',
  BOTTOM_RIGHT:  'bottomRight',
});

// Normalised {x, y} values for each anchor point.
const ANCHOR_VECTORS = {
  topLeft:      { x: 0,   y: 0   },
  topCenter:    { x: 0.5, y: 0   },
  topRight:     { x: 1,   y: 0   },
  middleLeft:   { x: 0,   y: 0.5 },
  center:       { x: 0.5, y: 0.5 },
  middleRight:  { x: 1,   y: 0.5 },
  bottomLeft:   { x: 0,   y: 1   },
  bottomCenter: { x: 0.5, y: 1   },
  bottomRight:  { x: 1,   y: 1   },
};

/** Social-media-aware safe zones (percentage insets from each edge). */
export const SOCIAL_SAFE_ZONES = Object.freeze({
  tiktok:    { top: 0.12, right: 0.05, bottom: 0.22, left: 0.05 },
  instagram: { top: 0.10, right: 0.05, bottom: 0.20, left: 0.05 },
  youtube:   { top: 0.10, right: 0.05, bottom: 0.12, left: 0.05 },
  shorts:    { top: 0.12, right: 0.05, bottom: 0.22, left: 0.05 },
  reels:     { top: 0.10, right: 0.05, bottom: 0.20, left: 0.05 },
  twitter:   { top: 0.08, right: 0.05, bottom: 0.10, left: 0.05 },
  broadcast: { top: 0.10, right: 0.10, bottom: 0.10, left: 0.10 },
  // Generic cinematic safe zone (action safe)
  action:    { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 },
  // Title safe
  title:     { top: 0.10, right: 0.10, bottom: 0.10, left: 0.10 },
});

// ─── CaptionLayout ────────────────────────────────────────────────────────────

class CaptionLayout {
  /**
   * @param {object} [options={}]
   *
   * Position
   * @param {number} [options.x=0.5]              - Normalised canvas X (0–1).
   * @param {number} [options.y=0.85]             - Normalised canvas Y (0–1).
   * @param {string} [options.anchor=ANCHOR_POINT.BOTTOM_CENTER]
   *
   * Bounds
   * @param {number|null} [options.maxWidth=null]  - px; null = full canvas width minus margins
   * @param {number|null} [options.maxHeight=null]
   *
   * Wrap
   * @param {string} [options.wrapMode=WRAP_MODE.WORD]
   * @param {number} [options.maxWordsPerLine=6]
   * @param {number} [options.maxCharsPerLine=40]
   *
   * Alignment
   * @param {'left'|'center'|'right'|'justify'} [options.textAlign='center']
   *
   * Padding
   * @param {number|object} [options.padding=0]
   *
   * Safe zone
   * @param {object|null} [options.safeZone=null]   - { top, right, bottom, left } (0–1 fractions)
   * @param {string|null} [options.safeZonePreset=null] - One of SOCIAL_SAFE_ZONES keys
   *
   * Responsive
   * @param {boolean} [options.responsive=true]
   * @param {number}  [options.referenceWidth=1920]
   * @param {number}  [options.referenceHeight=1080]
   *
   * Z-order
   * @param {number} [options.zIndex=10]
   */
  constructor(options = {}) {
    this.id = IdGenerator.generate('layout');

    // ── Position ───────────────────────────────────────────────────────────
    this.x      = options.x      ?? 0.5;
    this.y      = options.y      ?? 0.85;
    this.anchor = options.anchor ?? ANCHOR_POINT.BOTTOM_CENTER;

    // ── Bounds ─────────────────────────────────────────────────────────────
    this.maxWidth  = options.maxWidth  ?? null;
    this.maxHeight = options.maxHeight ?? null;

    // ── Wrap ───────────────────────────────────────────────────────────────
    this.wrapMode       = options.wrapMode       ?? WRAP_MODE.WORD;
    this.maxWordsPerLine = options.maxWordsPerLine ?? 6;
    this.maxCharsPerLine = options.maxCharsPerLine ?? 40;

    // ── Alignment ──────────────────────────────────────────────────────────
    this.textAlign = options.textAlign ?? 'center';

    // ── Padding ────────────────────────────────────────────────────────────
    const p = options.padding ?? 0;
    this.padding = typeof p === 'number'
      ? { top: p, right: p, bottom: p, left: p }
      : { top: 0, right: 0, bottom: 0, left: 0, ...p };

    // ── Safe zone ──────────────────────────────────────────────────────────
    this.safeZone = options.safeZone ?? null;
    if (options.safeZonePreset) {
      this.safeZone = { ...SOCIAL_SAFE_ZONES[options.safeZonePreset] };
    }

    // ── Responsive ─────────────────────────────────────────────────────────
    this.responsive       = options.responsive       ?? true;
    this.referenceWidth   = options.referenceWidth   ?? 1920;
    this.referenceHeight  = options.referenceHeight  ?? 1080;

    // ── Z-order ────────────────────────────────────────────────────────────
    this.zIndex = options.zIndex ?? 10;
  }

  // ─── Safe-zone presets ────────────────────────────────────────────────────────

  /**
   * Apply a social-media safe zone preset by name.
   * @param {'tiktok'|'instagram'|'youtube'|'shorts'|'reels'|'broadcast'|string} platform
   * @returns {CaptionLayout} this (chainable)
   */
  applySafeZone(platform) {
    const zone = SOCIAL_SAFE_ZONES[platform];
    if (!zone) throw new Error(`Unknown safe zone preset: "${platform}". Available: ${Object.keys(SOCIAL_SAFE_ZONES).join(', ')}`);
    this.safeZone = { ...zone };
    return this;
  }

  // ─── Anchor helpers ───────────────────────────────────────────────────────────

  /**
   * Get the pixel position of this layout's origin point on a canvas.
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @returns {{ x: number, y: number }}
   */
  getCanvasPosition(canvasWidth, canvasHeight) {
    const sx = canvasWidth  * this.x;
    const sy = canvasHeight * this.y;
    return { x: sx, y: sy };
  }

  /**
   * Compute the effective bounding region after applying safe zones.
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  getEffectiveRegion(canvasWidth, canvasHeight) {
    const z = this.safeZone ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const x = canvasWidth  * z.left;
    const y = canvasHeight * z.top;
    const w = canvasWidth  * (1 - z.left - z.right);
    const h = canvasHeight * (1 - z.top  - z.bottom);
    return { x, y, width: w, height: h };
  }

  /**
   * Compute a responsive font size scale factor for the target canvas dimensions.
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @returns {number}
   */
  getResponsiveScale(canvasWidth, canvasHeight) {
    if (!this.responsive) return 1;
    const scaleX = canvasWidth  / this.referenceWidth;
    const scaleY = canvasHeight / this.referenceHeight;
    return Math.min(scaleX, scaleY);
  }

  // ─── Layout computation ───────────────────────────────────────────────────────

  /**
   * Compute line breaks for a sequence of words given a canvas width.
   * Returns an array of word-index arrays, each representing one line.
   *
   * @param {import('./CaptionWord.js').default[]} words
   * @param {number} canvasWidth
   * @returns {number[][]} Line break groups (arrays of word indices).
   */
  computeLineBreaks(words, canvasWidth) {
    // TODO: Measure text widths using a backend text-measurement interface.
    //       For now, fall back to maxWordsPerLine.
    const lines = [];
    let current = [];

    for (let i = 0; i < words.length; i++) {
      current.push(i);
      if (
        (this.wrapMode === WRAP_MODE.WORD || this.wrapMode === WRAP_MODE.AUTO) &&
        current.length >= this.maxWordsPerLine
      ) {
        lines.push(current);
        current = [];
      }
    }
    if (current.length) lines.push(current);
    return lines;
  }

  // ─── Static factory presets ───────────────────────────────────────────────────

  /** Standard lower-third caption position. */
  static lowerThird() {
    return new CaptionLayout({ x: 0.5, y: 0.88, anchor: ANCHOR_POINT.BOTTOM_CENTER });
  }

  /** TikTok / Shorts caption with built-in safe zone. */
  static tiktok() {
    return new CaptionLayout({ x: 0.5, y: 0.7, safeZonePreset: 'tiktok' });
  }

  /** Centered screen. */
  static centered() {
    return new CaptionLayout({ x: 0.5, y: 0.5, anchor: ANCHOR_POINT.CENTER });
  }

  /** Top banner. */
  static topBanner() {
    return new CaptionLayout({ x: 0.5, y: 0.08, anchor: ANCHOR_POINT.TOP_CENTER });
  }

  /** News lower-third — left-aligned. */
  static newsChyron() {
    return new CaptionLayout({ x: 0.02, y: 0.88, anchor: ANCHOR_POINT.BOTTOM_LEFT, textAlign: 'left' });
  }

  // ─── Clone / serialise ────────────────────────────────────────────────────────

  clone() {
    return CaptionLayout.fromJSON(this.toJSON());
  }

  toJSON() {
    return {
      id:              this.id,
      x:               this.x,
      y:               this.y,
      anchor:          this.anchor,
      maxWidth:        this.maxWidth,
      maxHeight:       this.maxHeight,
      wrapMode:        this.wrapMode,
      maxWordsPerLine: this.maxWordsPerLine,
      maxCharsPerLine: this.maxCharsPerLine,
      textAlign:       this.textAlign,
      padding:         { ...this.padding },
      safeZone:        this.safeZone ? { ...this.safeZone } : null,
      responsive:      this.responsive,
      referenceWidth:  this.referenceWidth,
      referenceHeight: this.referenceHeight,
      zIndex:          this.zIndex,
    };
  }

  static fromJSON(data) {
    const layout = new CaptionLayout(data);
    if (data.id) layout.id = data.id;
    return layout;
  }
}

export default CaptionLayout;
