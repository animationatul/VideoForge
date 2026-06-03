/**
 * @file export-fidelity.test.js
 * Export Fidelity & Clip Property Preservation test suite.
 *
 * Verifies that every clip property survives the full pipeline:
 *   Project → TimelineConverter → IntermediateTimeline → Exporter → Output
 *
 * Test stages:
 *   Stage 1 — Project construction (source clips have expected private fields)
 *   Stage 2 — ITR property extraction (no functions, NaN, undefined, or objects as scalars)
 *   Stage 3 — Premiere XML semantic correctness
 *   Stage 4 — FCPXML semantic correctness
 *   Stage 5 — EDL purity (no function references or garbage values)
 *   Stage 6 — Round-trip JSON fidelity
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import Project            from '../../src/core/Project.js';
import TimelineConverter  from '../../src/interchange/TimelineConverter.js';
import PremiereXmlExporter from '../../src/exporters/PremiereXmlExporter.js';
import FcpxmlExporter     from '../../src/exporters/FcpxmlExporter.js';
import EdlExporter        from '../../src/exporters/EdlExporter.js';
import { SHAPE_TYPES }    from '../../src/utils/Constants.js';

// ─── Shared state (populated once in top-level beforeAll) ─────────────────────

const FPS = 29.97;

let project;
let vc1, vc2, audioClip, imgClip, textClip, shapeClip;
let itr;
let premiereXml, fcpxmlXml, edlText;

beforeAll(() => {
  project = new Project({ name: 'Fidelity Test', fps: FPS, width: 1920, height: 1080 });

  // ── Video track — 2 clips with non-default playback settings ─────────────────
  const vTrack = project.addTrack('video');

  vc1 = vTrack.addVideo('/footage/clip1.mp4', { inPoint: 2, outPoint: 8 });
  vc1.speed(1.5).volume(0.8);

  vc2 = vTrack.addVideo('/footage/clip2.mp4', { inPoint: 0, outPoint: 5 });
  vc2.reverse(true).mute();

  // ── Audio track — pan and volume via constructor options ──────────────────────
  const aTrack = project.addTrack('audio');
  audioClip = aTrack.addAudio('/audio/music.wav', {
    inPoint: 0, outPoint: 10, panValue: 0.7, volumeLevel: 0.5,
  });

  // ── Image track — position, scale, rotation, opacity via method calls ─────────
  const imgTrack = project.addTrack('image');
  imgClip = imgTrack.addImage('/images/overlay.png', { outPoint: 8 });
  imgClip.position(200, 300).scale(1.5, 2.0).rotation(45).opacity(0.75);

  // ── Text track — styled text via constructor options ──────────────────────────
  const tTrack = project.addTrack('text');
  textClip = tTrack.addText('Hello World', {
    outPoint: 5, fontSizeValue: 72, colorValue: '#FF0000', x: 100, y: 200,
  });

  // ── Shape track — ellipse with fill/dimensions via constructor options ─────────
  const sTrack = project.addTrack('shape');
  shapeClip = sTrack.addShape(SHAPE_TYPES.ELLIPSE, {
    outPoint: 3, fillColor: '#0000FF', x: 50, y: 75, width: 300, height: 150,
  });

  // Convert and export
  const converter = new TimelineConverter();
  itr = converter.convert(project);

  premiereXml = new PremiereXmlExporter(project, { validateInput: false, validateOutput: false }).toString();
  fcpxmlXml   = new FcpxmlExporter(project, { validateInput: false, validateOutput: false }).toString();
  edlText     = new EdlExporter(project, { validateInput: false }).toString();
});

// ─── Stage 1 — Project construction ──────────────────────────────────────────

describe('Stage 1 — Project construction', () => {
  test('project has correct fps stored on timeline', () => {
    expect(project.timeline.fps).toBe(FPS);
  });

  test('project has correct dimensions stored on timeline', () => {
    expect(project.timeline.width).toBe(1920);
    expect(project.timeline.height).toBe(1080);
  });

  test('project.fps is undefined (confirming FpsResolver is required)', () => {
    expect(project.fps).toBeUndefined();
  });

  test('project has 5 tracks', () => {
    expect(project.getTracks()).toHaveLength(5);
  });

  test('vc1 private fields reflect speed and volume set by method calls', () => {
    expect(vc1._playbackRate).toBe(1.5);
    expect(vc1._volumeLevel).toBe(0.8);
  });

  test('vc2 private fields reflect reverse and mute set by method calls', () => {
    expect(vc2._reversed).toBe(true);
    expect(vc2._muted).toBe(true);
  });

  test('audioClip private fields reflect panValue and volumeLevel from constructor', () => {
    expect(audioClip._panValue).toBe(0.7);
    expect(audioClip._volumeLevel).toBe(0.5);
  });

  test('imgClip private fields reflect position, scale, rotation, opacity', () => {
    expect(imgClip._x).toBe(200);
    expect(imgClip._y).toBe(300);
    expect(imgClip._scaleX).toBe(1.5);
    expect(imgClip._scaleY).toBe(2.0);
    expect(imgClip._rotation).toBe(45);
    expect(imgClip._opacityLevel).toBe(0.75);
  });

  test('textClip private fields reflect styling options', () => {
    expect(textClip.text).toBe('Hello World');
    expect(textClip._fontSizeValue).toBe(72);
    expect(textClip._colorValue).toBe('#FF0000');
    expect(textClip._x).toBe(100);
    expect(textClip._y).toBe(200);
  });

  test('shapeClip private fields reflect shape type and styling', () => {
    expect(shapeClip.shapeType).toBe(SHAPE_TYPES.ELLIPSE);
    expect(shapeClip._fillColor).toBe('#0000FF');
    expect(shapeClip._width).toBe(300);
    expect(shapeClip._height).toBe(150);
  });
});

// ─── Stage 2 — ITR property extraction ───────────────────────────────────────

describe('Stage 2 — ITR property extraction', () => {
  let vc1Rep, vc2Rep, audioRep, imgRep, textRep, shapeRep;

  beforeAll(() => {
    const all = itr.getAllClips();
    vc1Rep   = all.find((c) => c.id === vc1.id);
    vc2Rep   = all.find((c) => c.id === vc2.id);
    audioRep = all.find((c) => c.id === audioClip.id);
    imgRep   = all.find((c) => c.id === imgClip.id);
    textRep  = all.find((c) => c.id === textClip.id);
    shapeRep = all.find((c) => c.id === shapeClip.id);
  });

  test('all six clip representations exist in the ITR', () => {
    expect(vc1Rep).toBeDefined();
    expect(vc2Rep).toBeDefined();
    expect(audioRep).toBeDefined();
    expect(imgRep).toBeDefined();
    expect(textRep).toBeDefined();
    expect(shapeRep).toBeDefined();
  });

  test('ITR fps is 29.97 (FpsResolver reads timeline.fps)', () => {
    expect(itr.fps).toBe(FPS);
  });

  test('ITR has 5 tracks', () => {
    expect(itr.tracks).toHaveLength(5);
  });

  // ── vc1: speed + volume ────────────────────────────────────────────────────

  test('vc1 speed is numeric 1.5 (not a function reference)', () => {
    expect(typeof vc1Rep.speed).toBe('number');
    expect(vc1Rep.speed).toBe(1.5);
  });

  test('vc1 volume is numeric 0.8', () => {
    expect(typeof vc1Rep.volume).toBe('number');
    expect(vc1Rep.volume).toBe(0.8);
  });

  test('vc1 reverse is boolean false (default)', () => {
    expect(typeof vc1Rep.reverse).toBe('boolean');
    expect(vc1Rep.reverse).toBe(false);
  });

  test('vc1 mute is boolean false (default)', () => {
    expect(typeof vc1Rep.mute).toBe('boolean');
    expect(vc1Rep.mute).toBe(false);
  });

  test('vc1 timeline positions are correct in seconds', () => {
    expect(vc1Rep.timelineStart).toBe(0);
    expect(vc1Rep.timelineEnd).toBe(6);   // duration = outPoint(8) − inPoint(2) = 6
    expect(vc1Rep.sourceStart).toBe(2);
    expect(vc1Rep.sourceEnd).toBe(8);
  });

  // ── vc2: reverse + mute ────────────────────────────────────────────────────

  test('vc2 reverse is boolean true (not a function reference)', () => {
    expect(typeof vc2Rep.reverse).toBe('boolean');
    expect(vc2Rep.reverse).toBe(true);
  });

  test('vc2 mute is boolean true', () => {
    expect(typeof vc2Rep.mute).toBe('boolean');
    expect(vc2Rep.mute).toBe(true);
  });

  test('vc2 speed is numeric 1 (default)', () => {
    expect(typeof vc2Rep.speed).toBe('number');
    expect(vc2Rep.speed).toBe(1);
  });

  test('vc2 timeline positions follow vc1 (no overlap)', () => {
    expect(vc2Rep.timelineStart).toBe(6);    // placed right after vc1
    expect(vc2Rep.timelineEnd).toBe(11);     // 5-second clip
    expect(vc2Rep.sourceStart).toBe(0);
    expect(vc2Rep.sourceEnd).toBe(5);
  });

  // ── Audio: pan ─────────────────────────────────────────────────────────────

  test('audio clip pan is numeric 0.7 (not undefined, not function)', () => {
    expect(typeof audioRep.pan).toBe('number');
    expect(audioRep.pan).toBe(0.7);
  });

  test('audio clip volume is numeric 0.5', () => {
    expect(typeof audioRep.volume).toBe('number');
    expect(audioRep.volume).toBe(0.5);
  });

  // ── Image: opacity, position, scale, rotation ──────────────────────────────

  test('image clip opacity is numeric 0.75 (not a function)', () => {
    expect(typeof imgRep.opacity).toBe('number');
    expect(imgRep.opacity).toBe(0.75);
  });

  test('image clip position is a plain object with numeric x/y', () => {
    expect(typeof imgRep.position).toBe('object');
    expect(typeof imgRep.position.x).toBe('number');
    expect(typeof imgRep.position.y).toBe('number');
    expect(imgRep.position.x).toBe(200);
    expect(imgRep.position.y).toBe(300);
  });

  test('image clip scale is a plain object with numeric x/y', () => {
    expect(typeof imgRep.scale).toBe('object');
    expect(typeof imgRep.scale.x).toBe('number');
    expect(typeof imgRep.scale.y).toBe('number');
    expect(imgRep.scale.x).toBe(1.5);
    expect(imgRep.scale.y).toBe(2.0);
  });

  test('image clip rotation is numeric 45', () => {
    expect(typeof imgRep.rotation).toBe('number');
    expect(imgRep.rotation).toBe(45);
  });

  // ── Text: videoForgeMetadata ────────────────────────────────────────────────

  test('text clip videoForgeMetadata.text is the correct string', () => {
    expect(typeof textRep.videoForgeMetadata.text).toBe('string');
    expect(textRep.videoForgeMetadata.text).toBe('Hello World');
  });

  test('text clip videoForgeMetadata.fontSize is numeric 72', () => {
    expect(typeof textRep.videoForgeMetadata.fontSize).toBe('number');
    expect(textRep.videoForgeMetadata.fontSize).toBe(72);
  });

  test('text clip videoForgeMetadata.color is #FF0000', () => {
    expect(textRep.videoForgeMetadata.color).toBe('#FF0000');
  });

  test('text clip type is "text"', () => {
    expect(textRep.type).toBe('text');
  });

  // ── Shape: videoForgeMetadata ──────────────────────────────────────────────

  test('shape clip videoForgeMetadata.shapeType is "ellipse"', () => {
    expect(typeof shapeRep.videoForgeMetadata.shapeType).toBe('string');
    expect(shapeRep.videoForgeMetadata.shapeType).toBe(SHAPE_TYPES.ELLIPSE);
  });

  test('shape clip videoForgeMetadata.fillColor is #0000FF', () => {
    expect(shapeRep.videoForgeMetadata.fillColor).toBe('#0000FF');
  });

  test('shape clip videoForgeMetadata.shapeWidth and shapeHeight are numeric', () => {
    expect(typeof shapeRep.videoForgeMetadata.shapeWidth).toBe('number');
    expect(typeof shapeRep.videoForgeMetadata.shapeHeight).toBe('number');
    expect(shapeRep.videoForgeMetadata.shapeWidth).toBe(300);
    expect(shapeRep.videoForgeMetadata.shapeHeight).toBe(150);
  });

  test('shape clip type is "shape"', () => {
    expect(shapeRep.type).toBe('shape');
  });

  // ── Global sanity: no function references, no NaN, no undefined ────────────

  test('no scalar clip property is a function in any clip', () => {
    const PROPS = ['speed', 'volume', 'pan', 'opacity', 'rotation', 'reverse', 'mute'];
    for (const clip of itr.getAllClips()) {
      for (const prop of PROPS) {
        expect(typeof clip[prop]).not.toBe('function');
      }
    }
  });

  test('no numeric clip property is NaN in any clip', () => {
    const NUMERIC = ['speed', 'volume', 'pan', 'opacity', 'rotation'];
    for (const clip of itr.getAllClips()) {
      for (const prop of NUMERIC) {
        expect(clip[prop]).not.toBeNaN();
      }
    }
  });

  test('no numeric clip property is undefined in any clip', () => {
    const NUMERIC = ['speed', 'volume', 'pan', 'opacity', 'rotation'];
    for (const clip of itr.getAllClips()) {
      for (const prop of NUMERIC) {
        expect(clip[prop]).not.toBeUndefined();
      }
    }
  });

  test('position and scale are objects (not functions) in every clip', () => {
    for (const clip of itr.getAllClips()) {
      expect(typeof clip.position).not.toBe('function');
      expect(typeof clip.scale).not.toBe('function');
      expect(typeof clip.position).toBe('object');
      expect(typeof clip.scale).toBe('object');
    }
  });
});

// ─── Stage 3 — Premiere XML semantic correctness ──────────────────────────────

describe('Stage 3 — Premiere XML semantic correctness', () => {
  test('XML is produced (non-empty string)', () => {
    expect(typeof premiereXml).toBe('string');
    expect(premiereXml.length).toBeGreaterThan(100);
  });

  test('XML is well-formed (starts with declaration or <xmeml)', () => {
    const trimmed = premiereXml.trim();
    expect(
      trimmed.startsWith('<?xml') || trimmed.startsWith('<xmeml'),
    ).toBe(true);
  });

  test('29.97fps produces <timebase>30</timebase>', () => {
    expect(premiereXml).toContain('<timebase>30</timebase>');
  });

  test('29.97fps produces <ntsc>TRUE</ntsc>', () => {
    expect(premiereXml).toContain('<ntsc>TRUE</ntsc>');
  });

  test('29.97fps produces <displayformat>DF</displayformat>', () => {
    expect(premiereXml).toContain('<displayformat>DF</displayformat>');
  });

  test('XML contains <sequence> element', () => {
    expect(premiereXml).toContain('<sequence');
  });

  test('XML contains <clipitem> elements for video clips', () => {
    expect(premiereXml).toContain('<clipitem');
  });

  test('Premiere XML contains no function source code', () => {
    expect(premiereXml).not.toMatch(/function\s*\(/);
    expect(premiereXml).not.toContain('[Function');
    expect(premiereXml).not.toContain('_playbackRate');
    expect(premiereXml).not.toContain('_volumeLevel');
  });

  test('Premiere XML contains no [object Object] garbage', () => {
    expect(premiereXml).not.toContain('[object Object]');
  });

  test('Premiere XML contains no undefined or NaN text nodes', () => {
    expect(premiereXml).not.toMatch(/>\s*undefined\s*</);
    expect(premiereXml).not.toMatch(/>\s*NaN\s*</);
  });
});

// ─── Stage 4 — FCPXML semantic correctness ────────────────────────────────────

describe('Stage 4 — FCPXML semantic correctness', () => {
  test('FCPXML is produced (non-empty string)', () => {
    expect(typeof fcpxmlXml).toBe('string');
    expect(fcpxmlXml.length).toBeGreaterThan(100);
  });

  test('FCPXML contains version="1.10" declaration', () => {
    expect(fcpxmlXml).toContain('version="1.10"');
  });

  test('29.97fps produces frameDuration="1001/30000s"', () => {
    expect(fcpxmlXml).toContain('frameDuration="1001/30000s"');
  });

  test('29.97fps produces tcFormat="DF"', () => {
    expect(fcpxmlXml).toContain('tcFormat="DF"');
  });

  test('FCPXML contains <resources> section', () => {
    expect(fcpxmlXml).toContain('<resources>');
  });

  test('clip durations use rational form N/30000s for 29.97fps', () => {
    expect(fcpxmlXml).toMatch(/duration="\d+\/30000s"/);
  });

  test('FCPXML contains no function source code', () => {
    expect(fcpxmlXml).not.toMatch(/function\s*\(/);
    expect(fcpxmlXml).not.toContain('[Function');
    expect(fcpxmlXml).not.toContain('_playbackRate');
    expect(fcpxmlXml).not.toContain('_volumeLevel');
  });

  test('FCPXML contains no [object Object] garbage', () => {
    expect(fcpxmlXml).not.toContain('[object Object]');
  });

  test('FCPXML contains no undefined or NaN attribute values', () => {
    expect(fcpxmlXml).not.toMatch(/="\s*undefined\s*"/);
    expect(fcpxmlXml).not.toMatch(/="\s*NaN\s*"/);
  });
});

// ─── Stage 5 — EDL purity ─────────────────────────────────────────────────────

describe('Stage 5 — EDL purity', () => {
  test('EDL is produced (non-empty string)', () => {
    expect(typeof edlText).toBe('string');
    expect(edlText.length).toBeGreaterThan(20);
  });

  test('EDL starts with TITLE: line', () => {
    expect(edlText.trim()).toMatch(/^TITLE:/);
  });

  test('29.97fps EDL uses FCM: DROP FRAME', () => {
    expect(edlText).toContain('FCM: DROP FRAME');
  });

  test('29.97fps EDL timecodes use ; as drop-frame separator', () => {
    expect(edlText).toMatch(/\d{2}:\d{2}:\d{2};\d{2}/);
  });

  test('EDL contains no function source code', () => {
    expect(edlText).not.toMatch(/function\s*\(/);
    expect(edlText).not.toContain('[Function');
  });

  test('EDL contains no _playbackRate backing-field name', () => {
    expect(edlText).not.toContain('_playbackRate');
  });

  test('EDL contains no _volumeLevel backing-field name', () => {
    expect(edlText).not.toContain('_volumeLevel');
  });

  test('EDL contains no [object Object] garbage', () => {
    expect(edlText).not.toContain('[object Object]');
  });

  test('EDL contains no literal "undefined" or "NaN" tokens', () => {
    expect(edlText).not.toMatch(/\bundefined\b/);
    expect(edlText).not.toMatch(/\bNaN\b/);
  });

  test('EDL contains no null tokens', () => {
    expect(edlText).not.toMatch(/\bnull\b/);
  });
});

// ─── Stage 6 — Round-trip JSON fidelity ──────────────────────────────────────

describe('Stage 6 — Round-trip JSON fidelity', () => {
  let parsed;

  beforeAll(() => {
    parsed = JSON.parse(JSON.stringify(itr.toJSON()));
  });

  test('itr.toJSON() + JSON.stringify + JSON.parse does not throw', () => {
    expect(() => JSON.parse(JSON.stringify(itr.toJSON()))).not.toThrow();
  });

  test('parsed fps matches original 29.97', () => {
    expect(parsed.fps).toBe(FPS);
  });

  test('parsed width and height match original', () => {
    expect(parsed.width).toBe(1920);
    expect(parsed.height).toBe(1080);
  });

  test('parsed track count matches original (5 tracks)', () => {
    expect(parsed.tracks).toHaveLength(5);
  });

  test('parsed video track — vc1 has numeric speed=1.5 after JSON round-trip', () => {
    const videoTrack = parsed.tracks.find((t) => t.type === 'video');
    const clip = videoTrack.clips.find((c) => c.id === vc1.id);
    expect(typeof clip.speed).toBe('number');
    expect(clip.speed).toBe(1.5);
  });

  test('parsed video track — vc2 has reverse=true and mute=true after JSON round-trip', () => {
    const videoTrack = parsed.tracks.find((t) => t.type === 'video');
    const clip = videoTrack.clips.find((c) => c.id === vc2.id);
    expect(clip.reverse).toBe(true);
    expect(clip.mute).toBe(true);
  });

  test('parsed audio track — audioClip has numeric pan=0.7 after JSON round-trip', () => {
    const audioTrack = parsed.tracks.find((t) => t.type === 'audio');
    expect(typeof audioTrack.clips[0].pan).toBe('number');
    expect(audioTrack.clips[0].pan).toBe(0.7);
  });

  test('parsed image track — imgClip position and scale are objects with numeric x/y', () => {
    const imgTrack = parsed.tracks.find((t) => t.type === 'image');
    const clip = imgTrack.clips[0];
    expect(typeof clip.position.x).toBe('number');
    expect(typeof clip.position.y).toBe('number');
    expect(typeof clip.scale.x).toBe('number');
    expect(typeof clip.scale.y).toBe('number');
    expect(clip.position.x).toBe(200);
    expect(clip.position.y).toBe(300);
    expect(clip.scale.x).toBe(1.5);
    expect(clip.rotation).toBe(45);
  });

  test('parsed text track — videoForgeMetadata.text survives round-trip', () => {
    const textTrack = parsed.tracks.find((t) => t.type === 'text');
    expect(textTrack.clips[0].videoForgeMetadata.text).toBe('Hello World');
  });

  test('parsed text track — videoForgeMetadata.fontSize survives round-trip', () => {
    const textTrack = parsed.tracks.find((t) => t.type === 'text');
    expect(textTrack.clips[0].videoForgeMetadata.fontSize).toBe(72);
  });

  test('parsed shape track — videoForgeMetadata.shapeType survives round-trip', () => {
    const shapeTrack = parsed.tracks.find((t) => t.type === 'shape');
    expect(shapeTrack.clips[0].videoForgeMetadata.shapeType).toBe(SHAPE_TYPES.ELLIPSE);
  });

  test('parsed shape track — videoForgeMetadata.fillColor survives round-trip', () => {
    const shapeTrack = parsed.tracks.find((t) => t.type === 'shape');
    expect(shapeTrack.clips[0].videoForgeMetadata.fillColor).toBe('#0000FF');
  });

  test('JSON string contains no "undefined", "NaN", or "[object Object]" values', () => {
    const json = JSON.stringify(parsed);
    expect(json).not.toContain('"undefined"');
    expect(json).not.toContain(':undefined');
    expect(json).not.toContain('"NaN"');
    expect(json).not.toContain('"[object Object]"');
    expect(json).not.toContain('"function"');
  });
});
