/**
 * VideoForge — podcast-edit.js
 *
 * Demonstrates an audio-first editing workflow:
 *   1. Multiple audio clips on a single track
 *   2. Volume, speed, mute, and pan controls
 *   3. Trim and fade applied to each segment
 *   4. Export to MP4 with a static background image
 *
 * Requirements: FFmpeg must be installed and in PATH.
 *
 * Run:  node examples/podcast-edit.js
 */

import { Project } from '../src/index.js';

// ─── Project ──────────────────────────────────────────────────────────────────

const project = new Project({
  name:   'Podcast Episode 12',
  fps:    30,
  width:  1920,
  height: 1080,
});

// ─── Background image (looped for the full duration) ─────────────────────────

// Note: ImageClip will be skipped by the MP4 exporter (no compositor yet).
// To add visuals, pair with a static video background instead.
const bgTrack = project.addTrack('video', { name: 'Background' });
bgTrack.addVideo('./assets/podcast-bg.mp4', { outPoint: 60 });

// ─── Main speech track ────────────────────────────────────────────────────────

const speechTrack = project.addTrack('audio', { name: 'Speech' });

// Intro segment: remove 2-second silence at the start.
const intro = speechTrack.addAudio('./audio/intro.wav', {
  inPoint:  2,
  outPoint: 15,
});
intro.volume(1.0).fadeIn(0.3);

// Main segment: slight boost, slight left pan for warmth.
const main = speechTrack.addAudio('./audio/main-content.wav', {
  outPoint: 42,
});
main.volume(1.1).pan(-0.1);

// Outro: fade out over 2 seconds.
const outro = speechTrack.addAudio('./audio/outro.wav', {
  outPoint: 8,
});
outro.fadeOut(2);

// ─── Background music track ───────────────────────────────────────────────────

const musicTrack = project.addTrack('audio', { name: 'Music' });
const music = musicTrack.addAudio('./audio/lo-fi-background.mp3', { outPoint: 60 });
music.volume(0.15).fadeIn(3).fadeOut(5);

// ─── Validation ───────────────────────────────────────────────────────────────

const report = project.validate({ exporter: 'mp4' });

if (!report.valid) {
  console.error('Validation errors:');
  for (const e of report.errors) console.error(' ✗', e.message);
  process.exit(1);
}

console.log(`Timeline duration: ${project.timeline.getTotalDuration().toFixed(1)}s`);
console.log('Exporting podcast...');

// ─── Export ───────────────────────────────────────────────────────────────────

const result = await project.export({
  type:   'mp4',
  output: './output/podcast-ep12.mp4',
  onProgress: (pct) => process.stdout.write(`\r${pct.toFixed(0)}%`),
});

console.log(`\nDone → ${result.output}  (${(result.fileSize / 1024 / 1024).toFixed(2)} MB)`);
