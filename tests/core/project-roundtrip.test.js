/**
 * @file project-roundtrip.test.js
 * Regression tests for Project.save() / Project.load() clip round-trip
 * (release blocker #2) and project.export() EDL dispatch (release blocker #1).
 */

import { describe, test, expect, afterAll } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import Project from '../../src/core/Project.js';
import VideoClip from '../../src/clips/VideoClip.js';
import AudioClip from '../../src/clips/AudioClip.js';
import ImageClip from '../../src/clips/ImageClip.js';
import TextClip from '../../src/clips/TextClip.js';
import ShapeClip from '../../src/clips/ShapeClip.js';

const TMP = '/tmp/vf-roundtrip-test';

afterAll(async () => {
  await fs.rm(TMP, { recursive: true, force: true }).catch(() => {});
});

// ── helpers ───────────────────────────────────────────────────────────────────

function makeProject() {
  return new Project({ name: 'RoundTrip', fps: 30, width: 1920, height: 1080 });
}

async function saveLoad(project) {
  await fs.mkdir(TMP, { recursive: true });
  const filePath = path.join(TMP, `${Date.now()}.vfp`);
  await project.save(filePath);
  return Project.load(filePath);
}

// ── VideoClip round-trip ──────────────────────────────────────────────────────

describe('Project.save() / Project.load() — VideoClip', () => {
  test('VideoClip survives a save/load round-trip', async () => {
    const p = makeProject();
    const track = p.addTrack('video');
    track.addVideo('/footage/scene.mp4', { inPoint: 2, outPoint: 10 });

    const loaded = await saveLoad(p);

    expect(loaded.getTracks()).toHaveLength(1);
    expect(loaded.getTracks()[0].getClips()).toHaveLength(1);

    const clip = loaded.getTracks()[0].getClips()[0];
    expect(clip).toBeInstanceOf(VideoClip);
    expect(clip.asset.path).toBe('/footage/scene.mp4');
    expect(clip.inPoint).toBe(2);
    expect(clip.outPoint).toBe(10);
  });

  test('VideoClip speed and volume survive round-trip', async () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('/footage/a.mp4', { outPoint: 5 });
    clip.speed(2).volume(0.7);

    const loaded = await saveLoad(p);
    const restored = loaded.getTracks()[0].getClips()[0];

    expect(restored).toBeInstanceOf(VideoClip);
    expect(restored.speed()).toBe(2);
    expect(restored.volume()).toBe(0.7);
  });

  test('VideoClip mute state survives round-trip', async () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('/footage/a.mp4', { outPoint: 5 });
    clip.mute();

    const loaded = await saveLoad(p);
    const restored = loaded.getTracks()[0].getClips()[0];

    expect(restored.isMuted).toBe(true);
  });

  test('VideoClip reversed flag survives round-trip', async () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('/footage/a.mp4', { outPoint: 5 });
    clip.reverse(true);

    const loaded = await saveLoad(p);
    const restored = loaded.getTracks()[0].getClips()[0];

    expect(restored.isReversed).toBe(true);
  });
});

// ── AudioClip round-trip ──────────────────────────────────────────────────────

describe('Project.save() / Project.load() — AudioClip', () => {
  test('AudioClip survives a save/load round-trip', async () => {
    const p = makeProject();
    p.addTrack('audio').addAudio('/audio/music.mp3', { inPoint: 0, outPoint: 30 });

    const loaded = await saveLoad(p);

    expect(loaded.getTracks()).toHaveLength(1);
    const clip = loaded.getTracks()[0].getClips()[0];
    expect(clip).toBeInstanceOf(AudioClip);
    expect(clip.asset.path).toBe('/audio/music.mp3');
    expect(clip.outPoint).toBe(30);
  });

  test('AudioClip volume and pan survive round-trip', async () => {
    const p = makeProject();
    const clip = p.addTrack('audio').addAudio('/audio/narr.wav', { outPoint: 10 });
    clip.volume(0.5).pan(0.3);

    const loaded = await saveLoad(p);
    const restored = loaded.getTracks()[0].getClips()[0];

    expect(restored.volume()).toBe(0.5);
    expect(restored.pan()).toBe(0.3);
  });

  test('AudioClip speed survives round-trip', async () => {
    const p = makeProject();
    const clip = p.addTrack('audio').addAudio('/audio/a.mp3', { outPoint: 5 });
    clip.speed(1.5);

    const loaded = await saveLoad(p);
    const restored = loaded.getTracks()[0].getClips()[0];

    expect(restored.speed()).toBe(1.5);
  });
});

// ── ImageClip round-trip ──────────────────────────────────────────────────────

describe('Project.save() / Project.load() — ImageClip', () => {
  test('ImageClip survives a save/load round-trip', async () => {
    const p = makeProject();
    const clip = p.addTrack('image').addImage('/assets/logo.png', { outPoint: 8 });
    clip.position(100, 50).opacity(0.8);

    const loaded = await saveLoad(p);
    const restored = loaded.getTracks()[0].getClips()[0];

    expect(restored).toBeInstanceOf(ImageClip);
    expect(restored.asset.path).toBe('/assets/logo.png');
    expect(restored.position()).toEqual({ x: 100, y: 50 });
    expect(restored.opacity()).toBe(0.8);
  });
});

// ── TextClip round-trip ───────────────────────────────────────────────────────

describe('Project.save() / Project.load() — TextClip', () => {
  test('TextClip survives a save/load round-trip', async () => {
    const p = makeProject();
    p.addTrack('text').addText('Hello World', { outPoint: 5 });

    const loaded = await saveLoad(p);
    const restored = loaded.getTracks()[0].getClips()[0];

    expect(restored).toBeInstanceOf(TextClip);
    expect(restored.text).toBe('Hello World');
    expect(restored.outPoint).toBe(5);
  });

  test('TextClip styling survives round-trip', async () => {
    const p = makeProject();
    const clip = p.addTrack('text').addText('Styled', { outPoint: 3 });
    clip.font('Helvetica').fontSize(72).color('#FF0000').bold(true);

    const loaded = await saveLoad(p);
    const restored = loaded.getTracks()[0].getClips()[0];

    expect(restored.font()).toBe('Helvetica');
    expect(restored.fontSize()).toBe(72);
    expect(restored.color()).toBe('#FF0000');
    expect(restored.bold()).toBe(true);
  });
});

// ── ShapeClip round-trip ──────────────────────────────────────────────────────

describe('Project.save() / Project.load() — ShapeClip', () => {
  test('ShapeClip survives a save/load round-trip', async () => {
    const p = makeProject();
    p.addTrack('shape').addShape('rectangle', { outPoint: 4 });

    const loaded = await saveLoad(p);
    const restored = loaded.getTracks()[0].getClips()[0];

    expect(restored).toBeInstanceOf(ShapeClip);
    expect(restored.outPoint).toBe(4);
  });
});

// ── Mixed project round-trip ──────────────────────────────────────────────────

describe('Project.save() / Project.load() — mixed project', () => {
  test('all track types and clip counts survive round-trip', async () => {
    const p = makeProject();

    const vt = p.addTrack('video');
    vt.addVideo('/footage/a.mp4', { outPoint: 10 });
    vt.addVideo('/footage/b.mp4', { outPoint: 5 });

    p.addTrack('audio').addAudio('/audio/music.mp3', { outPoint: 20 });
    p.addTrack('image').addImage('/logo.png', { outPoint: 5 });
    p.addTrack('text').addText('Title', { outPoint: 3 });
    p.addTrack('shape').addShape('ellipse', { outPoint: 5 });

    const loaded = await saveLoad(p);

    expect(loaded.getTracks()).toHaveLength(5);

    // Video track: 2 clips
    const videoTrack = loaded.getTracks().find(t => t.type === 'video');
    expect(videoTrack.getClips()).toHaveLength(2);
    expect(videoTrack.getClips()[0]).toBeInstanceOf(VideoClip);
    expect(videoTrack.getClips()[1]).toBeInstanceOf(VideoClip);

    // Audio track: 1 clip
    const audioTrack = loaded.getTracks().find(t => t.type === 'audio');
    expect(audioTrack.getClips()).toHaveLength(1);
    expect(audioTrack.getClips()[0]).toBeInstanceOf(AudioClip);
  });

  test('project name and fps survive round-trip', async () => {
    const p = new Project({ name: 'My Film', fps: 24, width: 3840, height: 2160 });
    p.addTrack('video').addVideo('/a.mp4', { outPoint: 1 });

    const loaded = await saveLoad(p);

    expect(loaded.name).toBe('My Film');
    expect(loaded.timeline.fps).toBe(24);
    expect(loaded.timeline.width).toBe(3840);
    expect(loaded.timeline.height).toBe(2160);
  });

  test('clip startTime and name survive round-trip', async () => {
    const p = makeProject();
    const track = p.addTrack('video');
    const clip = track.addVideo('/a.mp4', { outPoint: 5 });
    clip.name = 'Opening Shot';
    clip.startTime = 3;

    const loaded = await saveLoad(p);
    const restored = loaded.getTracks()[0].getClips()[0];

    expect(restored.name).toBe('Opening Shot');
    expect(restored.startTime).toBe(3);
  });
});

// ── CaptionClip is restored, not TextClip ────────────────────────────────────

describe('Project.save() / Project.load() — CaptionClip vs TextClip', () => {
  test('CaptionClip is restored as CaptionClip (not TextClip)', async () => {
    const { default: CaptionClip } = await import('../../src/captions/CaptionClip.js');

    const p = makeProject();
    p.addTrack('video').addCaption('Welcome to VideoForge', { outPoint: 5 });

    const loaded = await saveLoad(p);
    const restored = loaded.getTracks()[0].getClips()[0];

    expect(restored).toBeInstanceOf(CaptionClip);
    expect(restored.transcript).toBe('Welcome to VideoForge');
  });

  test('TextClip is restored as TextClip (not CaptionClip)', async () => {
    const p = makeProject();
    p.addTrack('text').addText('Subtitle text', { outPoint: 5 });

    const loaded = await saveLoad(p);
    const restored = loaded.getTracks()[0].getClips()[0];

    expect(restored).toBeInstanceOf(TextClip);
    expect(restored.text).toBe('Subtitle text');
  });
});

// ── EDL export via project.export() ──────────────────────────────────────────
// Regression test for Blocker #1 — previously threw "Unknown export type: edl"

describe('project.export({ type: "edl" })', () => {
  test('does not throw and creates an output file', async () => {
    await fs.mkdir(TMP, { recursive: true });
    const outFile = path.join(TMP, 'test.edl');

    const p = makeProject();
    p.addTrack('video').addVideo('/footage/scene.mp4', { outPoint: 5 });

    await expect(
      p.export({ type: 'edl', output: outFile }),
    ).resolves.not.toThrow();

    const stat = await fs.stat(outFile);
    expect(stat.size).toBeGreaterThan(0);
  });

  test('exported EDL file contains expected EDL header', async () => {
    await fs.mkdir(TMP, { recursive: true });
    const outFile = path.join(TMP, 'test-header.edl');

    const p = makeProject();
    p.addTrack('video').addVideo('/footage/scene.mp4', { outPoint: 5 });
    await p.export({ type: 'edl', output: outFile });

    const content = await fs.readFile(outFile, 'utf8');
    expect(content).toMatch(/TITLE:/);
    expect(content).toMatch(/FCM:/);
  });

  test('EXPORT_TYPES.EDL is defined', async () => {
    const { EXPORT_TYPES } = await import('../../src/utils/Constants.js');
    expect(EXPORT_TYPES.EDL).toBe('edl');
  });
});
