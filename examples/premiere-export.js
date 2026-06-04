/**
 * VideoForge — premiere-export.js
 *
 * Demonstrates exporting a VideoForge project to Premiere Pro–compatible
 * XMEML v5 XML.  No FFmpeg required — this exporter runs entirely in Node.js.
 *
 * The generated .xml file can be imported into Premiere Pro via
 * File → Import (or dragged into the Project panel).
 *
 * Run:  node examples/premiere-export.js
 */

import { Project, PremiereXmlExporter, TRANSITION_TYPES, Transition } from '../src/index.js';

// ─── Build a project ──────────────────────────────────────────────────────────

const project = new Project({
  name:   'Product Launch Video',
  fps:    29.97,
  width:  1920,
  height: 1080,
});

const vTrack = project.addTrack('video', { name: 'Main Video' });
const aTrack = project.addTrack('audio', { name: 'Narration' });
const cTrack = project.addTrack('video', { name: 'Captions' });

// Video clips with trims and fades.
const hook = vTrack.addVideo('./footage/hook.mp4',      { outPoint: 8  });
const demo = vTrack.addVideo('./footage/demo.mp4',       { outPoint: 45 });
const cta  = vTrack.addVideo('./footage/cta.mp4',        { outPoint: 12 });

hook.fadeIn(0.5);
demo.speed(1.0);
cta.fadeOut(1.5);

// Cross-dissolve between hook and demo.
const dissolve = new Transition(TRANSITION_TYPES.CROSS_DISSOLVE, 1.0);
dissolve.link(hook, demo);
demo.addEffect(dissolve);

// Audio narration (one long clip spanning the whole video).
const narr = aTrack.addAudio('./audio/narration.mp3', { outPoint: 65 });
narr.volume(1.0).fadeIn(0.3).fadeOut(1);

// Caption text clips (will be converted to generator items in XMEML).
cTrack.addText('Introducing VideoForge', { startTime: 0,  outPoint: 5,  fontSizeValue: 72 });
cTrack.addText('Export to any format',   { startTime: 10, outPoint: 15, fontSizeValue: 60 });
cTrack.addText('Download free today',    { startTime: 55, outPoint: 65, fontSizeValue: 72 });

// ─── Export via XMEML ─────────────────────────────────────────────────────────

const exporter = new PremiereXmlExporter(project, {
  pretty:            true,
  validateInput:     true,
  validateOutput:    true,
  includeVfMetadata: true,
  sequenceName:      'Product Launch v1',
});

const outputPath = await exporter.export('./output/product-launch.xml');
console.log(`Exported Premiere XML → ${outputPath}`);

// Preview a snippet.
const xml = exporter.toString();
const lines = xml.split('\n');
console.log('\nFirst 20 lines:');
console.log(lines.slice(0, 20).join('\n'));
