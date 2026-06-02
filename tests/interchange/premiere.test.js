/**
 * @file premiere.test.js
 * Tests for PremiereXmlExporter — XMEML v5 output.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import Project from '../../src/core/Project.js';
import PremiereXmlExporter from '../../src/exporters/PremiereXmlExporter.js';
import TimelineConverter from '../../src/interchange/TimelineConverter.js';
import XmlValidator from '../../src/interchange/utils/XmlValidator.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProject() {
  const p = new Project({ name: 'Test Project', fps: 30, width: 1920, height: 1080 });
  const vt = p.addTrack('video', { name: 'Video 1' });
  vt.addVideo('/footage/clip_a.mp4', { inPoint: 0, outPoint: 5, duration: 5 });
  vt.addVideo('/footage/clip_b.mp4', { inPoint: 2, outPoint: 8, duration: 6 });
  const at = p.addTrack('audio', { name: 'Audio 1' });
  at.addAudio('/audio/music.wav', { inPoint: 0, outPoint: 30 });
  return p;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PremiereXmlExporter', () => {
  let project;
  let exporter;

  beforeEach(() => {
    project  = makeProject();
    exporter = new PremiereXmlExporter(project, { validateInput: false, validateOutput: false });
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

  test('output contains DOCTYPE xmeml', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<!DOCTYPE xmeml>');
  });

  test('root element is <xmeml version="5">', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<xmeml version="5">');
  });

  test('output contains <sequence>', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<sequence');
  });

  test('output contains project name in <name>', () => {
    const xml = exporter.toString();
    expect(xml).toContain('Test Project');
  });

  test('output contains <video> and <audio> sections', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<video>');
    expect(xml).toContain('<audio>');
  });

  test('output contains <rate> with <timebase>', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<timebase>30</timebase>');
  });

  test('output contains <track> elements', () => {
    const xml = exporter.toString();
    expect(xml).toMatch(/<track>/);
  });

  test('output contains <clipitem> elements with IDs', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<clipitem');
  });

  test('output contains <file> elements for assets', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<file');
  });

  test('output contains <pathurl> for each asset', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<pathurl>');
  });

  test('output passes XmlValidator.validatePremiereXml()', () => {
    const exporter2 = new PremiereXmlExporter(project, { validateInput: false, validateOutput: false });
    const xml = exporter2.toString();
    const validator = new XmlValidator();
    const result = validator.validatePremiereXml(xml);
    expect(result.errors).toEqual([]);
  });

  test('includes NDF timecode for 30fps', () => {
    const xml = exporter.toString();
    expect(xml).toContain('<displayformat>NDF</displayformat>');
  });

  test('uses DF timecode for 29.97fps project', () => {
    const p2 = new Project({ name: 'NTSC', fps: 29.97 });
    p2.addTrack('video').addVideo('/footage/a.mp4', { inPoint: 0, outPoint: 5 });
    const exp2 = new PremiereXmlExporter(p2, { validateInput: false, validateOutput: false });
    const xml = exp2.toString();
    expect(xml).toContain('<displayformat>DF</displayformat>');
    expect(xml).toContain('<ntsc>TRUE</ntsc>');
  });

  test('emits VideoForge metadata block when includeVfMetadata=true', () => {
    const xml = exporter.toString();
    expect(xml).toContain('vf:metadata');
    expect(xml).toContain('VideoForge');
  });

  test('omits VideoForge metadata when includeVfMetadata=false', () => {
    const exp2 = new PremiereXmlExporter(project, {
      includeVfMetadata: false,
      validateInput: false,
      validateOutput: false,
    });
    const xml = exp2.toString();
    expect(xml).not.toContain('vf:metadata');
  });

  test('sequenceName option overrides the sequence name', () => {
    const exp2 = new PremiereXmlExporter(project, {
      sequenceName: 'My Custom Sequence',
      validateInput: false,
      validateOutput: false,
    });
    const xml = exp2.toString();
    expect(xml).toContain('My Custom Sequence');
  });

  test('clip start/end frames are integers in output', () => {
    const xml = exporter.toString();
    const startMatches = xml.match(/<start>(\d+)<\/start>/g);
    expect(startMatches).not.toBeNull();
    startMatches.forEach((m) => {
      const val = m.replace(/<\/?start>/g, '');
      expect(Number.isInteger(Number(val))).toBe(true);
    });
  });
});

describe('PremiereXmlExporter — TimelineConverter integration', () => {
  test('TimelineConverter produces an ITR from a minimal project', () => {
    const p  = new Project({ name: 'Minimal', fps: 24 });
    const t  = p.addTrack('video');
    t.addVideo('/clip.mp4', { inPoint: 0, outPoint: 10 });

    const converter = new TimelineConverter();
    const itr = converter.convert(p);

    expect(itr.fps).toBe(24);
    expect(itr.tracks.length).toBeGreaterThan(0);
    expect(itr.assets.length).toBeGreaterThan(0);
  });

  test('Exporter uses ITR to generate correct clip count', () => {
    const p = new Project({ name: 'Multi', fps: 30 });
    const t = p.addTrack('video');
    t.addVideo('/a.mp4', { inPoint: 0, outPoint: 5 });
    t.addVideo('/b.mp4', { inPoint: 0, outPoint: 5 });
    t.addVideo('/c.mp4', { inPoint: 0, outPoint: 5 });

    const exp = new PremiereXmlExporter(p, { validateInput: false, validateOutput: false });
    const xml = exp.toString();

    const clipItems = xml.match(/<clipitem /g) ?? [];
    expect(clipItems.length).toBeGreaterThanOrEqual(3);
  });
});
