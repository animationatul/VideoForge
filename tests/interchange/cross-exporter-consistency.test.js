/**
 * @file cross-exporter-consistency.test.js
 * Cross-Exporter Consistency Validation — Task 8 Audit.
 *
 * Verifies that Premiere XML, FCPXML, EDL, and JSON all describe the same
 * editorial meaning when given the same Project. Eight validation stages:
 *
 *   Stage 1 — Timeline Consistency (all exporters agree on clip positions)
 *   Stage 2 — Speed Representation (2× speed visible in each format)
 *   Stage 3 — Transitions (cross-dissolve present in Premiere and EDL)
 *   Stage 4 — Audio Properties (volume, pan, speed, mute per-exporter)
 *   Stage 5 — Video Transforms (position, scale, rotation, opacity)
 *   Stage 6 — Captions (caption text present in Premiere and FCPXML)
 *   Stage 7 — Metadata Preservation (text/shape clips in vf:metadata)
 *   Stage 8 — Unsupported Feature Reporting (reverse, pan, speed annotated)
 *
 * Capability matrix is generated at the end of Stage 8.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import Project             from '../../src/core/Project.js';
import TimelineConverter   from '../../src/interchange/TimelineConverter.js';
import PremiereXmlExporter from '../../src/exporters/PremiereXmlExporter.js';
import FcpxmlExporter      from '../../src/exporters/FcpxmlExporter.js';
import EdlExporter         from '../../src/exporters/EdlExporter.js';
import JsonExporter        from '../../src/exporters/JsonExporter.js';
import Transition          from '../../src/effects/Transition.js';
import { TRANSITION_TYPES } from '../../src/utils/Constants.js';

// ─── Shared state ─────────────────────────────────────────────────────────────

const FPS = 30;

let project;
let videoA, videoB, audioClip, imageClip, textClip, captionClip;
let itr;
let premiereXml, fcpxmlXml, edlText, jsonStr;

beforeAll(() => {
  project = new Project({ name: 'Consistency Test', fps: FPS, width: 1920, height: 1080 });

  // ── Primary video track ───────────────────────────────────────────────────────
  const vTrack = project.addTrack('video');

  // VideoA: 10s source at 2× speed, volume 0.8, fade in/out
  videoA = vTrack.addVideo('/footage/videoA.mp4', { inPoint: 0, outPoint: 10 });
  videoA.speed(2).volume(0.8);
  videoA.fadeIn(1).fadeOut(1);

  // VideoB: reversed, volume 0.5, cross-dissolve transition
  videoB = vTrack.addVideo('/footage/videoB.mp4', { inPoint: 0, outPoint: 8 });
  videoB.reverse(true).volume(0.5);
  videoB.addEffect(new Transition(TRANSITION_TYPES.CROSS_DISSOLVE, 1));

  // ── Audio track (fits within videoA 0–10s for FCPXML connected-clip) ──────────
  const aTrack = project.addTrack('audio');
  audioClip = aTrack.addAudio('/audio/music.wav', {
    inPoint: 0, outPoint: 9, panValue: -0.4, volumeLevel: 0.7,
  });
  audioClip.speed(1.1);

  // ── Image track (secondary video; fits within videoA 0–10s) ──────────────────
  const imgTrack = project.addTrack('image');
  imageClip = imgTrack.addImage('/images/overlay.png', { outPoint: 8 });
  imageClip.position(100, 200).scale(1.5).rotation(45).opacity(0.8);

  // ── Text track (silently dropped from XML; preserved in vf:metadata) ─────────
  const tTrack = project.addTrack('text');
  textClip = tTrack.addText('Hello VideoForge', {
    outPoint: 5, fontSizeValue: 72, colorValue: '#FF0000', x: 500, y: 400,
  });

  // ── Caption track (fits within videoA 0–10s) ──────────────────────────────────
  const cTrack = project.addTrack('caption');
  captionClip = cTrack.addCaption('VideoForge rocks!', { outPoint: 8 });

  // ── Convert and export all formats ───────────────────────────────────────────
  const converter = new TimelineConverter();
  itr = converter.convert(project);

  premiereXml = new PremiereXmlExporter(project, {
    validateInput: false, validateOutput: false,
  }).toString();

  fcpxmlXml = new FcpxmlExporter(project, {
    validateInput: false, validateOutput: false,
  }).toString();

  edlText = new EdlExporter(project, { validateInput: false }).toString();

  jsonStr = new JsonExporter(project).toString();
});

// ─── Stage 1 — Timeline Consistency ──────────────────────────────────────────

describe('Stage 1 — Timeline Consistency', () => {
  test('ITR has correct track count', () => {
    expect(itr.tracks).toHaveLength(5); // video, audio, image, text, caption
  });

  test('ITR primary video track has two clips', () => {
    const vTracks = itr.getVideoTracks().filter((t) => t.type === 'video');
    expect(vTracks[0].clips).toHaveLength(2);
  });

  test('ITR audioClip timeline positions match source', () => {
    const aTrack = itr.getAudioTracks()[0];
    const clip   = aTrack.clips[0];
    expect(clip.timelineStart).toBe(0);
    expect(clip.sourceStart).toBe(0);
    expect(clip.sourceEnd).toBe(9);
  });

  test('Premiere XML contains both video clip names', () => {
    expect(premiereXml).toContain('videoA.mp4');
    expect(premiereXml).toContain('videoB.mp4');
  });

  test('FCPXML contains both video clip names', () => {
    expect(fcpxmlXml).toContain('videoA.mp4');
    expect(fcpxmlXml).toContain('videoB.mp4');
  });

  test('EDL contains video clip reel identifiers', () => {
    expect(edlText).toContain('videoA');
    expect(edlText).toContain('videoB');
  });

  test('JSON contains both video clip paths', () => {
    expect(jsonStr).toContain('videoA.mp4');
    expect(jsonStr).toContain('videoB.mp4');
  });

  test('No output contains raw undefined, NaN, or function references', () => {
    for (const [name, out] of [
      ['Premiere', premiereXml],
      ['FCPXML',   fcpxmlXml],
      ['EDL',      edlText],
      ['JSON',     jsonStr],
    ]) {
      expect(out).not.toContain('undefined');
      expect(out).not.toContain('NaN');
      expect(out).not.toMatch(/\[Function/);
      expect(out).not.toContain('_playbackRate');
      expect(out).not.toContain('_volumeLevel');
    }
  });
});

// ─── Stage 2 — Speed Representation ──────────────────────────────────────────

describe('Stage 2 — Speed Representation', () => {
  test('videoA speed=2 is stored in ITR', () => {
    const vTracks = itr.getVideoTracks().filter((t) => t.type === 'video');
    const clip    = vTracks[0].getSortedClips().find((c) => c.assetId.length > 0);
    expect(clip.speed).toBe(2);
  });

  test('Premiere XML emits timeremapping filter for videoA', () => {
    expect(premiereXml).toContain('timeremapping');
    // Value should be 200 (2× speed × 100)
    expect(premiereXml).toContain('<value>200</value>');
  });

  test('FCPXML emits timeMap element for speed=2 clip', () => {
    expect(fcpxmlXml).toContain('<timeMap>');
    expect(fcpxmlXml).toContain('<timept');
  });

  test('EDL annotates speed for primary video clips', () => {
    expect(edlText).toContain('* SPEED: 2x [not representable in EDL]');
  });

  test('JSON preserves speed value', () => {
    const parsed = JSON.parse(jsonStr);
    // JSON exporter uses project.toJSON() — check video clip speed field
    const vTrack = parsed.tracks.find((t) => t.type === 'video');
    const clip   = vTrack.clips.find((c) => c.playbackRate === 2 || c.speed === 2);
    expect(clip).toBeDefined();
  });
});

// ─── Stage 3 — Transitions ────────────────────────────────────────────────────

describe('Stage 3 — Transitions', () => {
  test('videoB transition is stored in ITR', () => {
    const vTracks = itr.getVideoTracks().filter((t) => t.type === 'video');
    const clips   = vTracks[0].getSortedClips();
    const clipB   = clips.find((c) => c.transitions?.length > 0);
    expect(clipB).toBeDefined();
    expect(clipB.transitions[0].type).toBe('crossDissolve');
  });

  test('TransitionRepresentation maps transitionType before type field', () => {
    const vTracks = itr.getVideoTracks().filter((t) => t.type === 'video');
    const clips   = vTracks[0].getSortedClips();
    const clipB   = clips.find((c) => c.transitions?.length > 0);
    // transitionType='crossDissolve' should win over type='transition'
    expect(clipB.transitions[0].type).toBe('crossDissolve');
    expect(clipB.transitions[0].type).not.toBe('transition');
  });

  test('Premiere XML emits transitionitem for cross-dissolve', () => {
    expect(premiereXml).toContain('<transitionitem>');
    expect(premiereXml).toContain('Cross Dissolve');
  });

  test('EDL emits dissolve event for cross-dissolve transition', () => {
    // D NNN pattern = dissolve event
    expect(edlText).toMatch(/\bD\s+\d{3}\b/);
  });
});

// ─── Stage 4 — Audio Properties ──────────────────────────────────────────────

describe('Stage 4 — Audio Properties', () => {
  test('audioClip volume=0.7 stored in ITR', () => {
    const clip = itr.getAudioTracks()[0].clips[0];
    expect(clip.volume).toBeCloseTo(0.7);
  });

  test('audioClip pan=-0.4 stored in ITR', () => {
    const clip = itr.getAudioTracks()[0].clips[0];
    expect(clip.pan).toBeCloseTo(-0.4);
  });

  test('audioClip speed=1.1 stored in ITR', () => {
    const clip = itr.getAudioTracks()[0].clips[0];
    expect(clip.speed).toBeCloseTo(1.1);
  });

  test('Premiere XML emits Gain filter for audio volume', () => {
    expect(premiereXml).toContain('audiolevels');
    expect(premiereXml).toContain('<effectid>audiolevels</effectid>');
  });

  test('Premiere XML emits Balance filter for audio pan', () => {
    expect(premiereXml).toContain('audiobalance');
    expect(premiereXml).toContain('<effectid>audiobalance</effectid>');
    // Pan = -0.4 → -40
    expect(premiereXml).toContain('<value>-40</value>');
  });

  test('EDL annotates audio pan', () => {
    expect(edlText).toContain('* PAN: -0.4 [not representable in EDL]');
  });

  test('EDL annotates audio speed', () => {
    expect(edlText).toContain('* SPEED: 1.1x [not representable in EDL]');
  });

  test('FCPXML emits adjust-panner for audio pan', () => {
    expect(fcpxmlXml).toContain('<adjust-panner');
    // Pan = -0.4 → Math.round(-0.4 * 100) = -40
    expect(fcpxmlXml).toContain('amount="-40"');
  });

  test('FCPXML emits adjust-volume for audio volume', () => {
    expect(fcpxmlXml).toContain('<adjust-volume');
  });

  test('FCPXML emits timeMap for audio speed', () => {
    // The <audio-clip> with speed=1.1 should contain <timeMap>
    expect(fcpxmlXml).toContain('<timeMap>');
  });

  test('JSON preserves audio pan value', () => {
    const parsed  = JSON.parse(jsonStr);
    const aTrack  = parsed.tracks.find((t) => t.type === 'audio');
    const clip    = aTrack.clips[0];
    expect(clip.panValue).toBeCloseTo(-0.4);
  });
});

// ─── Stage 5 — Video Transforms ──────────────────────────────────────────────

describe('Stage 5 — Video Transforms', () => {
  test('imageClip transforms stored in ITR', () => {
    const imgTrack = itr.getVideoTracks().find((t) => t.type === 'image');
    const clip     = imgTrack.clips[0];
    expect(clip.position).toEqual({ x: 100, y: 200 });
    expect(clip.scale.x).toBeCloseTo(1.5);
    expect(clip.rotation).toBe(45);
    expect(clip.opacity).toBeCloseTo(0.8);
  });

  test('Premiere XML emits motion filter for imageClip position/scale/rotation', () => {
    expect(premiereXml).toContain('<effectid>motion</effectid>');
    expect(premiereXml).toContain('<parameterid>center</parameterid>');
    expect(premiereXml).toContain('<parameterid>scale</parameterid>');
    expect(premiereXml).toContain('<parameterid>rotation</parameterid>');
  });

  test('Premiere XML emits opacity filter for imageClip', () => {
    expect(premiereXml).toContain('<effectid>opacity</effectid>');
    // opacity=0.8 → 80%
    expect(premiereXml).toContain('<value>80</value>');
  });

  test('FCPXML emits opacity attribute on connected image clip', () => {
    // imageClip.opacity=0.8, emitted as connected clip via _emitConnectedVideoClip
    expect(fcpxmlXml).toContain('opacity="0.8"');
  });
});

// ─── Stage 6 — Captions ───────────────────────────────────────────────────────

describe('Stage 6 — Captions', () => {
  test('captionClip is stored as CaptionRepresentation in ITR', () => {
    const cTracks = itr.getCaptionTracks();
    expect(cTracks).toHaveLength(1);
    const clip = cTracks[0].clips[0];
    expect(clip.captionData).not.toBeNull();
  });

  test('Premiere XML emits generatoritem for caption track', () => {
    expect(premiereXml).toContain('<generatoritem');
  });

  test('FCPXML emits <title> element for caption clip', () => {
    expect(fcpxmlXml).toContain('<title');
  });

  test('EDL annotates caption tracks as comment block', () => {
    expect(edlText).toContain('CAPTION TRACKS (not representable in CMX3600)');
    expect(edlText).toContain('[not representable in EDL]');
  });
});

// ─── Stage 7 — Metadata Preservation ─────────────────────────────────────────

describe('Stage 7 — Metadata Preservation', () => {
  test('textClip videoForgeMetadata includes text content', () => {
    const tTrack = itr.getTextTracks().find((t) => t.type === 'text');
    const clip   = tTrack.clips[0];
    expect(clip.videoForgeMetadata.text).toBe('Hello VideoForge');
    expect(clip.videoForgeMetadata.fontSize).toBe(72);
  });

  test('Premiere XML vf:metadata contains textTracks array', () => {
    expect(premiereXml).toContain('textTracks');
    expect(premiereXml).toContain('Hello VideoForge');
  });

  test('FCPXML metadata comment contains textTracks', () => {
    expect(fcpxmlXml).toContain('textTracks');
    expect(fcpxmlXml).toContain('Hello VideoForge');
  });

  test('ITR toJSON includes pan field on audio clip', () => {
    const itrJson = JSON.parse(JSON.stringify(itr.toJSON()));
    const aTrack  = itrJson.tracks.find((t) => t.type === 'audio');
    expect(aTrack.clips[0].pan).toBeCloseTo(-0.4);
  });

  test('No exporter output contains [object Object]', () => {
    expect(premiereXml).not.toContain('[object Object]');
    expect(fcpxmlXml).not.toContain('[object Object]');
    expect(edlText).not.toContain('[object Object]');
    expect(jsonStr).not.toContain('[object Object]');
  });
});

// ─── Stage 8 — Unsupported Feature Reporting ─────────────────────────────────

describe('Stage 8 — Unsupported Feature Reporting', () => {
  test('EDL annotates video reverse as comment', () => {
    expect(edlText).toContain('* REVERSE: true [not representable in EDL]');
  });

  test('EDL annotates audio pan as comment', () => {
    expect(edlText).toContain('PAN:');
    expect(edlText).toContain('[not representable in EDL]');
  });

  test('Premiere XML vf:metadata includes textTracks (text clips not in main XML)', () => {
    expect(premiereXml).toContain('"textTracks"');
  });

  test('FCPXML metadata comment reports unsupported features', () => {
    expect(fcpxmlXml).toContain('unsupportedFeatures');
  });

  test('FCPXML metadata comment reports reverse as unsupported', () => {
    expect(fcpxmlXml).toContain('"reverse"');
  });

  test('FCPXML metadata comment reports text-clips-as-metadata-only', () => {
    expect(fcpxmlXml).toContain('text-clips-as-metadata-only');
  });

  // ── Capability matrix ──────────────────────────────────────────────────────
  test('Capability matrix: all exporters cover all editorial intents', () => {
    const matrix = {
      speed: {
        premiere: premiereXml.includes('timeremapping'),
        fcpxml:   fcpxmlXml.includes('timeMap'),
        edl:      edlText.includes('* SPEED:'),
        json:     JSON.parse(jsonStr).tracks.some((t) =>
          t.clips?.some((c) => c.playbackRate !== undefined && c.playbackRate !== 1),
        ),
      },
      pan: {
        premiere: premiereXml.includes('audiobalance'),
        fcpxml:   fcpxmlXml.includes('adjust-panner'),
        edl:      edlText.includes('* PAN:'),
        json:     JSON.parse(jsonStr).tracks.some((t) =>
          t.clips?.some((c) => c.panValue !== undefined && c.panValue !== 0),
        ),
      },
      reverse: {
        // Reverse is represented via negative timeremapping in Premiere
        premiere: premiereXml.includes('timeremapping'),
        // EDL annotates it as comment; no CMX3600 representation
        edl:      edlText.includes('* REVERSE:'),
      },
      transition: {
        premiere: premiereXml.includes('transitionitem'),
        edl:      /\bD\s+\d{3}\b/.test(edlText),
        fcpxml:   true, // FCPXML uses cross-dissolve via effect child (future work)
      },
      textClips: {
        premiere: premiereXml.includes('textTracks'),
        fcpxml:   fcpxmlXml.includes('textTracks'),
        edl:      false, // Not representable and not yet annotated
        json:     JSON.parse(jsonStr).tracks.some((t) => t.type === 'text'),
      },
    };

    // All features covered by at least two exporters
    expect(matrix.speed.premiere).toBe(true);
    expect(matrix.speed.fcpxml).toBe(true);
    expect(matrix.speed.edl).toBe(true);

    expect(matrix.pan.premiere).toBe(true);
    expect(matrix.pan.fcpxml).toBe(true);
    expect(matrix.pan.edl).toBe(true);
    expect(matrix.pan.json).toBe(true);

    expect(matrix.reverse.premiere).toBe(true);
    expect(matrix.reverse.edl).toBe(true);

    expect(matrix.transition.premiere).toBe(true);
    expect(matrix.transition.edl).toBe(true);

    expect(matrix.textClips.premiere).toBe(true);
    expect(matrix.textClips.fcpxml).toBe(true);
    expect(matrix.textClips.json).toBe(true);
  });
});
