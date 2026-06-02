/**
 * @module CaptionKeyframe
 * Universal keyframe system for the Caption & Motion Typography Engine.
 *
 * Three interrelated classes:
 *   - CaptionKeyframe  — a single (time, properties, easing) snapshot
 *   - KeyframeTrack    — a sorted sequence of keyframes for ONE property
 *   - KeyframeSet      — a collection of KeyframeTracks for one element
 *
 * Any animatable element (caption, segment, word, character) has a KeyframeSet
 * so that every keyframeable property can be interpolated independently.
 */

import IdGenerator from '../utils/IdGenerator.js';

// ─── Keyframeable properties ──────────────────────────────────────────────────

export const KEYFRAMEABLE_PROPERTIES = Object.freeze([
  'x', 'y',
  'scaleX', 'scaleY',
  'rotation',
  'opacity',
  'blur',
  'color', 'fill',
  'stroke', 'strokeWidth',
  'shadowBlur', 'shadowOffsetX', 'shadowOffsetY',
  'letterSpacing', 'tracking',
  'lineHeight',
  'backgroundOpacity',
  'glowBlur', 'glowStrength',
  'fontSize',
  'skewX', 'skewY',
]);

// ─── Easing functions ─────────────────────────────────────────────────────────

export const CAPTION_EASING = Object.freeze({
  LINEAR:          'linear',
  EASE_IN:         'easeIn',
  EASE_OUT:        'easeOut',
  EASE_IN_OUT:     'easeInOut',
  EASE_IN_BACK:    'easeInBack',
  EASE_OUT_BACK:   'easeOutBack',
  EASE_IN_OUT_BACK:'easeInOutBack',
  EASE_IN_BOUNCE:  'easeInBounce',
  EASE_OUT_BOUNCE: 'easeOutBounce',
  EASE_IN_ELASTIC: 'easeInElastic',
  EASE_OUT_ELASTIC:'easeOutElastic',
  SPRING:          'spring',
  SNAP:            'snap',
  OVERSHOOT:       'overshoot',
});

/**
 * Compute an eased value of `t` ∈ [0, 1].
 *
 * @param {string} easing - One of CAPTION_EASING.*
 * @param {number} t      - Linear progress [0, 1].
 * @returns {number}
 */
export function computeEasing(easing, t) {
  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  const c3 = c1 + 1;

  switch (easing) {
    case 'linear':         return t;
    case 'easeIn':         return t * t;
    case 'easeOut':        return t * (2 - t);
    case 'easeInOut':      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'easeInBack':     return c3 * t * t * t - c1 * t * t;
    case 'easeOutBack':    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    case 'easeInOutBack':
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    case 'easeInBounce':   return 1 - computeEasing('easeOutBounce', 1 - t);
    case 'easeOutBounce': {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1)        return n1 * t * t;
      else if (t < 2 / d1)   return n1 * (t -= 1.5 / d1) * t + 0.75;
      else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      else                   return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
    case 'easeInElastic': {
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1
        : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    }
    case 'easeOutElastic': {
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    case 'spring': {
      // Simplified spring: overshoot and settle
      return 1 - Math.pow(Math.E, -6 * t) * Math.cos(10 * t);
    }
    case 'snap': {
      return t < 0.85 ? computeEasing('easeOut', t / 0.85) : 1;
    }
    case 'overshoot': {
      return 1 + 1.5 * Math.pow(t - 1, 3) + 1.5 * Math.pow(t - 1, 2);
    }
    default: return t;
  }
}

/**
 * Linear interpolation between two scalar values.
 * @param {number} a
 * @param {number} b
 * @param {number} t - [0, 1]
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ─── CaptionKeyframe ──────────────────────────────────────────────────────────

class CaptionKeyframe {
  /**
   * @param {object} options
   * @param {number} options.time         - Position in seconds (relative to parent element start).
   * @param {object} options.properties   - { x, y, opacity, ... } snapshot of values.
   * @param {string} [options.easing='linear']
   * @param {string} [options.label]      - Optional human-readable name.
   */
  constructor({ time, properties = {}, easing = 'linear', label = '' } = {}) {
    /** @type {string} */
    this.id = IdGenerator.generate('kf');

    /** @type {number} */
    this.time = time;

    /** @type {object} Subset of KEYFRAMEABLE_PROPERTIES. */
    this.properties = { ...properties };

    /** @type {string} */
    this.easing = easing;

    /** @type {string} */
    this.label = label;
  }

  // ─── Clone / serialise ────────────────────────────────────────────────────────

  clone() {
    const k = new CaptionKeyframe({
      time: this.time,
      properties: { ...this.properties },
      easing: this.easing,
      label: this.label,
    });
    k.id = IdGenerator.generate('kf');
    return k;
  }

  toJSON() {
    return {
      id: this.id,
      time: this.time,
      properties: { ...this.properties },
      easing: this.easing,
      label: this.label,
    };
  }

  static fromJSON(data) {
    const kf = new CaptionKeyframe(data);
    kf.id = data.id;
    return kf;
  }
}

// ─── KeyframeTrack ────────────────────────────────────────────────────────────

class KeyframeTrack {
  /**
   * Manages all keyframes for a single property on a single element.
   * @param {string} property - One of KEYFRAMEABLE_PROPERTIES.
   */
  constructor(property) {
    if (!KEYFRAMEABLE_PROPERTIES.includes(property)) {
      throw new TypeError(`"${property}" is not a keyframeable property.`);
    }

    /** @type {string} */
    this.property = property;

    /** @type {CaptionKeyframe[]} Maintained in sorted order. */
    this._keyframes = [];
  }

  /**
   * Add a keyframe.
   * @param {number} time
   * @param {number|string} value
   * @param {string} [easing='linear']
   * @returns {CaptionKeyframe} The created keyframe.
   */
  addKeyframe(time, value, easing = 'linear') {
    // Replace existing keyframe at same time if present.
    this._keyframes = this._keyframes.filter((k) => k.time !== time);
    const kf = new CaptionKeyframe({ time, properties: { [this.property]: value }, easing });
    this._keyframes.push(kf);
    this._sort();
    return kf;
  }

  /**
   * Remove a keyframe by ID.
   * @param {string} id
   * @returns {boolean}
   */
  removeKeyframe(id) {
    const before = this._keyframes.length;
    this._keyframes = this._keyframes.filter((k) => k.id !== id);
    return this._keyframes.length < before;
  }

  /**
   * Interpolate the property value at `time`.
   *
   * @param {number} time
   * @returns {number|string|null} Null if no keyframes are defined.
   */
  getValueAtTime(time) {
    const kfs = this._keyframes;
    if (kfs.length === 0) return null;
    if (time <= kfs[0].time) return kfs[0].properties[this.property];
    if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].properties[this.property];

    // Find surrounding keyframes.
    let lo = 0;
    for (let i = 0; i < kfs.length - 1; i++) {
      if (kfs[i].time <= time && kfs[i + 1].time >= time) { lo = i; break; }
    }
    const a = kfs[lo];
    const b = kfs[lo + 1];
    const t = (time - a.time) / (b.time - a.time);
    const eased = computeEasing(a.easing, t);

    const va = a.properties[this.property];
    const vb = b.properties[this.property];

    // Numeric interpolation only — string values (colors, etc.) snap at midpoint.
    if (typeof va === 'number' && typeof vb === 'number') {
      return lerp(va, vb, eased);
    }
    return eased < 0.5 ? va : vb;
  }

  /** @returns {CaptionKeyframe[]} */
  getKeyframes() { return [...this._keyframes]; }

  _sort() {
    this._keyframes.sort((a, b) => a.time - b.time);
  }

  toJSON() {
    return {
      property: this.property,
      keyframes: this._keyframes.map((k) => k.toJSON()),
    };
  }

  static fromJSON(data) {
    const track = new KeyframeTrack(data.property);
    track._keyframes = (data.keyframes ?? []).map(CaptionKeyframe.fromJSON);
    return track;
  }
}

// ─── KeyframeSet ─────────────────────────────────────────────────────────────

class KeyframeSet {
  /**
   * A collection of KeyframeTracks — one per animated property — for a single element.
   */
  constructor() {
    /** @type {Map<string, KeyframeTrack>} */
    this._tracks = new Map();
  }

  /**
   * Set a keyframe value for a property at a given time.
   *
   * @param {string} property
   * @param {number} time
   * @param {number|string} value
   * @param {string} [easing='linear']
   * @returns {CaptionKeyframe}
   */
  set(property, time, value, easing = 'linear') {
    if (!this._tracks.has(property)) {
      this._tracks.set(property, new KeyframeTrack(property));
    }
    return this._tracks.get(property).addKeyframe(time, value, easing);
  }

  /**
   * Get the interpolated value of a property at `time`.
   * @param {string} property
   * @param {number} time
   * @returns {number|string|null}
   */
  getValueAtTime(property, time) {
    return this._tracks.get(property)?.getValueAtTime(time) ?? null;
  }

  /**
   * Return all property values interpolated at a given time.
   * @param {number} time
   * @returns {object}
   */
  getAllValuesAtTime(time) {
    const result = {};
    for (const [prop, track] of this._tracks) {
      const v = track.getValueAtTime(time);
      if (v !== null) result[prop] = v;
    }
    return result;
  }

  /**
   * Remove a KeyframeTrack for a property entirely.
   * @param {string} property
   * @returns {boolean}
   */
  removeTrack(property) {
    return this._tracks.delete(property);
  }

  /** @returns {string[]} */
  getAnimatedProperties() {
    return [...this._tracks.keys()];
  }

  /** @returns {boolean} */
  isEmpty() {
    return this._tracks.size === 0;
  }

  clone() {
    return KeyframeSet.fromJSON(this.toJSON());
  }

  toJSON() {
    const tracks = {};
    for (const [prop, track] of this._tracks) {
      tracks[prop] = track.toJSON();
    }
    return { tracks };
  }

  static fromJSON(data) {
    const ks = new KeyframeSet();
    for (const [, trackData] of Object.entries(data.tracks ?? {})) {
      const track = KeyframeTrack.fromJSON(trackData);
      ks._tracks.set(track.property, track);
    }
    return ks;
  }
}

export { KeyframeTrack, KeyframeSet };
export default CaptionKeyframe;
