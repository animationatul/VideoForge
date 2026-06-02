/**
 * @module CaptionPreset
 * A CaptionPreset bundles style + layout + animations + effects into a
 * reusable, named configuration that can be applied to any CaptionClip
 * with a single call.
 *
 * Ten built-in presets are provided:
 *   HormoziPreset, MrBeastPreset, PodcastPreset, NewsPreset,
 *   DocumentaryPreset, KaraokePreset, MinimalPreset, GamingPreset,
 *   LuxuryPreset, CorporatePreset
 *
 * All presets are registered in PRESET_REGISTRY so they can be referenced by name.
 */

import IdGenerator from '../utils/IdGenerator.js';
import CaptionStyle from './CaptionStyle.js';
import CaptionLayout from './CaptionLayout.js';
import { ANCHOR_POINT, WRAP_MODE } from './CaptionLayout.js';
import {
  PopAnimation, FadeAnimation, SlideAnimation, ScaleAnimation,
  TypewriterAnimation, KaraokeAnimation, ZoomAnimation, BlurRevealAnimation,
  GlitchAnimation, ElasticAnimation, StaggerAnimation,
  ANIMATION_TARGET, STAGGER_ORDER,
} from './CaptionAnimation.js';
import {
  OutlineEffect, ShadowEffect, GlowEffect, RoundedBoxEffect,
  GradientEffect, NeonEffect, BackgroundBoxEffect, ReflectionEffect,
} from './CaptionEffect.js';

// ─── CaptionPreset (base) ─────────────────────────────────────────────────────

class CaptionPreset {
  /**
   * @param {string} name    - Unique preset identifier.
   * @param {object} [options={}]
   * @param {string} [options.displayName]
   * @param {string} [options.description]
   * @param {string} [options.category]    - e.g. 'social', 'broadcast', 'creative'
   */
  constructor(name, options = {}) {
    if (new.target === CaptionPreset) {
      throw new TypeError('CaptionPreset is abstract — use a concrete subclass or factory method.');
    }

    /** @type {string} */
    this.id = IdGenerator.generate('preset');

    /** @type {string} */
    this.name = name;

    /** @type {string} */
    this.displayName = options.displayName ?? name;

    /** @type {string} */
    this.description = options.description ?? '';

    /** @type {string} */
    this.category = options.category ?? 'general';
  }

  // ─── Abstract interface ────────────────────────────────────────────────────────

  /**
   * Build the style for this preset.
   * @returns {CaptionStyle}
   */
  buildStyle() {
    throw new Error(`${this.constructor.name}.buildStyle() is not implemented.`);
  }

  /**
   * Build the layout for this preset.
   * @returns {CaptionLayout}
   */
  buildLayout() {
    throw new Error(`${this.constructor.name}.buildLayout() is not implemented.`);
  }

  /**
   * Build the default animations for this preset.
   * @returns {object[]} Array of CaptionAnimation instances.
   */
  buildAnimations() {
    return [];
  }

  /**
   * Build the default effects for this preset.
   * @returns {object[]} Array of CaptionEffect instances.
   */
  buildEffects() {
    return [];
  }

  /**
   * Return a complete descriptor object to apply to a CaptionClip.
   * @returns {{ style: CaptionStyle, layout: CaptionLayout, animations: object[], effects: object[] }}
   */
  build() {
    return {
      style:      this.buildStyle(),
      layout:     this.buildLayout(),
      animations: this.buildAnimations(),
      effects:    this.buildEffects(),
    };
  }

  // ─── Serialise ────────────────────────────────────────────────────────────────

  toJSON() {
    return {
      id:          this.id,
      name:        this.name,
      displayName: this.displayName,
      description: this.description,
      category:    this.category,
    };
  }

  static fromJSON(data) {
    const Cls = PRESET_REGISTRY.get(data.name);
    if (!Cls) throw new Error(`Unknown preset: "${data.name}"`);
    return new Cls();
  }
}

// ─── 1. HormoziPreset ─────────────────────────────────────────────────────────

class HormoziPreset extends CaptionPreset {
  constructor() {
    super('hormozi', {
      displayName: 'Alex Hormozi',
      description: 'Bold ALL-CAPS Impact font, yellow key-word highlights, aggressive outline, centered lower-third.',
      category:    'social',
    });
  }

  buildStyle() {
    return new CaptionStyle({
      fontFamily:    'Impact, Arial Black, sans-serif',
      fontWeight:    900,
      fontSize:      72,
      textTransform: 'uppercase',
      fill:          '#FFFFFF',
      letterSpacing: 2,
    }).setStroke('#000000', 5, 'round');
  }

  buildLayout() {
    return new CaptionLayout({
      x: 0.5, y: 0.82,
      anchor:          ANCHOR_POINT.BOTTOM_CENTER,
      maxWordsPerLine: 4,
      wrapMode:        WRAP_MODE.WORD,
      textAlign:       'center',
    });
  }

  buildAnimations() {
    return [
      new StaggerAnimation(new PopAnimation({ duration: 0.2, overshoot: 1.25 }), {
        target:  ANIMATION_TARGET.WORD,
        stagger: 0.06,
        order:   STAGGER_ORDER.FORWARD,
      }),
    ];
  }

  buildEffects() {
    return [
      new OutlineEffect({ color: '#000000', width: 5 }),
      new ShadowEffect({ color: 'rgba(0,0,0,0.7)', offsetX: 3, offsetY: 3, blur: 5 }),
    ];
  }
}

// ─── 2. MrBeastPreset ─────────────────────────────────────────────────────────

class MrBeastPreset extends CaptionPreset {
  constructor() {
    super('mrbeast', {
      displayName: 'MrBeast',
      description: 'Large, energetic, colourful, outlined, per-character staggered pop — YouTube style.',
      category:    'social',
    });
  }

  buildStyle() {
    return new CaptionStyle({
      fontFamily:    'Arial Black, Impact, sans-serif',
      fontWeight:    900,
      fontSize:      68,
      textTransform: 'uppercase',
      fill:          '#FFFF00',
    }).setStroke('#000000', 6, 'round');
  }

  buildLayout() {
    return new CaptionLayout({
      x: 0.5, y: 0.85,
      anchor:          ANCHOR_POINT.BOTTOM_CENTER,
      maxWordsPerLine: 5,
      textAlign:       'center',
    });
  }

  buildAnimations() {
    return [
      new StaggerAnimation(new PopAnimation({ duration: 0.15, overshoot: 1.4 }), {
        target:  ANIMATION_TARGET.CHARACTER,
        stagger: 0.025,
        order:   STAGGER_ORDER.FORWARD,
      }),
    ];
  }

  buildEffects() {
    return [
      new OutlineEffect({ color: '#000000', width: 6 }),
      new GlowEffect({ color: '#FFFF00', blur: 15, layers: 2 }),
    ];
  }
}

// ─── 3. PodcastPreset ─────────────────────────────────────────────────────────

class PodcastPreset extends CaptionPreset {
  constructor() {
    super('podcast', {
      displayName: 'Podcast',
      description: 'Clean sans-serif, word-level highlight as speaker talks, lower-third.',
      category:    'podcast',
    });
  }

  buildStyle() {
    return new CaptionStyle({
      fontFamily: 'Helvetica Neue, Arial, sans-serif',
      fontWeight: 600,
      fontSize:   48,
      fill:       '#FFFFFF',
    });
  }

  buildLayout() {
    return new CaptionLayout({
      x: 0.5, y: 0.88,
      anchor:          ANCHOR_POINT.BOTTOM_CENTER,
      maxWordsPerLine: 7,
      wrapMode:        WRAP_MODE.WORD,
    });
  }

  buildAnimations() {
    return [
      new KaraokeAnimation({ fillColor: '#00BFFF', fillStyle: 'word' }),
    ];
  }

  buildEffects() {
    return [
      new RoundedBoxEffect({ color: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 10 }),
    ];
  }
}

// ─── 4. NewsPreset ────────────────────────────────────────────────────────────

class NewsPreset extends CaptionPreset {
  constructor() {
    super('news', {
      displayName: 'News / Broadcast',
      description: 'Lower-third chyron, left-aligned, sans-serif, coloured ticker bar.',
      category:    'broadcast',
    });
  }

  buildStyle() {
    return new CaptionStyle({
      fontFamily:    'Arial Narrow, Arial, sans-serif',
      fontWeight:    700,
      fontSize:      34,
      textTransform: 'uppercase',
      fill:          '#FFFFFF',
      textAlign:     'left',
    });
  }

  buildLayout() {
    return new CaptionLayout({
      x:        0.02,
      y:        0.88,
      anchor:   ANCHOR_POINT.BOTTOM_LEFT,
      textAlign:'left',
      maxWordsPerLine: 8,
    });
  }

  buildAnimations() {
    return [
      new SlideAnimation({ direction: 'left', distance: 30, duration: 0.3, fade: true }),
    ];
  }

  buildEffects() {
    return [
      new BackgroundBoxEffect({ color: '#CC0000', padding: { top: 6, right: 12, bottom: 6, left: 12 } }),
    ];
  }
}

// ─── 5. DocumentaryPreset ─────────────────────────────────────────────────────

class DocumentaryPreset extends CaptionPreset {
  constructor() {
    super('documentary', {
      displayName: 'Documentary',
      description: 'Elegant, centred, fade-in/out, semi-transparent background.',
      category:    'film',
    });
  }

  buildStyle() {
    return new CaptionStyle({
      fontFamily:    'Georgia, Palatino, serif',
      fontWeight:    400,
      fontSize:      40,
      fill:          '#FFFFFF',
      letterSpacing: 1,
    });
  }

  buildLayout() {
    return new CaptionLayout({
      x: 0.5, y: 0.88,
      anchor:          ANCHOR_POINT.BOTTOM_CENTER,
      maxWordsPerLine: 8,
    });
  }

  buildAnimations() {
    return [
      new FadeAnimation({ direction: 'in',  duration: 0.5 }),
      new FadeAnimation({ direction: 'out', duration: 0.5, delay: 0 }),
    ];
  }

  buildEffects() {
    return [
      new BackgroundBoxEffect({ color: 'rgba(0,0,0,0.55)', padding: 10 }),
    ];
  }
}

// ─── 6. KaraokePreset ─────────────────────────────────────────────────────────

class KaraokePreset extends CaptionPreset {
  constructor() {
    super('karaoke', {
      displayName: 'Karaoke',
      description: 'Progressive left-to-right colour fill synced to word timing, with highlight bar.',
      category:    'karaoke',
    });
  }

  buildStyle() {
    return new CaptionStyle({
      fontFamily:  'Arial Black, Impact, sans-serif',
      fontWeight:  900,
      fontSize:    56,
      fill:        '#FFFFFF',
    }).setStroke('#000000', 3, 'round');
  }

  buildLayout() {
    return new CaptionLayout({
      x: 0.5, y: 0.88,
      anchor:          ANCHOR_POINT.BOTTOM_CENTER,
      maxWordsPerLine: 6,
    });
  }

  buildAnimations() {
    return [
      new KaraokeAnimation({
        fillColor:    '#FFD700',
        fillStyle:    'leftToRight',
        highlightBar: true,
        barColor:     'rgba(255,215,0,0.35)',
        barHeight:    6,
      }),
    ];
  }

  buildEffects() {
    return [
      new OutlineEffect({ color: '#000000', width: 3 }),
      new ShadowEffect({ color: 'rgba(0,0,0,0.6)', offsetX: 2, offsetY: 2, blur: 4 }),
    ];
  }
}

// ─── 7. MinimalPreset ─────────────────────────────────────────────────────────

class MinimalPreset extends CaptionPreset {
  constructor() {
    super('minimal', {
      displayName: 'Minimal',
      description: 'Clean, light font, subtle fade, pill-shaped background.',
      category:    'minimal',
    });
  }

  buildStyle() {
    return new CaptionStyle({
      fontFamily:  'Helvetica Neue, Arial, sans-serif',
      fontWeight:  300,
      fontSize:    36,
      fill:        '#FFFFFF',
      letterSpacing: 0.5,
    });
  }

  buildLayout() {
    return new CaptionLayout({
      x: 0.5, y: 0.88,
      anchor:          ANCHOR_POINT.BOTTOM_CENTER,
      maxWordsPerLine: 8,
    });
  }

  buildAnimations() {
    return [
      new FadeAnimation({ direction: 'in', duration: 0.4 }),
    ];
  }

  buildEffects() {
    return [
      new RoundedBoxEffect({ color: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 20 }),
    ];
  }
}

// ─── 8. GamingPreset ─────────────────────────────────────────────────────────

class GamingPreset extends CaptionPreset {
  constructor() {
    super('gaming', {
      displayName: 'Gaming',
      description: 'Bold, neon-coloured, glitchy, energetic animations.',
      category:    'gaming',
    });
  }

  buildStyle() {
    return new CaptionStyle({
      fontFamily:    'Arial Black, Impact, sans-serif',
      fontWeight:    900,
      fontSize:      60,
      textTransform: 'uppercase',
      fill:          '#00FF41',
      letterSpacing: 3,
    }).setStroke('#003300', 3);
  }

  buildLayout() {
    return new CaptionLayout({
      x: 0.5, y: 0.85,
      anchor:          ANCHOR_POINT.BOTTOM_CENTER,
      maxWordsPerLine: 4,
    });
  }

  buildAnimations() {
    return [
      new GlitchAnimation({ intensity: 4, colorShift: true, speed: 8 }),
      new StaggerAnimation(new ScaleAnimation({ fromScale: 0, toScale: 1, duration: 0.15 }), {
        target:  ANIMATION_TARGET.CHARACTER,
        stagger: 0.02,
      }),
    ];
  }

  buildEffects() {
    return [
      new NeonEffect({ color: '#00FF41', glowColor: '#00FF41', intensity: 2 }),
      new OutlineEffect({ color: '#003300', width: 2 }),
    ];
  }
}

// ─── 9. LuxuryPreset ─────────────────────────────────────────────────────────

class LuxuryPreset extends CaptionPreset {
  constructor() {
    super('luxury', {
      displayName: 'Luxury / Editorial',
      description: 'Thin-weight serif, gold colour, wide tracking, elegant reveal.',
      category:    'luxury',
    });
  }

  buildStyle() {
    return new CaptionStyle({
      fontFamily:    'Playfair Display, Georgia, serif',
      fontWeight:    300,
      fontSize:      44,
      textTransform: 'uppercase',
      fill:          '#D4AF37',
      letterSpacing: 8,
      tracking:      0.15,
    });
  }

  buildLayout() {
    return new CaptionLayout({
      x: 0.5, y: 0.85,
      anchor:          ANCHOR_POINT.BOTTOM_CENTER,
      maxWordsPerLine: 5,
    });
  }

  buildAnimations() {
    return [
      new StaggerAnimation(new BlurRevealAnimation({ fromBlur: 10, toBlur: 0, withFade: true, duration: 0.8 }), {
        target:  ANIMATION_TARGET.WORD,
        stagger: 0.12,
        order:   STAGGER_ORDER.FORWARD,
      }),
    ];
  }

  buildEffects() {
    return [
      new GradientEffect({
        type:  'linear',
        angle: 90,
        stops: [{ color: '#D4AF37', position: 0 }, { color: '#F0D060', position: 0.5 }, { color: '#D4AF37', position: 1 }],
      }),
      new ShadowEffect({ color: 'rgba(0,0,0,0.4)', offsetX: 1, offsetY: 1, blur: 3 }),
    ];
  }
}

// ─── 10. CorporatePreset ─────────────────────────────────────────────────────

class CorporatePreset extends CaptionPreset {
  constructor() {
    super('corporate', {
      displayName: 'Corporate',
      description: 'Professional, clean, sans-serif, simple fade + slide, white on dark.',
      category:    'corporate',
    });
  }

  buildStyle() {
    return new CaptionStyle({
      fontFamily: 'Helvetica Neue, Arial, sans-serif',
      fontWeight: 500,
      fontSize:   40,
      fill:       '#FFFFFF',
    });
  }

  buildLayout() {
    return new CaptionLayout({
      x: 0.5, y: 0.88,
      anchor:          ANCHOR_POINT.BOTTOM_CENTER,
      maxWordsPerLine: 7,
    });
  }

  buildAnimations() {
    return [
      new SlideAnimation({ direction: 'up', distance: 20, duration: 0.35, fade: true }),
    ];
  }

  buildEffects() {
    return [
      new RoundedBoxEffect({
        color:        'rgba(10,10,30,0.75)',
        padding:      12,
        borderRadius: 4,
      }),
    ];
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const PRESET_REGISTRY = new Map([
  ['hormozi',     HormoziPreset],
  ['mrbeast',     MrBeastPreset],
  ['podcast',     PodcastPreset],
  ['news',        NewsPreset],
  ['documentary', DocumentaryPreset],
  ['karaoke',     KaraokePreset],
  ['minimal',     MinimalPreset],
  ['gaming',      GamingPreset],
  ['luxury',      LuxuryPreset],
  ['corporate',   CorporatePreset],
]);

/**
 * Convenience factory: instantiate a preset by name.
 * @param {string} name
 * @returns {CaptionPreset}
 */
export function createPreset(name) {
  const Cls = PRESET_REGISTRY.get(name.toLowerCase());
  if (!Cls) {
    throw new Error(`Unknown preset: "${name}". Available: ${[...PRESET_REGISTRY.keys()].join(', ')}`);
  }
  return new Cls();
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  HormoziPreset, MrBeastPreset, PodcastPreset, NewsPreset,
  DocumentaryPreset, KaraokePreset, MinimalPreset, GamingPreset,
  LuxuryPreset, CorporatePreset,
};

export default CaptionPreset;
