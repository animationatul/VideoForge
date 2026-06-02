/**
 * @module CaptionAnimation
 * Complete animation hierarchy for the Caption & Motion Typography Engine.
 *
 * All 22 animation types are defined here.  The file is organised as:
 *   1. Shared utilities (ANIMATION_TYPES, base params)
 *   2. CaptionAnimation — abstract base class
 *   3. All 22 concrete subclasses
 *   4. ANIMATION_REGISTRY — type-string → class map for fromJSON dispatch
 *
 * Every animation:
 *   • Carries a full parameter bag (duration, delay, easing, loop, repeat, reverse, stagger)
 *   • Exposes getProgressAt(localTime) — normalised [0,1] progress for a given time
 *   • Exposes apply(context) — TODO stub for renderer integration
 *   • Exposes toKeyframes(totalDuration, fps) — TODO stub for baking
 *   • Supports clone() / toJSON() / static fromJSON()
 *
 * Stagger semantics:
 *   When an animation is applied to a *group* of elements (characters, words, lines)
 *   the caller is responsible for offsetting each element's effective delay by
 *   `stagger * elementIndex`.  The StaggerAnimation wrapper handles this automatically.
 */

import IdGenerator from '../utils/IdGenerator.js';
import { computeEasing, CAPTION_EASING } from './CaptionKeyframe.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const ANIMATION_TYPES = Object.freeze({
  FADE:            'fade',
  SLIDE:           'slide',
  SCALE:           'scale',
  ROTATE:          'rotate',
  BOUNCE:          'bounce',
  POP:             'pop',
  PULSE:           'pulse',
  SHAKE:           'shake',
  WOBBLE:          'wobble',
  WAVE:            'wave',
  SWING:           'swing',
  FLIP:            'flip',
  TYPEWRITER:      'typewriter',
  KARAOKE:         'karaoke',
  REVEAL:          'reveal',
  SCRAMBLE:        'scramble',
  ELASTIC:         'elastic',
  GLITCH:          'glitch',
  HIGHLIGHT:       'highlight',
  ZOOM:            'zoom',
  BLUR_REVEAL:     'blurReveal',
  STAGGER:         'stagger',
});

export const STAGGER_ORDER = Object.freeze({
  FORWARD:  'forward',
  REVERSE:  'reverse',
  RANDOM:   'random',
  CENTER:   'center',
  EDGES:    'edges',
});

export const ANIMATION_TARGET = Object.freeze({
  CAPTION:   'caption',
  LINE:      'line',
  SEGMENT:   'segment',
  WORD:      'word',
  CHARACTER: 'character',
});

// ─── CaptionAnimation (base) ──────────────────────────────────────────────────

class CaptionAnimation {
  /**
   * @param {string} type - One of ANIMATION_TYPES.*
   * @param {object} [options={}]
   * @param {number}  [options.duration=0.5]   - Seconds.
   * @param {number}  [options.delay=0]        - Start delay in seconds.
   * @param {string}  [options.easing]         - One of CAPTION_EASING.*
   * @param {boolean} [options.loop=false]
   * @param {number}  [options.repeat=0]       - Additional repeats (0 = play once).
   * @param {boolean} [options.reverse=false]  - Play in reverse.
   * @param {number}  [options.stagger=0]      - Per-element delay increment (s).
   * @param {boolean} [options.randomize=false]- Randomise stagger order.
   * @param {string}  [options.target]         - One of ANIMATION_TARGET.*
   */
  constructor(type, options = {}) {
    if (new.target === CaptionAnimation) {
      throw new TypeError('CaptionAnimation is abstract — use a concrete subclass.');
    }

    /** @type {string} */
    this.id = IdGenerator.generate('anim');

    /** @type {string} */
    this.type = type;

    /** @type {boolean} */
    this.enabled = true;

    // ── Timing ────────────────────────────────────────────────────────────────
    this.duration   = options.duration  ?? 0.5;
    this.delay      = options.delay     ?? 0;
    this.easing     = options.easing    ?? CAPTION_EASING.EASE_OUT;
    this.loop       = options.loop      ?? false;
    this.repeat     = options.repeat    ?? 0;
    this.reverse    = options.reverse   ?? false;
    this.stagger    = options.stagger   ?? 0;
    this.randomize  = options.randomize ?? false;
    this.target     = options.target    ?? ANIMATION_TARGET.WORD;
  }

  // ─── Progress ─────────────────────────────────────────────────────────────────

  /**
   * Compute the normalised [0, 1] progress at `localTime` (seconds from animation start,
   * i.e. after the delay has been subtracted by the caller).
   *
   * @param {number} localTime - Seconds since the element's animation start (delay removed).
   * @returns {number} Eased progress in [0, 1].
   */
  getProgressAt(localTime) {
    const raw = Math.min(Math.max(localTime / this.duration, 0), 1);
    const t   = this.reverse ? 1 - raw : raw;
    return computeEasing(this.easing, t);
  }

  // ─── Renderer interface ───────────────────────────────────────────────────────

  /**
   * Apply this animation to a render context at a specific time.
   * @param {object} context - { time, localTime, progress, element, transform, style }
   * @returns {object} Modified context.
   */
  apply(context) {
    // TODO: Override in subclasses to mutate context.transform / context.style.
    return context;
  }

  /**
   * Bake this animation into an array of CaptionKeyframe objects.
   * @param {number} totalDuration  - Duration to bake (seconds).
   * @param {number} [fps=30]
   * @returns {object[]}
   */
  toKeyframes(totalDuration, fps = 30) {
    // TODO: Implement per subclass.  Sample getProgressAt() at each frame and
    //       produce one CaptionKeyframe per changed property per frame.
    return [];
  }

  // ─── Clone / serialise ────────────────────────────────────────────────────────

  clone() {
    const data = this.toJSON();
    const Cls  = ANIMATION_REGISTRY.get(data.type) ?? CaptionAnimation;
    const inst = Cls._fromData(data);
    inst.id    = IdGenerator.generate('anim');
    return inst;
  }

  toJSON() {
    return {
      id:        this.id,
      type:      this.type,
      enabled:   this.enabled,
      duration:  this.duration,
      delay:     this.delay,
      easing:    this.easing,
      loop:      this.loop,
      repeat:    this.repeat,
      reverse:   this.reverse,
      stagger:   this.stagger,
      randomize: this.randomize,
      target:    this.target,
      params:    this._serializeParams(),
    };
  }

  /** Subclasses override to include their type-specific params. @returns {object} */
  _serializeParams() { return {}; }

  /** Reconstruct from serialised data (subclasses call super then set own params). */
  static _fromData(data) {
    throw new Error('_fromData must be implemented by the concrete subclass.');
  }

  /**
   * Dispatch fromJSON to the correct subclass via ANIMATION_REGISTRY.
   * @param {object} data
   * @returns {CaptionAnimation}
   */
  static fromJSON(data) {
    const Cls = ANIMATION_REGISTRY.get(data.type);
    if (!Cls) throw new Error(`Unknown animation type: "${data.type}"`);
    return Cls._fromData(data);
  }

  /** Apply base fields from serialised data to an existing instance. */
  static _applyBase(inst, data) {
    inst.id       = data.id ?? inst.id;
    inst.enabled  = data.enabled  ?? true;
    inst.duration = data.duration ?? inst.duration;
    inst.delay    = data.delay    ?? inst.delay;
    inst.easing   = data.easing   ?? inst.easing;
    inst.loop     = data.loop     ?? inst.loop;
    inst.repeat   = data.repeat   ?? inst.repeat;
    inst.reverse  = data.reverse  ?? inst.reverse;
    inst.stagger  = data.stagger  ?? inst.stagger;
    inst.randomize= data.randomize ?? inst.randomize;
    inst.target   = data.target   ?? inst.target;
    return inst;
  }
}

// ─── 1. FadeAnimation ─────────────────────────────────────────────────────────

class FadeAnimation extends CaptionAnimation {
  /**
   * @param {object} [options={}]
   * @param {'in'|'out'|'inOut'} [options.direction='in']
   * @param {number} [options.fromOpacity=0]
   * @param {number} [options.toOpacity=1]
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.FADE, options);
    this.direction   = options.direction   ?? 'in';
    this.fromOpacity = options.fromOpacity ?? (this.direction === 'out' ? 1 : 0);
    this.toOpacity   = options.toOpacity   ?? (this.direction === 'out' ? 0 : 1);
  }

  apply(context) {
    if (!this.enabled) return context;
    const p = this.getProgressAt(context.localTime ?? 0);
    context.transform.opacity = this.fromOpacity + (this.toOpacity - this.fromOpacity) * p;
    return context;
  }

  _serializeParams() {
    return { direction: this.direction, fromOpacity: this.fromOpacity, toOpacity: this.toOpacity };
  }

  static _fromData(data) {
    const inst = new FadeAnimation({ ...data.params, easing: data.easing });
    return CaptionAnimation._applyBase(inst, data);
  }
}

// ─── 2. SlideAnimation ────────────────────────────────────────────────────────

class SlideAnimation extends CaptionAnimation {
  /**
   * @param {object} [options={}]
   * @param {'up'|'down'|'left'|'right'} [options.direction='up']
   * @param {number} [options.distance=40]  - px offset to slide from/to
   * @param {boolean}[options.fade=true]    - also fade in/out during slide
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.SLIDE, options);
    this.direction = options.direction ?? 'up';
    this.distance  = options.distance  ?? 40;
    this.fade      = options.fade      ?? true;
  }

  apply(context) {
    if (!this.enabled) return context;
    const p = this.getProgressAt(context.localTime ?? 0);
    const inv = this.reverse ? p : (1 - p);
    const d = this.distance * inv;
    switch (this.direction) {
      case 'up':    context.transform.y -= d; break;
      case 'down':  context.transform.y += d; break;
      case 'left':  context.transform.x -= d; break;
      case 'right': context.transform.x += d; break;
    }
    if (this.fade) context.transform.opacity = p;
    return context;
  }

  _serializeParams() {
    return { direction: this.direction, distance: this.distance, fade: this.fade };
  }

  static _fromData(data) {
    return CaptionAnimation._applyBase(new SlideAnimation({ ...data.params, easing: data.easing }), data);
  }
}

// ─── 3. ScaleAnimation ────────────────────────────────────────────────────────

class ScaleAnimation extends CaptionAnimation {
  /**
   * @param {object} [options={}]
   * @param {number} [options.fromScale=0]
   * @param {number} [options.toScale=1]
   * @param {number} [options.fromScaleX] - Override for non-uniform X
   * @param {number} [options.fromScaleY] - Override for non-uniform Y
   * @param {number} [options.toScaleX]
   * @param {number} [options.toScaleY]
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.SCALE, options);
    this.fromScale  = options.fromScale  ?? 0;
    this.toScale    = options.toScale    ?? 1;
    this.fromScaleX = options.fromScaleX ?? this.fromScale;
    this.fromScaleY = options.fromScaleY ?? this.fromScale;
    this.toScaleX   = options.toScaleX   ?? this.toScale;
    this.toScaleY   = options.toScaleY   ?? this.toScale;
  }

  apply(context) {
    if (!this.enabled) return context;
    const p = this.getProgressAt(context.localTime ?? 0);
    context.transform.scaleX = this.fromScaleX + (this.toScaleX - this.fromScaleX) * p;
    context.transform.scaleY = this.fromScaleY + (this.toScaleY - this.fromScaleY) * p;
    return context;
  }

  _serializeParams() {
    return { fromScale: this.fromScale, toScale: this.toScale,
             fromScaleX: this.fromScaleX, fromScaleY: this.fromScaleY,
             toScaleX: this.toScaleX, toScaleY: this.toScaleY };
  }

  static _fromData(data) {
    return CaptionAnimation._applyBase(new ScaleAnimation({ ...data.params, easing: data.easing }), data);
  }
}

// ─── 4. RotateAnimation ───────────────────────────────────────────────────────

class RotateAnimation extends CaptionAnimation {
  /**
   * @param {object} [options={}]
   * @param {number} [options.fromDegrees=-90]
   * @param {number} [options.toDegrees=0]
   * @param {{x:number,y:number}} [options.pivot={x:0.5,y:0.5}] - Normalised pivot point
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.ROTATE, options);
    this.fromDegrees = options.fromDegrees ?? -90;
    this.toDegrees   = options.toDegrees   ?? 0;
    this.pivot       = options.pivot       ?? { x: 0.5, y: 0.5 };
  }

  apply(context) {
    if (!this.enabled) return context;
    const p = this.getProgressAt(context.localTime ?? 0);
    context.transform.rotation = this.fromDegrees + (this.toDegrees - this.fromDegrees) * p;
    return context;
  }

  _serializeParams() {
    return { fromDegrees: this.fromDegrees, toDegrees: this.toDegrees, pivot: this.pivot };
  }

  static _fromData(data) {
    return CaptionAnimation._applyBase(new RotateAnimation({ ...data.params, easing: data.easing }), data);
  }
}

// ─── 5. BounceAnimation ───────────────────────────────────────────────────────

class BounceAnimation extends CaptionAnimation {
  /**
   * @param {object} [options={}]
   * @param {number} [options.height=30]    - Peak bounce height (px)
   * @param {number} [options.bounces=3]
   * @param {number} [options.decay=0.5]   - Energy retained per bounce (0–1)
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.BOUNCE, { ...options, easing: CAPTION_EASING.LINEAR });
    this.height  = options.height  ?? 30;
    this.bounces = options.bounces ?? 3;
    this.decay   = options.decay   ?? 0.5;
  }

  apply(context) {
    if (!this.enabled) return context;
    const t = Math.min(Math.max((context.localTime ?? 0) / this.duration, 0), 1);
    // Simulate N bounces with decaying amplitude.
    const totalBounces = this.bounces;
    const segment = 1 / totalBounces;
    const segIdx  = Math.floor(t / segment);
    const segT    = (t % segment) / segment;
    const amplitude = this.height * Math.pow(this.decay, segIdx);
    context.transform.y -= amplitude * Math.sin(Math.PI * segT);
    return context;
  }

  _serializeParams() {
    return { height: this.height, bounces: this.bounces, decay: this.decay };
  }

  static _fromData(data) {
    return CaptionAnimation._applyBase(new BounceAnimation(data.params), data);
  }
}

// ─── 6. PopAnimation ─────────────────────────────────────────────────────────

class PopAnimation extends CaptionAnimation {
  /**
   * Scale from 0 → overshoot → settle at 1.
   * @param {object} [options={}]
   * @param {number} [options.overshoot=1.3]
   * @param {boolean}[options.fade=true]
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.POP, { ...options, easing: CAPTION_EASING.EASE_OUT_BACK });
    this.overshoot = options.overshoot ?? 1.3;
    this.fade      = options.fade      ?? true;
  }

  apply(context) {
    if (!this.enabled) return context;
    const p = this.getProgressAt(context.localTime ?? 0);
    // Custom spring-like curve: 0 → overshoot → 1
    const scale = p < 0.7
      ? (this.overshoot * p / 0.7)
      : this.overshoot - (this.overshoot - 1) * ((p - 0.7) / 0.3);
    context.transform.scaleX = scale;
    context.transform.scaleY = scale;
    if (this.fade) context.transform.opacity = p;
    return context;
  }

  _serializeParams() {
    return { overshoot: this.overshoot, fade: this.fade };
  }

  static _fromData(data) {
    return CaptionAnimation._applyBase(new PopAnimation({ ...data.params, easing: data.easing }), data);
  }
}

// ─── 7. PulseAnimation ────────────────────────────────────────────────────────

class PulseAnimation extends CaptionAnimation {
  /**
   * Rhythmic scale oscillation.
   * @param {object} [options={}]
   * @param {number} [options.scale=1.1]   - Peak scale
   * @param {number} [options.speed=1]     - Pulses per second
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.PULSE, { ...options, loop: options.loop ?? true });
    this.scale = options.scale ?? 1.1;
    this.speed = options.speed ?? 1;
  }

  apply(context) {
    if (!this.enabled) return context;
    const t = (context.localTime ?? 0) * this.speed;
    const s = 1 + (this.scale - 1) * (0.5 + 0.5 * Math.sin(2 * Math.PI * t));
    context.transform.scaleX = s;
    context.transform.scaleY = s;
    return context;
  }

  _serializeParams() { return { scale: this.scale, speed: this.speed }; }
  static _fromData(data) {
    return CaptionAnimation._applyBase(new PulseAnimation({ ...data.params, easing: data.easing, loop: data.loop }), data);
  }
}

// ─── 8. ShakeAnimation ────────────────────────────────────────────────────────

class ShakeAnimation extends CaptionAnimation {
  /**
   * @param {object} [options={}]
   * @param {number} [options.intensity=10]   - px
   * @param {number} [options.speed=10]       - shakes/second
   * @param {'x'|'y'|'both'} [options.axes='x']
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.SHAKE, { ...options, easing: CAPTION_EASING.LINEAR });
    this.intensity = options.intensity ?? 10;
    this.speed     = options.speed     ?? 10;
    this.axes      = options.axes      ?? 'x';
  }

  apply(context) {
    if (!this.enabled) return context;
    const t = (context.localTime ?? 0) * this.speed;
    const decay = 1 - Math.min((context.localTime ?? 0) / this.duration, 1);
    const d = this.intensity * decay * Math.sin(2 * Math.PI * t);
    if (this.axes !== 'y') context.transform.x += d;
    if (this.axes !== 'x') context.transform.y += d;
    return context;
  }

  _serializeParams() { return { intensity: this.intensity, speed: this.speed, axes: this.axes }; }
  static _fromData(data) {
    return CaptionAnimation._applyBase(new ShakeAnimation(data.params), data);
  }
}

// ─── 9. WobbleAnimation ───────────────────────────────────────────────────────

class WobbleAnimation extends CaptionAnimation {
  /**
   * @param {object} [options={}]
   * @param {number} [options.rotation=15]  - peak rotation degrees
   * @param {number} [options.scale=0.05]   - peak scale deviation
   * @param {number} [options.speed=4]
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.WOBBLE, { ...options, easing: CAPTION_EASING.LINEAR });
    this.rotation = options.rotation ?? 15;
    this.scale    = options.scale    ?? 0.05;
    this.speed    = options.speed    ?? 4;
  }

  apply(context) {
    if (!this.enabled) return context;
    const t = (context.localTime ?? 0) * this.speed;
    const decay = 1 - Math.min((context.localTime ?? 0) / this.duration, 1);
    context.transform.rotation += this.rotation * decay * Math.sin(2 * Math.PI * t);
    const s = 1 + this.scale * decay * Math.cos(2 * Math.PI * t);
    context.transform.scaleX *= s;
    context.transform.scaleY *= s;
    return context;
  }

  _serializeParams() { return { rotation: this.rotation, scale: this.scale, speed: this.speed }; }
  static _fromData(data) {
    return CaptionAnimation._applyBase(new WobbleAnimation(data.params), data);
  }
}

// ─── 10. WaveAnimation ────────────────────────────────────────────────────────

class WaveAnimation extends CaptionAnimation {
  /**
   * Sinusoidal vertical displacement — best applied per-character with stagger.
   * @param {object} [options={}]
   * @param {number} [options.amplitude=10]  - px
   * @param {number} [options.frequency=1]
   * @param {number} [options.phase=0]       - Additional phase offset (radians)
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.WAVE, { ...options, loop: options.loop ?? true });
    this.amplitude = options.amplitude ?? 10;
    this.frequency = options.frequency ?? 1;
    this.phase     = options.phase     ?? 0;
  }

  apply(context) {
    if (!this.enabled) return context;
    const t = (context.localTime ?? 0);
    const elementPhase = (context.elementIndex ?? 0) * Math.PI * 0.3;
    context.transform.y += this.amplitude * Math.sin(2 * Math.PI * this.frequency * t + this.phase + elementPhase);
    return context;
  }

  _serializeParams() { return { amplitude: this.amplitude, frequency: this.frequency, phase: this.phase }; }
  static _fromData(data) {
    return CaptionAnimation._applyBase(new WaveAnimation({ ...data.params, loop: data.loop }), data);
  }
}

// ─── 11. SwingAnimation ───────────────────────────────────────────────────────

class SwingAnimation extends CaptionAnimation {
  /**
   * Pendulum-like swing from a top pivot point.
   * @param {object} [options={}]
   * @param {number} [options.angle=30]   - peak swing angle in degrees
   * @param {{x:number,y:number}} [options.pivot={x:0.5,y:0}]
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.SWING, options);
    this.angle = options.angle ?? 30;
    this.pivot = options.pivot ?? { x: 0.5, y: 0 };
  }

  apply(context) {
    if (!this.enabled) return context;
    const t = Math.min((context.localTime ?? 0) / this.duration, 1);
    const decay = Math.pow(1 - t, 1.5);
    context.transform.rotation += this.angle * decay * Math.sin(6 * Math.PI * t);
    return context;
  }

  _serializeParams() { return { angle: this.angle, pivot: this.pivot }; }
  static _fromData(data) {
    return CaptionAnimation._applyBase(new SwingAnimation({ ...data.params, easing: data.easing }), data);
  }
}

// ─── 12. FlipAnimation ────────────────────────────────────────────────────────

class FlipAnimation extends CaptionAnimation {
  /**
   * @param {object} [options={}]
   * @param {'x'|'y'} [options.axis='x']
   * @param {number} [options.fromDegrees=0]
   * @param {number} [options.toDegrees=180]
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.FLIP, options);
    this.axis        = options.axis        ?? 'x';
    this.fromDegrees = options.fromDegrees ?? 0;
    this.toDegrees   = options.toDegrees   ?? 180;
  }

  apply(context) {
    if (!this.enabled) return context;
    const p = this.getProgressAt(context.localTime ?? 0);
    const deg = this.fromDegrees + (this.toDegrees - this.fromDegrees) * p;
    const scale = Math.cos((deg * Math.PI) / 180);
    if (this.axis === 'x') context.transform.scaleX = scale;
    else context.transform.scaleY = scale;
    return context;
  }

  _serializeParams() { return { axis: this.axis, fromDegrees: this.fromDegrees, toDegrees: this.toDegrees }; }
  static _fromData(data) {
    return CaptionAnimation._applyBase(new FlipAnimation({ ...data.params, easing: data.easing }), data);
  }
}

// ─── 13. TypewriterAnimation ──────────────────────────────────────────────────

class TypewriterAnimation extends CaptionAnimation {
  /**
   * Characters appear sequentially, left to right.
   * @param {object} [options={}]
   * @param {'character'|'word'} [options.revealMode='character']
   * @param {boolean} [options.showCursor=true]
   * @param {string}  [options.cursorChar='|']
   * @param {boolean} [options.cursorBlink=true]
   * @param {number}  [options.cursorBlinkRate=0.5]  - seconds
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.TYPEWRITER, { ...options, easing: CAPTION_EASING.LINEAR });
    this.revealMode      = options.revealMode      ?? 'character';
    this.showCursor      = options.showCursor      ?? true;
    this.cursorChar      = options.cursorChar      ?? '|';
    this.cursorBlink     = options.cursorBlink     ?? true;
    this.cursorBlinkRate = options.cursorBlinkRate ?? 0.5;
  }

  /**
   * Determine how many characters are visible at a given time.
   * @param {number} localTime
   * @param {number} totalChars
   * @returns {number}
   */
  getVisibleCharCount(localTime, totalChars) {
    const p = Math.min(Math.max(localTime / this.duration, 0), 1);
    return Math.floor(p * totalChars);
  }

  apply(context) {
    // TODO: Integrate with renderer's character-visibility mask.
    return context;
  }

  _serializeParams() {
    return { revealMode: this.revealMode, showCursor: this.showCursor,
             cursorChar: this.cursorChar, cursorBlink: this.cursorBlink,
             cursorBlinkRate: this.cursorBlinkRate };
  }

  static _fromData(data) {
    return CaptionAnimation._applyBase(new TypewriterAnimation(data.params), data);
  }
}

// ─── 14. KaraokeAnimation ────────────────────────────────────────────────────

class KaraokeAnimation extends CaptionAnimation {
  /**
   * Progressive left-to-right colour fill synced to word timing.
   * @param {object} [options={}]
   * @param {string}  [options.fillColor='#FFD700']
   * @param {'leftToRight'|'word'|'character'|'center'} [options.fillStyle='leftToRight']
   * @param {boolean} [options.highlightBar=false]
   * @param {string}  [options.barColor='rgba(255,215,0,0.3)']
   * @param {number}  [options.barHeight=6]
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.KARAOKE, { ...options, easing: CAPTION_EASING.LINEAR });
    this.fillColor      = options.fillColor    ?? '#FFD700';
    this.fillStyle      = options.fillStyle    ?? 'leftToRight';
    this.highlightBar   = options.highlightBar ?? false;
    this.barColor       = options.barColor     ?? 'rgba(255,215,0,0.3)';
    this.barHeight      = options.barHeight    ?? 6;
  }

  /**
   * Compute the fill progress (0–1) for a word at a given absolute time.
   * @param {{ start: number, end: number }} wordTiming
   * @param {number} time - Absolute project time in seconds.
   * @returns {number}
   */
  getWordFillAt(wordTiming, time) {
    if (time < wordTiming.start) return 0;
    if (time >= wordTiming.end)  return 1;
    return (time - wordTiming.start) / (wordTiming.end - wordTiming.start);
  }

  apply(context) {
    // TODO: Renderer clips the fill colour using a horizontal mask computed from getWordFillAt.
    return context;
  }

  _serializeParams() {
    return { fillColor: this.fillColor, fillStyle: this.fillStyle,
             highlightBar: this.highlightBar, barColor: this.barColor, barHeight: this.barHeight };
  }

  static _fromData(data) {
    return CaptionAnimation._applyBase(new KaraokeAnimation(data.params), data);
  }
}

// ─── 15. RevealAnimation ─────────────────────────────────────────────────────

class RevealAnimation extends CaptionAnimation {
  /**
   * Clip/mask reveal from an edge.
   * @param {object} [options={}]
   * @param {'up'|'down'|'left'|'right'} [options.direction='up']
   * @param {'mask'|'slide'} [options.clipMode='mask']
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.REVEAL, options);
    this.direction = options.direction ?? 'up';
    this.clipMode  = options.clipMode  ?? 'mask';
  }

  apply(context) {
    // TODO: Apply clip-rect / mask that progressively reveals the element.
    return context;
  }

  _serializeParams() { return { direction: this.direction, clipMode: this.clipMode }; }
  static _fromData(data) {
    return CaptionAnimation._applyBase(new RevealAnimation({ ...data.params, easing: data.easing }), data);
  }
}

// ─── 16. ScrambleAnimation ───────────────────────────────────────────────────

class ScrambleAnimation extends CaptionAnimation {
  /**
   * Characters cycle through random glyphs before resolving to the real value.
   * @param {object} [options={}]
   * @param {string}  [options.chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%']
   * @param {number}  [options.iterations=8]  - random glyphs to show before settling
   * @param {number}  [options.revealDelay=0] - stagger in seconds per character
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.SCRAMBLE, { ...options, easing: CAPTION_EASING.LINEAR });
    this.chars       = options.chars       ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    this.iterations  = options.iterations  ?? 8;
    this.revealDelay = options.revealDelay ?? 0;
  }

  /**
   * Get the display character at `localTime` for a character at `charIndex`.
   * @param {number} localTime
   * @param {string} realChar
   * @param {number} charIndex
   * @returns {string}
   */
  getCharAt(localTime, realChar, charIndex) {
    // TODO: Implement scramble timing logic.
    //       Each character has a window of (iterations / fps) before it settles.
    return realChar;
  }

  apply(context) {
    // TODO: Replace displayed characters with scrambled versions via context.charOverride.
    return context;
  }

  _serializeParams() { return { chars: this.chars, iterations: this.iterations, revealDelay: this.revealDelay }; }
  static _fromData(data) {
    return CaptionAnimation._applyBase(new ScrambleAnimation(data.params), data);
  }
}

// ─── 17. ElasticAnimation ────────────────────────────────────────────────────

class ElasticAnimation extends CaptionAnimation {
  /**
   * Elastic spring with configurable overshoot.
   * @param {object} [options={}]
   * @param {number} [options.amplitude=1.5]
   * @param {number} [options.period=0.3]
   * @param {'in'|'out'|'inOut'} [options.mode='out']
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.ELASTIC, { ...options, easing: CAPTION_EASING.LINEAR });
    this.amplitude = options.amplitude ?? 1.5;
    this.period    = options.period    ?? 0.3;
    this.mode      = options.mode      ?? 'out';
  }

  apply(context) {
    if (!this.enabled) return context;
    const t = Math.min(Math.max((context.localTime ?? 0) / this.duration, 0), 1);
    const eased = computeEasing(
      this.mode === 'in' ? CAPTION_EASING.EASE_IN_ELASTIC :
      this.mode === 'out' ? CAPTION_EASING.EASE_OUT_ELASTIC : CAPTION_EASING.EASE_IN_OUT,
      t,
    );
    context.transform.scaleX = eased;
    context.transform.scaleY = eased;
    context.transform.opacity = t;
    return context;
  }

  _serializeParams() { return { amplitude: this.amplitude, period: this.period, mode: this.mode }; }
  static _fromData(data) {
    return CaptionAnimation._applyBase(new ElasticAnimation(data.params), data);
  }
}

// ─── 18. GlitchAnimation ─────────────────────────────────────────────────────

class GlitchAnimation extends CaptionAnimation {
  /**
   * @param {object} [options={}]
   * @param {number}  [options.intensity=5]   - pixel displacement
   * @param {boolean} [options.colorShift=true]
   * @param {number}  [options.speed=10]      - glitch events/second
   * @param {number}  [options.randomSeed=42]
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.GLITCH, { ...options, easing: CAPTION_EASING.LINEAR });
    this.intensity   = options.intensity   ?? 5;
    this.colorShift  = options.colorShift  ?? true;
    this.speed       = options.speed       ?? 10;
    this.randomSeed  = options.randomSeed  ?? 42;
  }

  apply(context) {
    if (!this.enabled) return context;
    // TODO: Apply pseudo-random displacement and chromatic aberration via context.glitch.
    //       Use deterministic RNG seeded by randomSeed + floor(localTime * speed).
    return context;
  }

  _serializeParams() {
    return { intensity: this.intensity, colorShift: this.colorShift, speed: this.speed, randomSeed: this.randomSeed };
  }

  static _fromData(data) {
    return CaptionAnimation._applyBase(new GlitchAnimation(data.params), data);
  }
}

// ─── 19. HighlightAnimation ───────────────────────────────────────────────────

class HighlightAnimation extends CaptionAnimation {
  /**
   * Animated background colour sweep behind words.
   * @param {object} [options={}]
   * @param {string} [options.color='#FFD700']
   * @param {'left'|'right'|'center'|'radial'} [options.direction='left']
   * @param {number} [options.opacity=0.7]
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.HIGHLIGHT, options);
    this.color     = options.color     ?? '#FFD700';
    this.direction = options.direction ?? 'left';
    this.opacity   = options.opacity   ?? 0.7;
  }

  apply(context) {
    if (!this.enabled) return context;
    const p = this.getProgressAt(context.localTime ?? 0);
    context.highlightProgress = p;
    context.highlightColor    = this.color;
    context.highlightOpacity  = this.opacity * p;
    return context;
  }

  _serializeParams() { return { color: this.color, direction: this.direction, opacity: this.opacity }; }
  static _fromData(data) {
    return CaptionAnimation._applyBase(new HighlightAnimation({ ...data.params, easing: data.easing }), data);
  }
}

// ─── 20. ZoomAnimation ────────────────────────────────────────────────────────

class ZoomAnimation extends CaptionAnimation {
  /**
   * @param {object} [options={}]
   * @param {'in'|'out'} [options.mode='in']
   * @param {number} [options.fromScale=2]
   * @param {number} [options.toScale=1]
   * @param {boolean}[options.fade=true]
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.ZOOM, options);
    this.mode      = options.mode      ?? 'in';
    this.fromScale = options.fromScale ?? (this.mode === 'in' ? 2 : 1);
    this.toScale   = options.toScale   ?? (this.mode === 'in' ? 1 : 0);
    this.fade      = options.fade      ?? true;
  }

  apply(context) {
    if (!this.enabled) return context;
    const p = this.getProgressAt(context.localTime ?? 0);
    const s = this.fromScale + (this.toScale - this.fromScale) * p;
    context.transform.scaleX = s;
    context.transform.scaleY = s;
    if (this.fade) context.transform.opacity = this.mode === 'in' ? p : (1 - p);
    return context;
  }

  _serializeParams() { return { mode: this.mode, fromScale: this.fromScale, toScale: this.toScale, fade: this.fade }; }
  static _fromData(data) {
    return CaptionAnimation._applyBase(new ZoomAnimation({ ...data.params, easing: data.easing }), data);
  }
}

// ─── 21. BlurRevealAnimation ─────────────────────────────────────────────────

class BlurRevealAnimation extends CaptionAnimation {
  /**
   * Elements blur into focus (or out of focus).
   * @param {object} [options={}]
   * @param {number} [options.fromBlur=20]
   * @param {number} [options.toBlur=0]
   * @param {boolean}[options.withFade=true]
   */
  constructor(options = {}) {
    super(ANIMATION_TYPES.BLUR_REVEAL, options);
    this.fromBlur  = options.fromBlur  ?? 20;
    this.toBlur    = options.toBlur    ?? 0;
    this.withFade  = options.withFade  ?? true;
  }

  apply(context) {
    if (!this.enabled) return context;
    const p = this.getProgressAt(context.localTime ?? 0);
    context.transform.blur = this.fromBlur + (this.toBlur - this.fromBlur) * p;
    if (this.withFade) context.transform.opacity = p;
    return context;
  }

  _serializeParams() { return { fromBlur: this.fromBlur, toBlur: this.toBlur, withFade: this.withFade }; }
  static _fromData(data) {
    return CaptionAnimation._applyBase(new BlurRevealAnimation({ ...data.params, easing: data.easing }), data);
  }
}

// ─── 22. StaggerAnimation ────────────────────────────────────────────────────

class StaggerAnimation extends CaptionAnimation {
  /**
   * Meta-animation: applies a wrapped animation to a group of elements
   * with incremental delay per element.
   *
   * @param {CaptionAnimation} innerAnimation - The animation to stagger.
   * @param {object} [options={}]
   * @param {number} [options.stagger=0.05]   - Seconds between each element.
   * @param {string} [options.order]          - One of STAGGER_ORDER.*
   * @param {string} [options.target]         - One of ANIMATION_TARGET.*
   */
  constructor(innerAnimation, options = {}) {
    super(ANIMATION_TYPES.STAGGER, {
      ...options,
      duration: innerAnimation.duration,
      easing:   innerAnimation.easing,
      stagger:  options.stagger ?? 0.05,
      target:   options.target  ?? ANIMATION_TARGET.CHARACTER,
    });

    /** @type {CaptionAnimation} */
    this.innerAnimation = innerAnimation;

    /** @type {string} */
    this.order = options.order ?? STAGGER_ORDER.FORWARD;
  }

  /**
   * Compute the effective delay for element at `index` given `totalCount` elements.
   * @param {number} index
   * @param {number} totalCount
   * @returns {number} Delay in seconds.
   */
  getDelayForIndex(index, totalCount) {
    let effectiveIndex = index;
    switch (this.order) {
      case STAGGER_ORDER.REVERSE:
        effectiveIndex = totalCount - 1 - index;
        break;
      case STAGGER_ORDER.RANDOM:
        // Deterministic shuffle using the index as a seed.
        effectiveIndex = (index * 7 + 3) % totalCount;
        break;
      case STAGGER_ORDER.CENTER: {
        const mid = (totalCount - 1) / 2;
        effectiveIndex = Math.abs(index - mid);
        break;
      }
      case STAGGER_ORDER.EDGES: {
        const mid = (totalCount - 1) / 2;
        effectiveIndex = mid - Math.abs(index - mid);
        break;
      }
    }
    return this.delay + this.stagger * effectiveIndex;
  }

  apply(context) {
    if (!this.enabled) return context;
    const elemDelay = this.getDelayForIndex(context.elementIndex ?? 0, context.totalElements ?? 1);
    const adjustedLocal = Math.max((context.localTime ?? 0) - elemDelay, 0);
    return this.innerAnimation.apply({ ...context, localTime: adjustedLocal });
  }

  _serializeParams() {
    return { order: this.order, innerAnimation: this.innerAnimation.toJSON() };
  }

  static _fromData(data) {
    const inner = CaptionAnimation.fromJSON(data.params.innerAnimation);
    const inst  = new StaggerAnimation(inner, {
      stagger: data.stagger,
      order:   data.params.order,
      target:  data.target,
    });
    return CaptionAnimation._applyBase(inst, data);
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const ANIMATION_REGISTRY = new Map([
  [ANIMATION_TYPES.FADE,         FadeAnimation],
  [ANIMATION_TYPES.SLIDE,        SlideAnimation],
  [ANIMATION_TYPES.SCALE,        ScaleAnimation],
  [ANIMATION_TYPES.ROTATE,       RotateAnimation],
  [ANIMATION_TYPES.BOUNCE,       BounceAnimation],
  [ANIMATION_TYPES.POP,          PopAnimation],
  [ANIMATION_TYPES.PULSE,        PulseAnimation],
  [ANIMATION_TYPES.SHAKE,        ShakeAnimation],
  [ANIMATION_TYPES.WOBBLE,       WobbleAnimation],
  [ANIMATION_TYPES.WAVE,         WaveAnimation],
  [ANIMATION_TYPES.SWING,        SwingAnimation],
  [ANIMATION_TYPES.FLIP,         FlipAnimation],
  [ANIMATION_TYPES.TYPEWRITER,   TypewriterAnimation],
  [ANIMATION_TYPES.KARAOKE,      KaraokeAnimation],
  [ANIMATION_TYPES.REVEAL,       RevealAnimation],
  [ANIMATION_TYPES.SCRAMBLE,     ScrambleAnimation],
  [ANIMATION_TYPES.ELASTIC,      ElasticAnimation],
  [ANIMATION_TYPES.GLITCH,       GlitchAnimation],
  [ANIMATION_TYPES.HIGHLIGHT,    HighlightAnimation],
  [ANIMATION_TYPES.ZOOM,         ZoomAnimation],
  [ANIMATION_TYPES.BLUR_REVEAL,  BlurRevealAnimation],
  [ANIMATION_TYPES.STAGGER,      StaggerAnimation],
]);

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  FadeAnimation, SlideAnimation, ScaleAnimation, RotateAnimation,
  BounceAnimation, PopAnimation, PulseAnimation, ShakeAnimation,
  WobbleAnimation, WaveAnimation, SwingAnimation, FlipAnimation,
  TypewriterAnimation, KaraokeAnimation, RevealAnimation, ScrambleAnimation,
  ElasticAnimation, GlitchAnimation, HighlightAnimation, ZoomAnimation,
  BlurRevealAnimation, StaggerAnimation,
};

export default CaptionAnimation;
