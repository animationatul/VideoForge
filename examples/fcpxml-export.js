/**
 * VideoForge — fcpxml-export.js
 *
 * Demonstrates exporting a VideoForge project to Final Cut Pro X–compatible
 * FCPXML 1.10.  No FFmpeg required.
 *
 * The generated .fcpxml file can be imported into Final Cut Pro via
 * File → Import → XML.
 *
 * Run:  node examples/fcpxml-export.js
 */

import {
  Project,
  FcpxmlExporter,
  TimeCode,
} from '../src/index.js';

// ─── Build a 24fps documentary project ───────────────────────────────────────

const project = new Project({
  name:   'Documentary Cut',
  fps:    24,
  width:  3840,
  height: 2160,
});

const vTrack = project.addTrack('video', { name: 'A-Roll' });
const bTrack = project.addTrack('video', { name: 'B-Roll' });
const aTrack = project.addTrack('audio', { name: 'Interview Audio' });

// A-Roll interview clips.
const iv1 = vTrack.addVideo('./footage/interview-1.mov', { outPoint: 20 });
const iv2 = vTrack.addVideo('./footage/interview-2.mov', { outPoint: 35 });
const iv3 = vTrack.addVideo('./footage/interview-3.mov', { inPoint: 5, outPoint: 25 });

iv1.fadeIn(0.5);
iv3.fadeOut(1);

// B-Roll cutaways on a second video track.
bTrack.addVideo('./footage/location-shot.mov', { startTime: 8,  outPoint: 6  });
bTrack.addVideo('./footage/close-up.mov',       { startTime: 28, outPoint: 4  });

// Separate audio track for clean interview audio.
const aud = aTrack.addAudio('./audio/interview-clean.wav', { outPoint: 80 });
aud.volume(1.05);

// ─── Inspect timing with TimeCode ────────────────────────────────────────────

const totalSeconds = project.timeline.getTotalDuration();
const tc = new TimeCode(totalSeconds, 24);

console.log(`Total duration : ${totalSeconds.toFixed(2)}s`);
console.log(`SMPTE timecode : ${tc.toSmpteNdf()}`);
console.log(`FCPXML rational: ${tc.toFcpRational()}`);

// ─── Export via FCPXML ────────────────────────────────────────────────────────

const exporter = new FcpxmlExporter(project, {
  fcpxmlVersion:     '1.10',
  pretty:            true,
  validateInput:     true,
  validateOutput:    true,
  includeVfMetadata: true,
  libraryName:       'Documentary Library',
  eventName:         'Rough Cut',
});

const outputPath = await exporter.export('./output/documentary-cut.fcpxml');
console.log(`\nExported FCPXML → ${outputPath}`);

// Preview a snippet.
const xml = exporter.toString();
console.log('\nFirst 25 lines:');
console.log(xml.split('\n').slice(0, 25).join('\n'));
