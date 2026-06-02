/**
 * @module ImageClip
 * A clip backed by an image asset, with 2-D transform controls
 * (position, scale, rotation, opacity).
 */

import Clip from '../core/Clip.js';
import Asset from '../core/Asset.js';
import { CLIP_TYPES } from '../utils/Constants.js';

class ImageClip extends Clip {
  /**
   * @param {Asset|null} asset
   * @param {object} [options={}]
   * @param {number} [options.startTime=0]
   * @param {number} [options.inPoint=0]
   * @param {number} [options.outPoint=5]   - Images hold for 5 s by default.
   * @param {number} [options.x=0]
   * @param {number} [options.y=0]
   * @param {number} [options.scaleX=1]
   * @param {number} [options.scaleY=1]
   * @param {number} [options.rotation=0]   - Degrees clockwise.
   * @param {number} [options.opacityLevel=1] - 0–1.
   */
  constructor(asset, options = {}) {
    super(asset, {
      ...options,
      type: CLIP_TYPES.IMAGE,
      outPoint: options.outPoint ?? 5,
    });

    /** @type {number} X position in pixels relative to the canvas origin. */
    this._x = options.x ?? 0;

    /** @type {number} Y position in pixels. */
    this._y = options.y ?? 0;

    /** @type {number} Horizontal scale multiplier. */
    this._scaleX = options.scaleX ?? 1;

    /** @type {number} Vertical scale multiplier. */
    this._scaleY = options.scaleY ?? 1;

    /** @type {number} Rotation in degrees (clockwise). */
    this._rotation = options.rotation ?? 0;

    /** @type {number} Opacity 0–1. */
    this._opacityLevel = options.opacityLevel ?? 1;
  }

  // ─── Transform controls ───────────────────────────────────────────────────────

  /**
   * Get or set the (x, y) canvas position.
   * @param {number} [x]
   * @param {number} [y]
   * @returns {{x:number,y:number}|ImageClip}
   */
  position(x, y) {
    if (x === undefined) return { x: this._x, y: this._y };
    this._x = x;
    this._y = y ?? this._y;
    return this;
  }

  /**
   * Get or set scale.  Pass two values to scale non-uniformly.
   * @param {number} [x]
   * @param {number} [y] - Defaults to x (uniform scale).
   * @returns {{x:number,y:number}|ImageClip}
   */
  scale(x, y) {
    if (x === undefined) return { x: this._scaleX, y: this._scaleY };
    this._scaleX = x;
    this._scaleY = y !== undefined ? y : x;
    return this;
  }

  /**
   * Get or set rotation.
   * @param {number} [degrees]
   * @returns {number|ImageClip}
   */
  rotation(degrees) {
    if (degrees === undefined) return this._rotation;
    this._rotation = degrees % 360;
    return this;
  }

  /**
   * Get or set opacity.
   * @param {number} [value] - 0–1.
   * @returns {number|ImageClip}
   */
  opacity(value) {
    if (value === undefined) return this._opacityLevel;
    if (value < 0 || value > 1) throw new RangeError('Opacity must be in range [0, 1]');
    this._opacityLevel = value;
    return this;
  }

  // ─── Protected ────────────────────────────────────────────────────────────────

  _createInstance() {
    return new ImageClip(null, {
      x: this._x,
      y: this._y,
      scaleX: this._scaleX,
      scaleY: this._scaleY,
      rotation: this._rotation,
      opacityLevel: this._opacityLevel,
    });
  }

  // ─── Serialisation ────────────────────────────────────────────────────────────

  toJSON() {
    return {
      ...super.toJSON(),
      x: this._x,
      y: this._y,
      scaleX: this._scaleX,
      scaleY: this._scaleY,
      rotation: this._rotation,
      opacityLevel: this._opacityLevel,
    };
  }

  /**
   * @param {object} data
   * @returns {ImageClip}
   */
  static fromJSON(data) {
    const asset = data.asset ? Asset.fromJSON(data.asset) : null;
    const clip = new ImageClip(asset, {
      startTime: data.startTime,
      inPoint: data.inPoint,
      outPoint: data.outPoint,
      x: data.x,
      y: data.y,
      scaleX: data.scaleX,
      scaleY: data.scaleY,
      rotation: data.rotation,
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

export default ImageClip;
