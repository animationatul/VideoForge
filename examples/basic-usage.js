/**
 * VideoForge — basic usage example.
 *
 * Demonstrates the core API: creating a project, adding tracks and clips,
 * applying effects, and exporting to JSON.
 *
 * Run:  node examples/basic-usage.js
 */

import {
  Project,
  TRACK_TYPES,
  SHAPE_TYPES,
  TEXT_ALIGN,
  TRANSITION_TYPES,
  Transition,
} from '../src/index.js';

// ─── 1. Create a project ──────────────────────────────────────────────────────

const project = new Project({
  name: 'My First Edit',
  fps: 30,
  width: 1920,
  height: 1080,
});

console.log(`Project created: "${project.name}" [${project.id}]`);

// ─── 2. Add tracks ────────────────────────────────────────────────────────────

const videoTrack = project.addTrack(TRACK_TYPES.VIDEO, { name: 'Main Video' });
const audioTrack = project.addTrack(TRACK_TYPES.AUDIO, { name: 'Music' });
const textTrack  = project.addTrack(TRACK_TYPES.TEXT,  { name: 'Captions' });
const shapeTrack = project.addTrack(TRACK_TYPES.SHAPE, { name: 'Graphics' });

console.log(`Tracks: ${project.getTracks().map(t => t.name).join(', ')}`);

// ─── 3. Add video clips ───────────────────────────────────────────────────────

const intro = videoTrack.addVideo('intro.mp4', { outPoint: 30 });
const mainClip = videoTrack.addVideo('main-footage.mp4', { outPoint: 120 });
const outro = videoTrack.addVideo('outro.mp4', { outPoint: 15 });

// Trim intro to use only seconds 5–20 of the source file.
intro.trim(5, 20);

// Apply a 1-second fade-in to the intro.
intro.fadeIn(1);

// Slow main clip to 80% speed and adjust volume.
mainClip.speed(0.8).volume(0.9);

// Fade out the outro.
outro.fadeOut(1.5);

// Add a cross-dissolve transition between intro and mainClip.
const dissolve = new Transition(TRANSITION_TYPES.CROSS_DISSOLVE, 1);
dissolve.link(intro, mainClip);
mainClip.addEffect(dissolve);

console.log(
  `Video clips: intro (${intro.duration}s), main (${mainClip.duration}s), outro (${outro.duration}s)`,
);

// ─── 4. Add audio ─────────────────────────────────────────────────────────────

const music = audioTrack.addAudio('background-music.mp3', { outPoint: 150 });
music.volume(0.6).pan(-0.1); // Slightly left.
music.fadeIn(2).fadeOut(3);

// ─── 5. Add text clips ────────────────────────────────────────────────────────

const title = textTrack.addText('VideoForge Demo', {
  startTime: 0,
  outPoint: 5,
  fontSizeValue: 72,
  colorValue: '#FFFFFF',
  alignValue: TEXT_ALIGN.CENTER,
});
title.font('Helvetica Neue').bold(true).fadeIn(0.5).fadeOut(0.5);

const subtitle = textTrack.addText('Built with VideoForge', {
  outPoint: 4,
  fontSizeValue: 36,
  colorValue: '#CCCCCC',
});
subtitle.position(960, 620).fadeIn(1);

// ─── 6. Add shape clips ───────────────────────────────────────────────────────

const lowerThird = shapeTrack.addShape(SHAPE_TYPES.RECTANGLE, {
  outPoint: 5,
  x: 0,
  y: 900,
  width: 640,
  height: 80,
  fillColor: '#1A1A2E',
  opacityLevel: 0.85,
  cornerRadius: 8,
});
lowerThird.fadeIn(0.3).fadeOut(0.3);

// ─── 7. Split a clip ──────────────────────────────────────────────────────────

// Split mainClip at the 60-second mark.
const mainAbsoluteSplitTime = mainClip.startTime + 60;
const { head, tail } = mainClip.split(mainAbsoluteSplitTime);
console.log(
  `Split mainClip → head: ${head.duration}s, tail: ${tail.duration}s`,
);

// ─── 8. Timeline queries ──────────────────────────────────────────────────────

const tl = project.timeline;
console.log(`Total duration: ${tl.getTotalDuration()}s`);
console.log(`Total frames:   ${tl.getTotalFrames()}`);
console.log(`Clip count:     ${tl.getClipCount()}`);

const clipsAt10s = tl.getClipsAtTime(10);
console.log(`Active clips at t=10s: ${clipsAt10s.length}`);

const overlaps = tl.findOverlaps();
console.log(`Timeline overlaps: ${overlaps.length}`);

// ─── 9. Copy a clip ───────────────────────────────────────────────────────────

const titleCopy = title.copy();
titleCopy.move(30).text = 'Act II';
textTrack._attach(titleCopy); // Re-add to track manually after copy.
console.log(`Copied title clip → new id: ${titleCopy.id}`);

// ─── 10. Export to JSON ───────────────────────────────────────────────────────

project
  .export({ type: 'json', output: './output/project.vfp' })
  .then((outputPath) => {
    console.log(`\nProject exported to: ${outputPath}`);
  })
  .catch((err) => {
    console.error('Export failed:', err.message);
  });

// ─── 11. Project serialisation ────────────────────────────────────────────────

const json = project.toJSON();
console.log('\nProject JSON summary:');
console.log(`  id:      ${json.id}`);
console.log(`  name:    ${json.name}`);
console.log(`  tracks:  ${json.tracks.length}`);
console.log(`  version: ${json.version}`);

// Reconstruct from JSON (round-trip).
const restored = Project.fromJSON(json);
console.log(`\nRestored project: "${restored.name}" with ${restored.getTracks().length} tracks`);
