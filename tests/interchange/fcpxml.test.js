/**
 * @file fcpxml.test.js
 * Tests for FcpxmlExporter — FCPXML 1.10 output.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import Project from '../../src/core/Project.js';
import FcpxmlExporter from '../../src/exporters/FcpxmlExporter.js';
import XmlValidator from '../../src/interchange/utils/XmlValidator.js';
import TimeCode from '../../src/interchange/utils/TimeCode.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProject(fps = 30) {
  const p = new Project({ name: 'FCP Test', fps, width: 1920, height: 1080 });
  const vt = p.addTrack('video', { name: 'V1' });
  vt.addVideo('/footage/main.mp4', { inPoint: 0, outPoint: 10 });
  vt.addVideo('/footage/broll.mp4', { inPoint: 5, outPoint: 15 });
  const at = p.addTrack('audio', { name: 'A1' });
  at.addAudio('/audio/narration.wav', { inPoint: 0, outPoint: 20 });
  return p;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FcpxmlExporter', () => {
  let project;
  let exporter;

  beforeEach(() => {
    project  = makeProject();
    exporter = new FcpxmlExporter(project, { validateInput: false, validateOutput: false });
  });

  test('toString() returns a non-empty string', () => {
    const xml = exporter.toString();
    expect(typeof xml).toBe('string');
    expect(xml.length).toBeGreaterThan(0);
  });

  test('output starts with XML declaration', () => {
    const xml = exporter.toString();
    expect(xml.trim()).toMatch(/^<\?xml/);
  });

  test('root element is <fcpxml version="1.10">', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<fcpxml version="1.10">');
  });

  test('output contains <resources>', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<resources>');
  });

  test('output contains <library>', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<library');
  });

  test('output contains <event>', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<event');
  });

  test('output contains <project>', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<project');
  });

  test('output contains <sequence>', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<sequence');
  });

  test('output contains <spine>', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<spine>');
  });

  test('output contains <format> in resources', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<format');
  });

  test('format element has frameDuration attribute', () => {
    const xml = exporter.toString();
    expect(xml).toMatch(/frameDuration="[^"]+"/);
  });

  test('output contains <asset> elements for video clips', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<asset');
  });

  test('asset elements have src attribute', () => {
    const xml = exporter.toString();
    expect(xml).toMatch(/src="file:\/\//);
  });

  test('output contains <clip> elements in spine', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<clip');
  });

  test('clip elements have offset and duration in rational format', () => {
    const xml = exporter.toString();
    expect(xml).toMatch(/offset="\d+\/\d+s"/);
    expect(xml).toMatch(/duration="\d+\/\d+s"/);
  });

  test('rational time values end with "s"', () => {
    const xml = exporter.toString();
    const timeAttrs = xml.match(/(?:offset|duration|start|tcStart)="([^"]+)"/g) ?? [];
    for (const attr of timeAttrs) {
      const val = attr.replace(/.*="/, '').replace(/"$/, '');
      expect(val).toMatch(/^\d+(?:\/\d+)?s$|^0s$/);
    }
  });

  test('output passes XmlValidator.validateFcpXml()', () => {
    const xml = exporter.toString();
    const validator = new XmlValidator();
    const result = validator.validateFcpXml(xml);
    expect(result.errors).toEqual([]);
  });

  test('project name appears in output', () => {
    const xml = exporter.toString();
    expect(xml).toContain('FCP Test');
  });

  test('frameDuration is correct for 30fps', () => {
    const xml = exporter.toString();
    expect(xml).toContain(`frameDuration="${TimeCode.fcpFrameDuration(30)}"`);
  });

  test('frameDuration is correct for 23.976fps', () => {
    const p2 = new Project({ name: 'Cinema', fps: 23.976 });
    p2.addTrack('video').addVideo('/a.mp4', { inPoint: 0, outPoint: 10 });
    const exp2 = new FcpxmlExporter(p2, { validateInput: false, validateOutput: false });
    const xml  = exp2.toString();
    expect(xml).toContain(`frameDuration="${TimeCode.fcpFrameDuration(23.976)}"`);
  });

  test('audio-only clips emit <audio-clip> elements', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<audio-clip');
  });

  test('libraryName and eventName options are honoured', () => {
    const exp2 = new FcpxmlExporter(project, {
      libraryName: 'My Library',
      eventName:   'My Event',
      validateInput: false,
      validateOutput: false,
    });
    const xml = exp2.toString();
    expect(xml).toContain('My Library');
    expect(xml).toContain('My Event');
  });
});

describe('FcpxmlExporter — caption / title clip', () => {
  test('caption clips produce <title> elements', () => {
    const p  = new Project({ name: 'Caption Test', fps: 30 });
    const vt = p.addTrack('video');
    vt.addVideo('/footage/main.mp4', { inPoint: 0, outPoint: 10 });
    const ct = p.addTrack('caption');
    ct.addCaption('Hello World', { outPoint: 5 });

    const exp = new FcpxmlExporter(p, { validateInput: false, validateOutput: false });
    const xml = exp.toString();
    expect(xml).toContain('<title');
  });
});
