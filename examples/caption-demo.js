/**
 * VideoForge — caption-demo.js
 *
 * Demonstrates the Caption & Motion Typography Engine:
 *   - Built-in presets (hormozi, mrbeast, podcast, etc.)
 *   - Word-level timing for karaoke sync
 *   - Per-segment and per-word animations
 *   - Visual effects (glow, outline, background box)
 *   - Keyframe animation
 *   - Export to Premiere XML (captions → generator items)
 *
 * No FFmpeg required.  Caption rendering in MP4 is not yet supported —
 * use PremiereXmlExporter or FcpxmlExporter to bring captions into an NLE.
 *
 * Run:  node examples/caption-demo.js
 */

import {
  Project,
  PremiereXmlExporter,
  SlideAnimation, PopAnimation, StaggerAnimation,
  GlowEffect, OutlineEffect, BackgroundBoxEffect,
  ANIMATION_TARGET,
  PRESET_REGISTRY,
} from '../src/index.js';

// ─── Project ──────────────────────────────────────────────────────────────────

const project = new Project({
  name:   'Caption Demo',
  fps:    30,
  width:  1920,
  height: 1080,
});

// Video track provides the underlying footage reference.
project.addTrack('video').addVideo('./footage/interview.mp4', { outPoint: 60 });

// Caption track.
const captionTrack = project.addTrack('video', { name: 'Captions' });

// ─── 1. Preset: Hormozi bold-word style ──────────────────────────────────────

const c1 = captionTrack.addCaption('The secret to going viral is simple.', {
  startTime: 0,
  outPoint:  4,
  preset:    'hormozi',
});

console.log(`Clip 1 segments: ${c1.segments.length}`);

// ─── 2. Preset: MrBeast with karaoke highlight ───────────────────────────────

const c2 = captionTrack.addCaption('Every single word gets highlighted as you speak.', {
  startTime: 4,
  outPoint:  8,
  preset:    'mrbeast',
});

// Word-level timing data (from a transcript API or manual entry).
const wordTimings = [
  { word: 'Every',      start: 4.0, end: 4.4 },
  { word: 'single',     start: 4.4, end: 4.9 },
  { word: 'word',       start: 4.9, end: 5.3 },
  { word: 'gets',       start: 5.3, end: 5.6 },
  { word: 'highlighted',start: 5.6, end: 6.3 },
  { word: 'as',         start: 6.3, end: 6.5 },
  { word: 'you',        start: 6.5, end: 6.8 },
  { word: 'speak.',     start: 6.8, end: 7.5 },
];

c2.setTranscript('Every single word gets highlighted as you speak.', { wordTimings });
c2.buildKaraoke({ fillColor: '#FFD700' });

// ─── 3. Custom animations ─────────────────────────────────────────────────────

const c3 = captionTrack.addCaption('Custom animations at every level.', {
  startTime: 8,
  outPoint:  12,
});

// Slide-in from below with a stagger delay between words.
c3.addAnimation(new StaggerAnimation({
  animation:    new SlideAnimation({ direction: 'up', duration: 0.3 }),
  staggerDelay: 0.04,
  order:        'forward',
  target:       ANIMATION_TARGET.WORD,
}));

// Pop effect on each character.
c3.addAnimation(new PopAnimation({
  duration: 0.2,
  target:   ANIMATION_TARGET.CHARACTER,
}));

// ─── 4. Visual effects ────────────────────────────────────────────────────────

const c4 = captionTrack.addCaption('Visual effects make captions pop.', {
  startTime: 12,
  outPoint:  16,
});

c4.addEffect(new GlowEffect({ color: '#FFD700', radius: 10, strength: 0.9 }));
c4.addEffect(new OutlineEffect({ color: '#000000', width: 3 }));
c4.addEffect(new BackgroundBoxEffect({
  color:   '#000000CC',
  padding: 12,
}));

// ─── 5. Keyframe animation ────────────────────────────────────────────────────

const c5 = captionTrack.addCaption('Keyframe-animated opacity.', {
  startTime: 16,
  outPoint:  20,
});

// Fade in over 0.5 s, hold, fade out over 0.5 s.
c5.addKeyframe('opacity', 0,    0);
c5.addKeyframe('opacity', 0.5,  1);
c5.addKeyframe('opacity', 3.5,  1);
c5.addKeyframe('opacity', 4,    0);

// ─── 6. List all built-in presets ────────────────────────────────────────────

console.log('\nBuilt-in presets:', [...PRESET_REGISTRY.keys()].join(', '));

// ─── 7. Export to Premiere XML ────────────────────────────────────────────────

// Note: captions are rendered as title generator items in XMEML.
// They are NOT rendered to pixels in the MP4 exporter (V1 limitation).

const exporter = new PremiereXmlExporter(project, {
  pretty:            true,
  includeVfMetadata: true,
});

const outputPath = await exporter.export('./output/caption-demo.xml');
console.log(`\nExported to Premiere XML → ${outputPath}`);
console.log('Import in Premiere: File → Import → select caption-demo.xml');
