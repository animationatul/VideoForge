/**
 * @module TextClip
 * A synthetic clip that renders text directly onto the canvas.
 * No source asset is required.
 */

import Clip from '../core/Clip.js';
import { CLIP_TYPES, TEXT_ALIGN } from '../utils/Constants.js';

class TextClip extends Clip {
  /**
   * @param {string} text - The text content to render.
   * @param {object} [options={}]
   * @param {number}  [options.startTime=0]
   * @param {number}  [options.outPoint=5]     - Holds for 5 s by default.
   * @param {string}  [options.fontFamily='Arial']
   * @param {number}  [options.fontSizeValue=48]
   * @param {string}  [options.colorValue='#FFFFFF']
   * @param {string}  [options.bgColor='transparent']
   * @param {string}  [options.alignValue=TEXT_ALIGN.CENTER]
   * @param {boolean} [options.bold=false]
   * @param {boolean} [options.italic=false]
   * @param {number}  [options.x=0]
   * @param {number}  [options.y=0]
   * @param {number}  [options.opacityLevel=1]
   */
  constructor(text, options = {}) {
    super(null, {
      ...options,
      type: CLIP_TYPES.TEXT,
      outPoint: options.outPoint ?? 5,
    });

    /** @type {string} */
    this.text = text ?? '';

    /** @type {string} */
    this._fontFamily = options.fontFamily ?? 'Arial';

    /** @type {number} Points. */
    this._fontSizeValue = options.fontSizeValue ?? 48;

    /** @type {string} CSS colour string or hex. */
    this._colorValue = options.colorValue ?? '#FFFFFF';

    /** @type {string} Background fill — 'transparent' disables. */
    this._bgColor = options.bgColor ?? 'transparent';

    /** @type {string} One of TEXT_ALIGN.*  */
    this._alignValue = options.alignValue ?? TEXT_ALIGN.CENTER;

    /** @type {boolean} */
    this._bold = options.bold ?? false;

    /** @type {boolean} */
    this._italic = options.italic ?? false;

    /** @type {number} Canvas X position. */
    this._x = options.x ?? 0;

    /** @type {number} Canvas Y position. */
    this._y = options.y ?? 0;

    /** @type {number} 0–1. */
    this._opacityLevel = options.opacityLevel ?? 1;
  }

  // ─── Text styling controls ───────────────────────────────────────────────────

  /**
   * Get or set the font family.
   * @param {string} [name]
   * @returns {string|TextClip}
   */
  font(name) {
    if (name === undefined) return this._fontFamily;
    this._fontFamily = name;
    return this;
  }

  /**
   * Get or set the font size (pt).
   * @param {number} [size]
   * @returns {number|TextClip}
   */
  fontSize(size) {
    if (size === undefined) return this._fontSizeValue;
    if (size <= 0) throw new RangeError('Font size must be > 0');
    this._fontSizeValue = size;
    return this;
  }

  /**
   * Get or set the text colour.
   * @param {string} [value] - CSS colour or hex string.
   * @returns {string|TextClip}
   */
  color(value) {
    if (value === undefined) return this._colorValue;
    this._colorValue = value;
    return this;
  }

  /**
   * Get or set the background fill colour.
   * @param {string} [value] - CSS colour, hex, or 'transparent'.
   * @returns {string|TextClip}
   */
  background(value) {
    if (value === undefined) return this._bgColor;
    this._bgColor = value;
    return this;
  }

  /**
   * Get or set text alignment.
   * @param {string} [value] - One of TEXT_ALIGN.*.
   * @returns {string|TextClip}
   */
  align(value) {
    if (value === undefined) return this._alignValue;
    this._alignValue = value;
    return this;
  }

  /**
   * Toggle or set bold.
   * @param {boolean} [value]
   * @returns {boolean|TextClip}
   */
  bold(value) {
    if (value === undefined) return this._bold;
    this._bold = Boolean(value);
    return this;
  }

  /**
   * Toggle or set italic.
   * @param {boolean} [value]
   * @returns {boolean|TextClip}
   */
  italic(value) {
    if (value === undefined) return this._italic;
    this._italic = Boolean(value);
    return this;
  }

  /**
   * Get or set canvas position.
   * @param {number} [x]
   * @param {number} [y]
   * @returns {{x:number,y:number}|TextClip}
   */
  position(x, y) {
    if (x === undefined) return { x: this._x, y: this._y };
    this._x = x;
    this._y = y ?? this._y;
    return this;
  }

  /**
   * Get or set opacity.
   * @param {number} [value] - 0–1.
   * @returns {number|TextClip}
   */
  opacity(value) {
    if (value === undefined) return this._opacityLevel;
    if (value < 0 || value > 1) throw new RangeError('Opacity must be in range [0, 1]');
    this._opacityLevel = value;
    return this;
  }

  // ─── Protected ────────────────────────────────────────────────────────────────

  _createInstance() {
    return new TextClip(this.text, {
      fontFamily: this._fontFamily,
      fontSizeValue: this._fontSizeValue,
      colorValue: this._colorValue,
      bgColor: this._bgColor,
      alignValue: this._alignValue,
      bold: this._bold,
      italic: this._italic,
      x: this._x,
      y: this._y,
      opacityLevel: this._opacityLevel,
    });
  }

  // ─── Serialisation ────────────────────────────────────────────────────────────

  toJSON() {
    return {
      ...super.toJSON(),
      text: this.text,
      fontFamily: this._fontFamily,
      fontSizeValue: this._fontSizeValue,
      colorValue: this._colorValue,
      bgColor: this._bgColor,
      alignValue: this._alignValue,
      bold: this._bold,
      italic: this._italic,
      x: this._x,
      y: this._y,
      opacityLevel: this._opacityLevel,
    };
  }

  /**
   * @param {object} data
   * @returns {TextClip}
   */
  static fromJSON(data) {
    const clip = new TextClip(data.text, {
      startTime: data.startTime,
      outPoint: data.outPoint,
      fontFamily: data.fontFamily,
      fontSizeValue: data.fontSizeValue,
      colorValue: data.colorValue,
      bgColor: data.bgColor,
      alignValue: data.alignValue,
      bold: data.bold,
      italic: data.italic,
      x: data.x,
      y: data.y,
      opacityLevel: data.opacityLevel,
    });
    clip.id = data.id;
    clip.name = data.name;
    clip.locked = data.locked;
    clip.visible = data.visible;
    clip.createdAt = new Date(data.createdAt);
    // TODO: Rehydrate effects.
    return clip;
  }
}

export default TextClip;
