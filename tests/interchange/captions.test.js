/**
 * @file captions.test.js
 * Tests for caption interchange: CaptionRepresentation, WebVTT export,
 * Premiere title generation, FCPXML title generation, and round-trip payload.
 */

import { describe, test, expect } from '@jest/globals';
import CaptionRepresentation from '../../src/interchange/CaptionRepresentation.js';
import Project from '../../src/core/Project.js';
import TimelineConverter from '../../src/interchange/TimelineConverter.js';
import PremiereXmlExporter from '../../src/exporters/PremiereXmlExporter.js';
import FcpxmlExporter from '../../src/exporters/FcpxmlExporter.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCaptionRep(transcript = 'Hello world', segments = []) {
  return new CaptionRepresentation({
    transcript,
    segments,
    style: { fontSize: 72, color: '#FFFFFF', bold: true },
    layout: { anchorPoint: 'bottom' },
    presetName: 'hormozi',
    videoForgePayload: { version: '1.0', test: true },
  });
}

function makeProjectWithCaption(text = 'Test caption') {
  const p = new Project({ name: 'Caption Export', fps: 30, width: 1920, height: 1080 });
  const vt = p.addTrack('video');
  vt.addVideo('/footage/main.mp4', { inPoint: 0, outPoint: 10 });
  const ct = p.addTrack('caption');
  ct.addCaption(text, { outPoint: 5 });
  return p;
}

// ─── CaptionRepresentation unit tests ────────────────────────────────────────

describe('CaptionRepresentation', () => {
  test('flattenToText() returns transcript when set', () => {
    const rep = makeCaptionRep('My transcript');
    expect(rep.flattenToText()).toBe('My transcript');
  });

  test('flattenToText() falls back to segments when no transcript', () => {
    const rep = new CaptionRepresentation({
      segments: [
        { words: [{ text: 'Hello' }, { text: 'world' }] },
        { words: [{ text: 'How' }, { text: 'are' }, { text: 'you' }] },
      ],
    });
    const text = rep.flattenToText();
    expect(text).toContain('Hello world');
    expect(text).toContain('How are you');
  });

  test('toWebVtt() returns WEBVTT header', () => {
    const rep = new CaptionRepresentation({
      segments: [
        { startTime: 0, endTime: 2, words: [{ text: 'Hello' }, { text: 'world' }] },
        { startTime: 2, endTime: 5, words: [{ text: 'Goodbye' }] },
      ],
    });
    const vtt = rep.toWebVtt();
    expect(vtt).toMatch(/^WEBVTT/);
    expect(vtt).toContain('Hello world');
    expect(vtt).toContain('Goodbye');
  });

  test('toWebVtt() cue times use HH:MM:SS.mmm format', () => {
    const rep = new CaptionRepresentation({
      segments: [
        { startTime: 65.5, endTime: 70, words: [{ text: 'Test' }] },
      ],
    });
    const vtt = rep.toWebVtt();
    expect(vtt).toContain('00:01:05.500');
  });

  test('toPremiereTitle() returns title descriptor object', () => {
    const rep = makeCaptionRep('Premiere Title');
    const title = rep.toPremiereTitle(0, 5);
    expect(title.type).toBe('motionTitle');
    expect(title.text).toBe('Premiere Title');
    expect(title.fontSize).toBe(72);
    expect(title.fontColor).toHaveProperty('r');
    expect(title.fontColor).toHaveProperty('g');
    expect(title.fontColor).toHaveProperty('b');
  });

  test('toPremiereTitle() fontColor is white for #FFFFFF', () => {
    const rep = makeCaptionRep('White text');
    const title = rep.toPremiereTitle(0, 5);
    expect(title.fontColor.r).toBeCloseTo(1, 2);
    expect(title.fontColor.g).toBeCloseTo(1, 2);
    expect(title.fontColor.b).toBeCloseTo(1, 2);
  });

  test('toFcpTitle() returns title descriptor object', () => {
    const rep = makeCaptionRep('FCP Title');
    const title = rep.toFcpTitle(0, 5, '-1');
    expect(title.type).toBe('title');
    expect(title.text).toBe('FCP Title');
    expect(title.lane).toBe('-1');
    expect(typeof title.fontSize).toBe('number');
  });

  test('toFcpTitle() verticalAlign=bottom for bottom anchor', () => {
    const rep = makeCaptionRep();
    const title = rep.toFcpTitle(0, 5);
    expect(title.verticalAlign).toBe('bottom');
  });

  test('toJSON() round-trips through JSON.parse(JSON.stringify())', () => {
    const rep = makeCaptionRep('Round trip');
    const json = JSON.parse(JSON.stringify(rep.toJSON()));
    expect(json.transcript).toBe('Round trip');
    expect(json.presetName).toBe('hormozi');
    expect(json.videoForgePayload).toBeDefined();
  });
});

// ─── CaptionRepresentation.fromCaptionClip() ─────────────────────────────────

describe('CaptionRepresentation.fromCaptionClip()', () => {
  test('builds from a CaptionClip via track.addCaption()', () => {
    const p  = new Project({ name: 'FromClip', fps: 30 });
    const ct = p.addTrack('caption');
    const captionClip = ct.addCaption('Dynamic text', { outPoint: 4 });

    const rep = CaptionRepresentation.fromCaptionClip(captionClip);
    expect(rep.transcript).toBe('Dynamic text');
    expect(rep.videoForgePayload).toBeDefined();
  });

  test('style is carried over', () => {
    const p  = new Project({ name: 'Style', fps: 30 });
    const ct = p.addTrack('caption');
    const captionClip = ct.addCaption('Styled', {
      outPoint: 4,
      style: { fontSize: 96 },
    });

    const rep = CaptionRepresentation.fromCaptionClip(captionClip);
    expect(rep.style).toBeDefined();
  });
});

// ─── Caption export via PremiereXmlExporter ───────────────────────────────────

describe('Caption export — Premiere XML', () => {
  test('project with captions produces valid XMEML without throwing', () => {
    const p   = makeProjectWithCaption('Hello from Premiere');
    const exp = new PremiereXmlExporter(p, { validateInput: false, validateOutput: false });
    expect(() => exp.toString()).not.toThrow();
  });

  test('XMEML output contains <generatoritem> for captions', () => {
    const p   = makeProjectWithCaption('Title Text');
    const exp = new PremiereXmlExporter(p, { validateInput: false, validateOutput: false });
    const xml = exp.toString();
    expect(xml).toContain('<generatoritem');
  });

  test('caption text appears inside <value> element', () => {
    const p   = makeProjectWithCaption('Unique Caption 12345');
    const exp = new PremiereXmlExporter(p, { validateInput: false, validateOutput: false });
    const xml = exp.toString();
    expect(xml).toContain('Unique Caption 12345');
  });
});

// ─── Caption export via FcpxmlExporter ───────────────────────────────────────

describe('Caption export — FCPXML', () => {
  test('project with captions produces valid FCPXML without throwing', () => {
    const p   = makeProjectWithCaption('Hello from FCP');
    const exp = new FcpxmlExporter(p, { validateInput: false, validateOutput: false });
    expect(() => exp.toString()).not.toThrow();
  });

  test('FCPXML output contains <title> for captions', () => {
    const p   = makeProjectWithCaption('FCP Caption');
    const exp = new FcpxmlExporter(p, { validateInput: false, validateOutput: false });
    const xml = exp.toString();
    expect(xml).toContain('<title');
  });

  test('caption text appears in title element', () => {
    const p   = makeProjectWithCaption('Unique FCP Caption 67890');
    const exp = new FcpxmlExporter(p, { validateInput: false, validateOutput: false });
    const xml = exp.toString();
    expect(xml).toContain('Unique FCP Caption 67890');
  });
});

// ─── EDL caption handling ────────────────────────────────────────────────────

describe('Caption export — EDL', () => {
  test('EDL caption comment is emitted for caption clips', async () => {
    const { default: EdlExporter } = await import('../../src/exporters/EdlExporter.js');
    const p  = makeProjectWithCaption('EDL Test');
    const exp = new EdlExporter(p, { validateInput: false });
    const edl = exp.toString();
    expect(edl).toContain('not representable in EDL');
  });
});
