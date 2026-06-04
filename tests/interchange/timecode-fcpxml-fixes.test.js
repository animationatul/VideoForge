/**
 * @file timecode-fcpxml-fixes.test.js
 * Regression tests for two targeted bug fixes:
 *
 *   Bug 1 — TimeCode.fromFrames NTSC precision:
 *     For 29.97 and 59.94 fps, fromFrames() previously divided by the exact
 *     rational rate (frames * 1001 / 30000), introducing a systematic ~0.1%
 *     bias that caused the seconds→frames→seconds round-trip to fail.
 *
 *   Bug 2 — FcpxmlExporter audio clip emission:
 *     Audio clips whose duration extends beyond a spine clip's window were
 *     never emitted because the filter required timelineEnd ≤ primaryEnd.
 *     Fixed to "starts within" semantics.
 */

import { describe, test, expect } from '@jest/globals';
import TimeCode from '../../src/interchange/utils/TimeCode.js';
import Project from '../../src/core/Project.js';
import FcpxmlExporter from '../../src/exporters/FcpxmlExporter.js';

const OPT = { validateInput: false, validateOutput: false };

// ─── Bug 1: TimeCode NTSC round-trip precision ────────────────────────────────

describe('TimeCode — NTSC fromFrames round-trip precision', () => {

  // ─── 29.97 fps ──────────────────────────────────────────────────────────────

  test('29.97fps — 5s round-trips losslessly via frames', () => {
    const tc     = new TimeCode(5, 29.97);
    const frames = tc.toFrames();
    const back   = TimeCode.fromFrames(frames, 29.97);
    expect(back.seconds).toBeCloseTo(5, 6);
  });

  test('29.97fps — toFrames(5s) = 150 (nominal 30fps grid)', () => {
    expect(new TimeCode(5, 29.97).toFrames()).toBe(150);
  });

  test('29.97fps — fromFrames(150) = 5.0 exactly', () => {
    expect(TimeCode.fromFrames(150, 29.97).seconds).toBe(5);
  });

  test('29.97fps — DF 1 hour = 01:00:00;00', () => {
    expect(new TimeCode(3600, 29.97).toSmpteDf()).toBe('01:00:00;00');
  });

  test('29.97fps — NDF 1s = 00:00:01:00', () => {
    expect(new TimeCode(1, 29.97).toSmpteNdf()).toBe('00:00:01:00');
  });

  test('29.97fps — toFrames at 2 hours = 215784', () => {
    // Math.round(7200 * 30000/1001) = Math.round(215784.215...) = 215784
    const frames = new TimeCode(7200, 29.97).toFrames();
    expect(frames).toBe(215784);
  });

  test('29.97fps — DF timecode at 10 min = 00:10:00;00', () => {
    // 10 minutes in DF. Drop-frame drops 2 frames at start of each non-10th minute.
    // Frames at 10 min = 17982 (framesPer10Min).
    expect(new TimeCode(600, 29.97).toSmpteDf()).toBe('00:10:00;00');
  });

  test('29.97fps — DF timecode at 30 min = 00:30:00;00', () => {
    expect(new TimeCode(1800, 29.97).toSmpteDf()).toBe('00:30:00;00');
  });

  // ─── 59.94 fps ──────────────────────────────────────────────────────────────

  test('59.94fps — 5s round-trips losslessly via frames', () => {
    const tc     = new TimeCode(5, 59.94);
    const frames = tc.toFrames();
    const back   = TimeCode.fromFrames(frames, 59.94);
    expect(back.seconds).toBeCloseTo(5, 6);
  });

  test('59.94fps — toFrames(5s) = 300 (nominal 60fps grid)', () => {
    expect(new TimeCode(5, 59.94).toFrames()).toBe(300);
  });

  test('59.94fps — fromFrames(300) = 5.0 exactly', () => {
    expect(TimeCode.fromFrames(300, 59.94).seconds).toBe(5);
  });

  test('59.94fps — DF 1 hour = 01:00:00;00', () => {
    expect(new TimeCode(3600, 59.94).toSmpteDf()).toBe('01:00:00;00');
  });

  test('59.94fps — NDF 1s = 00:00:01:00', () => {
    expect(new TimeCode(1, 59.94).toSmpteNdf()).toBe('00:00:01:00');
  });

  // ─── Integer fps unaffected ─────────────────────────────────────────────────

  test.each([24, 25, 30, 50, 60])(
    '%ifps — 5s round-trips losslessly via frames',
    (fps) => {
      const tc     = new TimeCode(5, fps);
      const frames = tc.toFrames();
      const back   = TimeCode.fromFrames(frames, fps);
      expect(back.seconds).toBeCloseTo(5, 6);
    },
  );
});

// ─── Bug 2: FcpxmlExporter audio clip emission ────────────────────────────────

describe('FcpxmlExporter — audio clip emission', () => {

  function makeProjectWithAudio() {
    const p  = new Project({ name: 'Audio Test', fps: 30, width: 1920, height: 1080 });
    const vt = p.addTrack('video');
    vt.addVideo('/footage/main.mp4', { inPoint: 0, outPoint: 10 });
    vt.addVideo('/footage/broll.mp4', { inPoint: 5, outPoint: 15 });
    const at = p.addTrack('audio');
    at.addAudio('/audio/narration.wav', { inPoint: 0, outPoint: 20 });
    return p;
  }

  test('audio clip longer than any single spine clip still emits <audio-clip>', () => {
    // The narration clip spans 20s while each video spine clip is only 10s.
    // It must be attached to the first spine clip whose window contains the
    // audio clip's start point.
    const xml = new FcpxmlExporter(makeProjectWithAudio(), OPT).toString();
    expect(xml).toContain('<audio-clip');
  });

  test('<audio-clip> appears inside the <spine> section', () => {
    const xml = new FcpxmlExporter(makeProjectWithAudio(), OPT).toString();
    const spineStart = xml.indexOf('<spine>');
    const spineEnd   = xml.indexOf('</spine>');
    const spine      = xml.slice(spineStart, spineEnd);
    expect(spine).toContain('<audio-clip');
  });

  test('<audio-clip> has correct offset (absolute timeline position)', () => {
    const xml = new FcpxmlExporter(makeProjectWithAudio(), OPT).toString();
    // Narration starts at t=0 → offset should be 0s (may be "0s" or "0/30s")
    expect(xml).toMatch(/<audio-clip[^>]+offset="0(?:\/\d+)?s"/);
  });

  test('<audio-clip> ref points to the audio asset', () => {
    const xml = new FcpxmlExporter(makeProjectWithAudio(), OPT).toString();
    // narration.wav asset must be the ref
    const audioClipMatch = xml.match(/<audio-clip[^>]+ref="([^"]+)"/);
    expect(audioClipMatch).not.toBeNull();
    const assetId = audioClipMatch[1];
    // The referenced asset must be the audio-only one
    expect(xml).toContain(`<asset id="${assetId}"${''}`);
    const assetMatch = xml.match(new RegExp(`<asset id="${assetId}"[^>]+hasVideo="0"[^>]+hasAudio="1"`));
    expect(assetMatch).not.toBeNull();
  });

  test('audio clip with volume=0.5 emits <adjust-volume> inside <audio-clip>', () => {
    const p = new Project({ name: 'Vol Test', fps: 30 });
    p.addTrack('video').addVideo('/v.mp4', { inPoint: 0, outPoint: 5 });
    const clip = p.addTrack('audio').addAudio('/a.wav', { inPoint: 0, outPoint: 5 });
    clip.volume(0.5);
    const xml = new FcpxmlExporter(p, OPT).toString();
    expect(xml).toContain('<audio-clip');
    expect(xml).toContain('<adjust-volume');
  });

  test('audio clip with mute emits <adjust-volume amount="-96">', () => {
    const p = new Project({ name: 'Mute Test', fps: 30 });
    p.addTrack('video').addVideo('/v.mp4', { inPoint: 0, outPoint: 5 });
    const clip = p.addTrack('audio').addAudio('/a.wav', { inPoint: 0, outPoint: 5 });
    clip.mute(true);
    const xml = new FcpxmlExporter(p, OPT).toString();
    expect(xml).toContain('<adjust-volume amount="-96"');
  });

  test('audio-only project emits <audio-clip> in spine', () => {
    const p = new Project({ name: 'AudioOnly', fps: 30 });
    p.addTrack('audio').addAudio('/music.wav', { inPoint: 0, outPoint: 30 });
    const xml = new FcpxmlExporter(p, OPT).toString();
    expect(xml).toContain('<audio-clip');
  });

  test('video clip with embedded audio (audioChannels=2) — asset reports hasAudio', () => {
    const p  = new Project({ name: 'MP4Audio', fps: 30 });
    const vt = p.addTrack('video');
    const clip = vt.addVideo('/interview.mp4', { inPoint: 0, outPoint: 10 });
    clip.asset.audioChannels = 2;
    const xml = new FcpxmlExporter(p, OPT).toString();
    expect(xml).toContain('hasAudio="1"');
  });
});
