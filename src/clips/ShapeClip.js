/**
 * @module ShapeClip
 * A synthetic clip that renders a geometric shape onto the canvas.
 * Supports rectangles, ellipses, triangles, lines, polygons, and arrows.
 */

import Clip from '../core/Clip.js';
import { CLIP_TYPES, SHAPE_TYPES } from '../utils/Constants.js';

class ShapeClip extends Clip {
  /**
   * @param {string} [shapeType=SHAPE_TYPES.RECTANGLE]
   * @param {object} [options={}]
   * @param {number}  [options.startTime=0]
   * @param {number}  [options.outPoint=5]
   * @param {number}  [options.x=0]
   * @param {number}  [options.y=0]
   * @param {number}  [options.width=200]
   * @param {number}  [options.height=200]
   * @param {string}  [options.fillColor='#FF0000']
   * @param {string}  [options.strokeColorValue='transparent']
   * @param {number}  [options.strokeWidthValue=0]
   * @param {number}  [options.opacityLevel=1]
   * @param {number}  [options.rotationDeg=0]
   * @param {number}  [options.cornerRadius=0] - Rounds corners (rectangles only).
   */
  constructor(shapeType = SHAPE_TYPES.RECTANGLE, options = {}) {
    super(null, {
      ...options,
      type: CLIP_TYPES.SHAPE,
      outPoint: options.outPoint ?? 5,
    });

    /** @type {string} One of SHAPE_TYPES.*  */
    this.shapeType = shapeType;

    /** @type {number} */
    this._x = options.x ?? 0;

    /** @type {number} */
    this._y = options.y ?? 0;

    /** @type {number} Bounding-box width in pixels. */
    this._width = options.width ?? 200;

    /** @type {number} Bounding-box height in pixels. */
    this._height = options.height ?? 200;

    /** @type {string} CSS colour or 'transparent'. */
    this._fillColor = options.fillColor ?? '#FF0000';

    /** @type {string} */
    this._strokeColorValue = options.strokeColorValue ?? 'transparent';

    /** @type {number} Stroke width in pixels. */
    this._strokeWidthValue = options.strokeWidthValue ?? 0;

    /** @type {number} 0–1. */
    this._opacityLevel = options.opacityLevel ?? 1;

    /** @type {number} Degrees clockwise. */
    this._rotationDeg = options.rotationDeg ?? 0;

    /** @type {number} Border radius for rectangles (px). */
    this._cornerRadius = options.cornerRadius ?? 0;
  }

  // ─── Shape controls ───────────────────────────────────────────────────────────

  /**
   * Get or set canvas position.
   * @param {number} [x]
   * @param {number} [y]
   * @returns {{x:number,y:number}|ShapeClip}
   */
  position(x, y) {
    if (x === undefined) return { x: this._x, y: this._y };
    this._x = x;
    this._y = y ?? this._y;
    return this;
  }

  /**
   * Get or set bounding-box size.
   * @param {number} [width]
   * @param {number} [height]
   * @returns {{width:number,height:number}|ShapeClip}
   */
  size(width, height) {
    if (width === undefined) return { width: this._width, height: this._height };
    if (width <= 0) throw new RangeError('Width must be > 0');
    this._width = width;
    this._height = height !== undefined ? height : this._height;
    return this;
  }

  /**
   * Get or set fill colour.
   * @param {string} [value]
   * @returns {string|ShapeClip}
   */
  fillColor(value) {
    if (value === undefined) return this._fillColor;
    this._fillColor = value;
    return this;
  }

  /**
   * Get or set stroke colour.
   * @param {string} [value]
   * @returns {string|ShapeClip}
   */
  strokeColor(value) {
    if (value === undefined) return this._strokeColorValue;
    this._strokeColorValue = value;
    return this;
  }

  /**
   * Get or set stroke width (pixels).
   * @param {number} [value]
   * @returns {number|ShapeClip}
   */
  strokeWidth(value) {
    if (value === undefined) return this._strokeWidthValue;
    if (value < 0) throw new RangeError('Stroke width must be >= 0');
    this._strokeWidthValue = value;
    return this;
  }

  /**
   * Get or set opacity.
   * @param {number} [value] - 0–1.
   * @returns {number|ShapeClip}
   */
  opacity(value) {
    if (value === undefined) return this._opacityLevel;
    if (value < 0 || value > 1) throw new RangeError('Opacity must be in range [0, 1]');
    this._opacityLevel = value;
    return this;
  }

  /**
   * Get or set rotation in degrees.
   * @param {number} [degrees]
   * @returns {number|ShapeClip}
   */
  rotation(degrees) {
    if (degrees === undefined) return this._rotationDeg;
    this._rotationDeg = degrees % 360;
    return this;
  }

  /**
   * Get or set corner radius (rectangles only).
   * @param {number} [value]
   * @returns {number|ShapeClip}
   */
  cornerRadius(value) {
    if (value === undefined) return this._cornerRadius;
    if (value < 0) throw new RangeError('Corner radius must be >= 0');
    this._cornerRadius = value;
    return this;
  }

  // ─── Protected ────────────────────────────────────────────────────────────────

  _createInstance() {
    return new ShapeClip(this.shapeType, {
      x: this._x,
      y: this._y,
      width: this._width,
      height: this._height,
      fillColor: this._fillColor,
      strokeColorValue: this._strokeColorValue,
      strokeWidthValue: this._strokeWidthValue,
      opacityLevel: this._opacityLevel,
      rotationDeg: this._rotationDeg,
      cornerRadius: this._cornerRadius,
    });
  }

  // ─── Serialisation ────────────────────────────────────────────────────────────

  toJSON() {
    return {
      ...super.toJSON(),
      shapeType: this.shapeType,
      x: this._x,
      y: this._y,
      width: this._width,
      height: this._height,
      fillColor: this._fillColor,
      strokeColorValue: this._strokeColorValue,
      strokeWidthValue: this._strokeWidthValue,
      opacityLevel: this._opacityLevel,
      rotationDeg: this._rotationDeg,
      cornerRadius: this._cornerRadius,
    };
  }

  /**
   * @param {object} data
   * @returns {ShapeClip}
   */
  static fromJSON(data) {
    const clip = new ShapeClip(data.shapeType, {
      startTime: data.startTime,
      outPoint: data.outPoint,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      fillColor: data.fillColor,
      strokeColorValue: data.strokeColorValue,
      strokeWidthValue: data.strokeWidthValue,
      opacityLevel: data.opacityLevel,
      rotationDeg: data.rotationDeg,
      cornerRadius: data.cornerRadius,
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

export default ShapeClip;
