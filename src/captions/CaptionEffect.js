/**
 * @module CaptionEffect
 * Complete visual effect hierarchy for the Caption & Motion Typography Engine.
 *
 * All 19 effect types are defined here.  File organisation:
 *   1. EFFECT_TYPES constant
 *   2. CaptionEffect — abstract base class
 *   3. 19 concrete subclasses
 *   4. EFFECT_REGISTRY — type-string → class map for fromJSON dispatch
 */

import IdGenerator from '../utils/IdGenerator.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const EFFECT_TYPES = Object.freeze({
  GLOW:                 'glow',
  SHADOW:               'shadow',
  OUTLINE:              'outline',
  GRADIENT:             'gradient',
  NEON:                 'neon',
  GLASS:                'glass',
  BLUR:                 'blur',
  MOTION_BLUR:          'motionBlur',
  BACKGROUND_BOX:       'backgroundBox',
  ROUNDED_BOX:          'roundedBox',
  HIGHLIGHT:            'highlight',
  UNDERLINE:            'underline',
  STRIKETHROUGH:        'strikethrough',
  NOISE:                'noise',
  GRAIN:                'grain',
  CHROMATIC_ABERRATION: 'chromaticAberration',
  BLOOM:                'bloom',
  DISTORTION:           'distortion',
  REFLECTION:           'reflection',
});

// ─── CaptionEffect (base) ────────────────────────────────────────────────────

class CaptionEffect {
  /**
   * @param {string} type - One of EFFECT_TYPES.*
   * @param {object} [params={}]
   */
  constructor(type, params = {}) {
    if (new.target === CaptionEffect) {
      throw new TypeError('CaptionEffect is abstract — use a concrete subclass.');
    }

    /** @type {string} */
    this.id = IdGenerator.generate('cefx');

    /** @type {string} */
    this.type = type;

    /** @type {boolean} */
    this.enabled = params.enabled ?? true;

    /** @type {number} 0–1 master opacity/strength multiplier. */
    this.strength = params.strength ?? 1;

    /** @type {object} Type-specific parameters. */
    this.params = {};
  }

  // ─── Renderer interface ───────────────────────────────────────────────────────

  /**
   * Apply this effect within a render context.
   * @param {object} context - Renderer-supplied composite context.
   * @returns {object} Modified context.
   */
  apply(context) {
    // TODO: Override in subclasses.
    return context;
  }

  enable()  { this.enabled = true;  return this; }
  disable() { this.enabled = false; return this; }

  // ─── Clone / serialise ────────────────────────────────────────────────────────

  clone() {
    const data = this.toJSON();
    const Cls  = EFFECT_REGISTRY.get(data.type) ?? CaptionEffect;
    const inst = Cls._fromData(data);
    inst.id    = IdGenerator.generate('cefx');
    return inst;
  }

  toJSON() {
    return {
      id:       this.id,
      type:     this.type,
      enabled:  this.enabled,
      strength: this.strength,
      params:   { ...this.params },
    };
  }

  static fromJSON(data) {
    const Cls = EFFECT_REGISTRY.get(data.type);
    if (!Cls) throw new Error(`Unknown caption effect type: "${data.type}"`);
    return Cls._fromData(data);
  }

  static _applyBase(inst, data) {
    inst.id       = data.id ?? inst.id;
    inst.enabled  = data.enabled  ?? true;
    inst.strength = data.strength ?? 1;
    return inst;
  }

  static _fromData(_data) {
    throw new Error('_fromData must be implemented by each subclass.');
  }
}

// ─── 1. GlowEffect ───────────────────────────────────────────────────────────

class GlowEffect extends CaptionEffect {
  /**
   * @param {object} [options={}]
   * @param {string} [options.color='#FFFFFF']
   * @param {number} [options.blur=20]
   * @param {number} [options.layers=3]       - Stacked blur passes
   * @param {number} [options.spread=1]       - Scale factor per layer
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.GLOW, options);
    this.params = {
      color:  options.color  ?? '#FFFFFF',
      blur:   options.blur   ?? 20,
      layers: options.layers ?? 3,
      spread: options.spread ?? 1,
    };
  }

  apply(context) {
    // TODO: Renderer adds N stacked blurred copies of the element behind it.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new GlowEffect(data.params), data);
  }
}

// ─── 2. ShadowEffect ─────────────────────────────────────────────────────────

class ShadowEffect extends CaptionEffect {
  /**
   * @param {object} [options={}]
   * @param {string} [options.color='rgba(0,0,0,0.8)']
   * @param {number} [options.offsetX=3]
   * @param {number} [options.offsetY=3]
   * @param {number} [options.blur=6]
   * @param {number} [options.spread=0]
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.SHADOW, options);
    this.params = {
      color:   options.color   ?? 'rgba(0,0,0,0.8)',
      offsetX: options.offsetX ?? 3,
      offsetY: options.offsetY ?? 3,
      blur:    options.blur    ?? 6,
      spread:  options.spread  ?? 0,
    };
  }

  apply(context) {
    // TODO: Renderer sets ctx.shadowColor, ctx.shadowOffsetX/Y, ctx.shadowBlur.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new ShadowEffect(data.params), data);
  }
}

// ─── 3. OutlineEffect ────────────────────────────────────────────────────────

class OutlineEffect extends CaptionEffect {
  /**
   * @param {object} [options={}]
   * @param {string} [options.color='#000000']
   * @param {number} [options.width=3]
   * @param {'miter'|'round'|'bevel'} [options.join='round']
   * @param {boolean}[options.inner=false]    - Draw outline inside the glyph
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.OUTLINE, options);
    this.params = {
      color: options.color ?? '#000000',
      width: options.width ?? 3,
      join:  options.join  ?? 'round',
      inner: options.inner ?? false,
    };
  }

  apply(context) {
    // TODO: Renderer strokes the text path before filling.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new OutlineEffect(data.params), data);
  }
}

// ─── 4. GradientEffect ───────────────────────────────────────────────────────

class GradientEffect extends CaptionEffect {
  /**
   * @param {object} [options={}]
   * @param {'linear'|'radial'|'conic'} [options.type='linear']
   * @param {number} [options.angle=90]                - Degrees (linear)
   * @param {Array<{color:string,position:number}>} [options.stops]
   * @param {boolean}[options.applyToFill=true]
   * @param {boolean}[options.applyToStroke=false]
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.GRADIENT, options);
    this.params = {
      type:          options.type          ?? 'linear',
      angle:         options.angle         ?? 90,
      stops:         options.stops         ?? [
        { color: '#FFD700', position: 0 },
        { color: '#FF6B00', position: 1 },
      ],
      applyToFill:   options.applyToFill   ?? true,
      applyToStroke: options.applyToStroke ?? false,
    };
  }

  apply(context) {
    // TODO: Create CanvasGradient from params and use as fillStyle / strokeStyle.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new GradientEffect(data.params), data);
  }
}

// ─── 5. NeonEffect ───────────────────────────────────────────────────────────

class NeonEffect extends CaptionEffect {
  /**
   * Layered glow that simulates a neon sign.
   * @param {object} [options={}]
   * @param {string} [options.color='#0FF']        - Tube colour
   * @param {string} [options.glowColor='#0FF']
   * @param {number} [options.intensity=1.5]
   * @param {boolean}[options.flicker=false]
   * @param {number} [options.flickerSpeed=0.1]
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.NEON, options);
    this.params = {
      color:        options.color        ?? '#00FFFF',
      glowColor:    options.glowColor    ?? '#00FFFF',
      intensity:    options.intensity    ?? 1.5,
      flicker:      options.flicker      ?? false,
      flickerSpeed: options.flickerSpeed ?? 0.1,
    };
  }

  apply(context) {
    // TODO: Multi-layer glow (inner thin + outer diffuse) + optional flicker via context.time.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new NeonEffect(data.params), data);
  }
}

// ─── 6. GlassEffect ──────────────────────────────────────────────────────────

class GlassEffect extends CaptionEffect {
  /**
   * Frosted glass background behind text.
   * @param {object} [options={}]
   * @param {number} [options.backgroundBlur=10]
   * @param {string} [options.tint='rgba(255,255,255,0.1)']
   * @param {string} [options.border='rgba(255,255,255,0.3)']
   * @param {number} [options.borderWidth=1]
   * @param {number} [options.borderRadius=8]
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.GLASS, options);
    this.params = {
      backgroundBlur: options.backgroundBlur ?? 10,
      tint:           options.tint           ?? 'rgba(255,255,255,0.1)',
      border:         options.border         ?? 'rgba(255,255,255,0.3)',
      borderWidth:    options.borderWidth    ?? 1,
      borderRadius:   options.borderRadius   ?? 8,
    };
  }

  apply(context) {
    // TODO: Requires a separate backdrop blur pass (CSS backdrop-filter equivalent).
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new GlassEffect(data.params), data);
  }
}

// ─── 7. BlurEffect ───────────────────────────────────────────────────────────

class BlurEffect extends CaptionEffect {
  /**
   * @param {object} [options={}]
   * @param {number} [options.amount=5]
   * @param {'gaussian'|'radial'|'box'} [options.blurType='gaussian']
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.BLUR, options);
    this.params = {
      amount:   options.amount   ?? 5,
      blurType: options.blurType ?? 'gaussian',
    };
  }

  apply(context) {
    // TODO: Apply filter to the element layer before compositing.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new BlurEffect(data.params), data);
  }
}

// ─── 8. MotionBlurEffect ─────────────────────────────────────────────────────

class MotionBlurEffect extends CaptionEffect {
  /**
   * @param {object} [options={}]
   * @param {number} [options.amount=15]   - px
   * @param {number} [options.angle=0]     - degrees
   * @param {number} [options.samples=8]   - accumulation samples
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.MOTION_BLUR, options);
    this.params = {
      amount:  options.amount  ?? 15,
      angle:   options.angle   ?? 0,
      samples: options.samples ?? 8,
    };
  }

  apply(context) {
    // TODO: Accumulate multiple offset samples of the element layer along angle.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new MotionBlurEffect(data.params), data);
  }
}

// ─── 9. BackgroundBoxEffect ───────────────────────────────────────────────────

class BackgroundBoxEffect extends CaptionEffect {
  /**
   * @param {object} [options={}]
   * @param {string} [options.color='rgba(0,0,0,0.75)']
   * @param {number|object} [options.padding=8]
   * @param {number} [options.opacity=1]
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.BACKGROUND_BOX, options);
    const p = options.padding ?? 8;
    this.params = {
      color:   options.color   ?? 'rgba(0,0,0,0.75)',
      padding: typeof p === 'number' ? { top: p, right: p, bottom: p, left: p } : p,
      opacity: options.opacity ?? 1,
    };
  }

  apply(context) {
    // TODO: Renderer fills the text bounding rect (+ padding) before drawing text.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new BackgroundBoxEffect(data.params), data);
  }
}

// ─── 10. RoundedBoxEffect ─────────────────────────────────────────────────────

class RoundedBoxEffect extends CaptionEffect {
  /**
   * @param {object} [options={}]
   * @param {string} [options.color='rgba(0,0,0,0.75)']
   * @param {number|object} [options.padding=10]
   * @param {number} [options.borderRadius=8]
   * @param {number} [options.opacity=1]
   * @param {string|null} [options.borderColor=null]
   * @param {number} [options.borderWidth=0]
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.ROUNDED_BOX, options);
    const p = options.padding ?? 10;
    this.params = {
      color:        options.color        ?? 'rgba(0,0,0,0.75)',
      padding:      typeof p === 'number' ? { top: p, right: p, bottom: p, left: p } : p,
      borderRadius: options.borderRadius ?? 8,
      opacity:      options.opacity      ?? 1,
      borderColor:  options.borderColor  ?? null,
      borderWidth:  options.borderWidth  ?? 0,
    };
  }

  apply(context) {
    // TODO: Renderer draws a rounded rect behind the text bounds.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new RoundedBoxEffect(data.params), data);
  }
}

// ─── 11. HighlightEffect ─────────────────────────────────────────────────────

class HighlightEffect extends CaptionEffect {
  /**
   * Persistent background highlight (not animated — use HighlightAnimation for motion).
   * @param {object} [options={}]
   * @param {string} [options.color='#FFD700']
   * @param {number} [options.opacity=0.7]
   * @param {'background'|'underline'|'full'} [options.style='background']
   * @param {number|object} [options.padding=4]
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.HIGHLIGHT, options);
    const p = options.padding ?? 4;
    this.params = {
      color:   options.color   ?? '#FFD700',
      opacity: options.opacity ?? 0.7,
      style:   options.style   ?? 'background',
      padding: typeof p === 'number' ? { top: p, right: p, bottom: p, left: p } : p,
    };
  }

  apply(context) {
    // TODO: Renderer draws highlight rect or line beneath text.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new HighlightEffect(data.params), data);
  }
}

// ─── 12. UnderlineEffect ─────────────────────────────────────────────────────

class UnderlineEffect extends CaptionEffect {
  /**
   * @param {object} [options={}]
   * @param {string} [options.color='#FFFFFF']
   * @param {number} [options.thickness=2]
   * @param {'solid'|'dashed'|'dotted'|'wavy'|'double'} [options.style='solid']
   * @param {number} [options.offset=4]    - px below text baseline
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.UNDERLINE, options);
    this.params = {
      color:     options.color     ?? '#FFFFFF',
      thickness: options.thickness ?? 2,
      style:     options.style     ?? 'solid',
      offset:    options.offset    ?? 4,
    };
  }

  apply(context) {
    // TODO: Renderer draws line below each word/character bounding box.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new UnderlineEffect(data.params), data);
  }
}

// ─── 13. StrikeThroughEffect ─────────────────────────────────────────────────

class StrikeThroughEffect extends CaptionEffect {
  /**
   * @param {object} [options={}]
   * @param {string} [options.color='#FFFFFF']
   * @param {number} [options.thickness=2]
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.STRIKETHROUGH, options);
    this.params = {
      color:     options.color     ?? '#FFFFFF',
      thickness: options.thickness ?? 2,
    };
  }

  apply(context) {
    // TODO: Renderer draws horizontal line through the vertical centre of the text.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new StrikeThroughEffect(data.params), data);
  }
}

// ─── 14. NoiseEffect ─────────────────────────────────────────────────────────

class NoiseEffect extends CaptionEffect {
  /**
   * @param {object} [options={}]
   * @param {number} [options.amount=0.2]   - 0–1
   * @param {'monochrome'|'color'} [options.noiseType='monochrome']
   * @param {boolean}[options.animate=false]
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.NOISE, options);
    this.params = {
      amount:    options.amount    ?? 0.2,
      noiseType: options.noiseType ?? 'monochrome',
      animate:   options.animate   ?? false,
    };
  }

  apply(context) {
    // TODO: Apply per-pixel noise layer on top of the element using ImageData manipulation
    //       or a pre-generated noise texture.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new NoiseEffect(data.params), data);
  }
}

// ─── 15. GrainEffect ─────────────────────────────────────────────────────────

class GrainEffect extends CaptionEffect {
  /**
   * Film grain texture overlay.
   * @param {object} [options={}]
   * @param {number} [options.amount=0.15]
   * @param {number} [options.size=2]      - grain particle size in px
   * @param {number} [options.opacity=0.5]
   * @param {boolean}[options.animate=true] - re-seed each frame
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.GRAIN, options);
    this.params = {
      amount:  options.amount  ?? 0.15,
      size:    options.size    ?? 2,
      opacity: options.opacity ?? 0.5,
      animate: options.animate ?? true,
    };
  }

  apply(context) {
    // TODO: Overlay a randomly-seeded grain texture, re-generated per frame when animate=true.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new GrainEffect(data.params), data);
  }
}

// ─── 16. ChromaticAberrationEffect ───────────────────────────────────────────

class ChromaticAberrationEffect extends CaptionEffect {
  /**
   * RGB channel separation.
   * @param {object} [options={}]
   * @param {number} [options.amount=4]       - max pixel shift
   * @param {number} [options.offsetR=4]
   * @param {number} [options.offsetG=0]
   * @param {number} [options.offsetB=-4]
   * @param {number} [options.angle=0]        - shift direction degrees
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.CHROMATIC_ABERRATION, options);
    this.params = {
      amount:  options.amount  ?? 4,
      offsetR: options.offsetR ?? 4,
      offsetG: options.offsetG ?? 0,
      offsetB: options.offsetB ?? -4,
      angle:   options.angle   ?? 0,
    };
  }

  apply(context) {
    // TODO: Render R, G, B channels separately with per-channel offsets and blend as 'screen'.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new ChromaticAberrationEffect(data.params), data);
  }
}

// ─── 17. BloomEffect ─────────────────────────────────────────────────────────

class BloomEffect extends CaptionEffect {
  /**
   * Bright-region bloom/lens flare.
   * @param {object} [options={}]
   * @param {number} [options.threshold=0.7]  - luminance threshold 0–1
   * @param {number} [options.strength=1.5]
   * @param {number} [options.blur=15]
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.BLOOM, options);
    this.params = {
      threshold: options.threshold ?? 0.7,
      strength:  options.strength  ?? 1.5,
      blur:      options.blur      ?? 15,
    };
  }

  apply(context) {
    // TODO: Extract bright pixels above threshold, blur them, and add back to the element
    //       layer using 'screen' blend mode.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new BloomEffect(data.params), data);
  }
}

// ─── 18. DistortionEffect ────────────────────────────────────────────────────

class DistortionEffect extends CaptionEffect {
  /**
   * @param {object} [options={}]
   * @param {'wave'|'ripple'|'bulge'|'pinch'|'twirl'} [options.distortionType='wave']
   * @param {number} [options.amount=10]
   * @param {number} [options.frequency=1]
   * @param {boolean}[options.animate=false]
   * @param {number} [options.speed=1]   - animation speed (cycles/second)
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.DISTORTION, options);
    this.params = {
      distortionType: options.distortionType ?? 'wave',
      amount:         options.amount         ?? 10,
      frequency:      options.frequency      ?? 1,
      animate:        options.animate        ?? false,
      speed:          options.speed          ?? 1,
    };
  }

  apply(context) {
    // TODO: Apply displacement map or mesh warp to the element pixels.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new DistortionEffect(data.params), data);
  }
}

// ─── 19. ReflectionEffect ────────────────────────────────────────────────────

class ReflectionEffect extends CaptionEffect {
  /**
   * Mirror reflection below or beside the text.
   * @param {object} [options={}]
   * @param {number} [options.opacity=0.4]
   * @param {number} [options.distance=4]     - gap between text and reflection (px)
   * @param {number} [options.fadeLength=0.6] - 0–1, how much of reflection fades out
   * @param {number} [options.angle=180]      - reflection axis degrees
   * @param {boolean}[options.blur=true]
   * @param {number} [options.blurAmount=3]
   */
  constructor(options = {}) {
    super(EFFECT_TYPES.REFLECTION, options);
    this.params = {
      opacity:    options.opacity    ?? 0.4,
      distance:   options.distance   ?? 4,
      fadeLength: options.fadeLength ?? 0.6,
      angle:      options.angle      ?? 180,
      blur:       options.blur       ?? true,
      blurAmount: options.blurAmount ?? 3,
    };
  }

  apply(context) {
    // TODO: Flip the element layer about the reflection axis, apply gradient fade mask,
    //       optional blur, and composite beneath the original.
    return context;
  }

  static _fromData(data) {
    return CaptionEffect._applyBase(new ReflectionEffect(data.params), data);
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const EFFECT_REGISTRY = new Map([
  [EFFECT_TYPES.GLOW,                 GlowEffect],
  [EFFECT_TYPES.SHADOW,               ShadowEffect],
  [EFFECT_TYPES.OUTLINE,              OutlineEffect],
  [EFFECT_TYPES.GRADIENT,             GradientEffect],
  [EFFECT_TYPES.NEON,                 NeonEffect],
  [EFFECT_TYPES.GLASS,                GlassEffect],
  [EFFECT_TYPES.BLUR,                 BlurEffect],
  [EFFECT_TYPES.MOTION_BLUR,          MotionBlurEffect],
  [EFFECT_TYPES.BACKGROUND_BOX,       BackgroundBoxEffect],
  [EFFECT_TYPES.ROUNDED_BOX,          RoundedBoxEffect],
  [EFFECT_TYPES.HIGHLIGHT,            HighlightEffect],
  [EFFECT_TYPES.UNDERLINE,            UnderlineEffect],
  [EFFECT_TYPES.STRIKETHROUGH,        StrikeThroughEffect],
  [EFFECT_TYPES.NOISE,                NoiseEffect],
  [EFFECT_TYPES.GRAIN,                GrainEffect],
  [EFFECT_TYPES.CHROMATIC_ABERRATION, ChromaticAberrationEffect],
  [EFFECT_TYPES.BLOOM,                BloomEffect],
  [EFFECT_TYPES.DISTORTION,           DistortionEffect],
  [EFFECT_TYPES.REFLECTION,           ReflectionEffect],
]);

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  GlowEffect, ShadowEffect, OutlineEffect, GradientEffect, NeonEffect,
  GlassEffect, BlurEffect, MotionBlurEffect, BackgroundBoxEffect,
  RoundedBoxEffect, HighlightEffect, UnderlineEffect, StrikeThroughEffect,
  NoiseEffect, GrainEffect, ChromaticAberrationEffect, BloomEffect,
  DistortionEffect, ReflectionEffect,
};

export default CaptionEffect;
