/**
 * VideoForge — basic-edit.js
 *
 * Demonstrates the core MP4 editing workflow:
 *   1. Create a project
 *   2. Add a video track with clips
 *   3. Trim, speed, and fade clips
 *   4. Validate before export
 *   5. Export to MP4 via FFmpeg
 *
 * Requirements: FFmpeg must be installed and in PATH.
 *
 * Run:  node examples/basic-edit.js
 */

import { Project } from '../src/index.js';

// ─── 1. Project ───────────────────────────────────────────────────────────────

const project = new Project({
  name:   'Basic Edit',
  fps:    30,
  width:  1920,
  height: 1080,
});

// ─── 2. Video track ───────────────────────────────────────────────────────────

const videoTrack = project.addTrack('video', { name: 'Main Video' });

// Clip A: use seconds 5–25 of the source, fade in over 1 s.
const clipA = videoTrack.addVideo('./footage/interview.mp4', {
  inPoint:  5,
  outPoint: 25,
});
clipA.fadeIn(1);

// Clip B: full clip at 1.25× speed, fade out over 0.5 s.
const clipB = videoTrack.addVideo('./footage/broll.mp4', {
  outPoint: 10,
});
clipB.speed(1.25).fadeOut(0.5);

// Clip C: play in reverse.
const clipC = videoTrack.addVideo('./footage/outro.mp4', {
  inPoint:  0,
  outPoint: 5,
});
clipC.reverse(true).fadeIn(0.5);

// ─── 3. Audio track ───────────────────────────────────────────────────────────

const audioTrack = project.addTrack('audio', { name: 'Background Music' });
const music = audioTrack.addAudio('./audio/bg-music.mp3', { outPoint: 40 });
music.volume(0.4).fadeIn(2).fadeOut(3);

// ─── 4. Validate ─────────────────────────────────────────────────────────────

const report = project.validate({ exporter: 'mp4' });

if (!report.valid) {
  console.error('Project has errors:', report.errors);
  process.exit(1);
}

if (report.warnings.length > 0) {
  console.warn('Validation warnings:');
  for (const w of report.warnings) console.warn(' -', w.message);
}

console.log('Validation passed. Exporting...');

// ─── 5. Export ────────────────────────────────────────────────────────────────

const result = await project.export({
  type:   'mp4',
  output: './output/basic-edit.mp4',
  onProgress: (pct) => process.stdout.write(`\rProgress: ${pct.toFixed(1)}%`),
});

console.log(`\nExported → ${result.output}`);
console.log(`Duration:  ${result.duration.toFixed(2)}s`);
console.log(`File size: ${(result.fileSize / 1024).toFixed(1)} KB`);
