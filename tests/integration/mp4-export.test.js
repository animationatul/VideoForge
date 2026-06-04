/**
 * @file mp4-export.test.js
 * Integration tests for MP4 export covering scenarios not in mp4-integration.test.js:
 *   - Basic video-only export
 *   - Explicit AudioClip on a separate audio track
 *   - Volume control on AudioClip
 *   - validate() + export() workflow
 *
 * Tests are automatically skipped when FFmpeg is not available in PATH.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import Project from '../../src/core/Project.js';
import Mp4Exporter from '../../src/exporters/mp4/Mp4Exporter.js';
import {
  FIXTURES,
  generateFixtures,
  cleanupFixtures,
  isFfmpegAvailable,
} from '../helpers/fixtures.js';

const execFileAsync = promisify(execFile);
const OUT = '/tmp/vf-integration-out';

let ffmpegAvailable = false;

beforeAll(async () => {
  ffmpegAvailable = await isFfmpegAvailable();
  if (!ffmpegAvailable) return;
  await generateFixtures();
  await fs.mkdir(OUT, { recursive: true });
}, 90_000);

afterAll(async () => {
  await cleanupFixtures();
  await fs.rm(OUT, { recursive: true, force: true }).catch(() => {});
});

// ── helpers ───────────────────────────────────────────────────────────────────

function ffmpegTest(name, fn) {
  test(name, async () => {
    if (!ffmpegAvailable) return;
    await fn();
  }, 30_000);
}

function makeExporter(project) {
  return new Mp4Exporter(project, { preset: 'ultrafast', crf: 40 });
}

async function probeDuration(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

async function probeAudioStream(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'json',
      filePath,
    ]);
    const data = JSON.parse(stdout);
    return data.streams?.[0] ?? null;
  } catch {
    return null;
  }
}

// ── Basic video-only export ───────────────────────────────────────────────────

describe('basic video export', () => {
  ffmpegTest('exports a single video clip to MP4', async () => {
    const outFile = path.join(OUT, 'basic_video.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    p.addTrack('video').addVideo(FIXTURES.VIDEO_ONLY, { inPoint: 0, outPoint: 3 });

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);
    expect(result.fileSize).toBeGreaterThan(0);

    await expect(fs.access(outFile)).resolves.not.toThrow();
  });

  ffmpegTest('output duration matches source', async () => {
    const outFile = path.join(OUT, 'basic_duration.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    p.addTrack('video').addVideo(FIXTURES.VIDEO_ONLY, { inPoint: 0, outPoint: 3 });

    await makeExporter(p).export(outFile);
    const dur = await probeDuration(outFile);
    expect(dur).toBeGreaterThan(2.5);
    expect(dur).toBeLessThan(3.5);
  });

  ffmpegTest('trimmed export respects inPoint and outPoint', async () => {
    const outFile = path.join(OUT, 'basic_trim.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    p.addTrack('video').addVideo(FIXTURES.VIDEO_ONLY, { inPoint: 1, outPoint: 2 });

    await makeExporter(p).export(outFile);
    const dur = await probeDuration(outFile);
    expect(dur).toBeGreaterThan(0.5);
    expect(dur).toBeLessThan(1.5);
  });

  ffmpegTest('video-only export has no audio stream', async () => {
    const outFile = path.join(OUT, 'basic_no_audio.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    p.addTrack('video').addVideo(FIXTURES.VIDEO_ONLY, { inPoint: 0, outPoint: 3 });

    await makeExporter(p).export(outFile);
    expect(await probeAudioStream(outFile)).toBeNull();
  });
});

// ── Explicit AudioClip on a separate audio track ──────────────────────────────

describe('explicit AudioClip on separate track', () => {
  ffmpegTest('exports with audio stream when AudioClip is present', async () => {
    const outFile = path.join(OUT, 'explicit_audio.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    p.addTrack('video').addVideo(FIXTURES.VIDEO_ONLY, { inPoint: 0, outPoint: 3 });
    p.addTrack('audio').addAudio(FIXTURES.AUDIO_WAV, { inPoint: 0, outPoint: 3 });

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);
    expect(await probeAudioStream(outFile)).not.toBeNull();
  });

  ffmpegTest('audio-only project (no video track) succeeds', async () => {
    const outFile = path.join(OUT, 'audio_only.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    p.addTrack('audio').addAudio(FIXTURES.AUDIO_WAV, { inPoint: 0, outPoint: 3 });

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);
    expect(await probeAudioStream(outFile)).not.toBeNull();
  });

  ffmpegTest('muted AudioClip still produces audio stream', async () => {
    const outFile = path.join(OUT, 'audio_muted.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    p.addTrack('video').addVideo(FIXTURES.VIDEO_ONLY, { inPoint: 0, outPoint: 3 });
    const audioClip = p.addTrack('audio').addAudio(FIXTURES.AUDIO_WAV, { inPoint: 0, outPoint: 3 });
    audioClip.mute();

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);
    expect(await probeAudioStream(outFile)).not.toBeNull();
  });
});

// ── Speed effect ──────────────────────────────────────────────────────────────

describe('speed effect', () => {
  ffmpegTest('speed(2) roughly halves video duration', async () => {
    const outFile = path.join(OUT, 'speed_2x.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    const clip = p.addTrack('video').addVideo(FIXTURES.VIDEO_ONLY, { inPoint: 0, outPoint: 3 });
    clip.speed(2);

    await makeExporter(p).export(outFile);
    const dur = await probeDuration(outFile);
    expect(dur).toBeGreaterThan(1.0);
    expect(dur).toBeLessThan(2.0);
  });

  ffmpegTest('speed(0.5) roughly doubles video duration', async () => {
    const outFile = path.join(OUT, 'speed_half.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    const clip = p.addTrack('video').addVideo(FIXTURES.VIDEO_ONLY, { inPoint: 0, outPoint: 2 });
    clip.speed(0.5);

    await makeExporter(p).export(outFile);
    const dur = await probeDuration(outFile);
    expect(dur).toBeGreaterThan(3.0);
    expect(dur).toBeLessThan(5.0);
  });
});

// ── validate() + export() workflow ───────────────────────────────────────────

describe('validate() before export', () => {
  ffmpegTest('valid project exports successfully', async () => {
    const outFile = path.join(OUT, 'validated.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    p.addTrack('video').addVideo(FIXTURES.VIDEO_ONLY, { inPoint: 0, outPoint: 3 });

    const report = p.validate({ exporter: 'mp4' });
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);
  });

  test('project with invalid trim is flagged before export', () => {
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    const clip = p.addTrack('video').addVideo(FIXTURES.VIDEO_ONLY);
    clip.inPoint  = 10;
    clip.outPoint = 5;

    const report = p.validate({ exporter: 'mp4' });
    expect(report.valid).toBe(false);
    expect(report.errors.some(e => e.type === 'INVALID_TRIM')).toBe(true);
  });

  test('unsupported clip types produce warnings in mp4 context', () => {
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    p.addTrack('video').addVideo(FIXTURES.VIDEO_ONLY, { outPoint: 3 });
    p.addTrack('text').addText('Subtitle', { outPoint: 3 });
    p.addTrack('shape').addShape('rectangle', { outPoint: 3 });

    const report = p.validate({ exporter: 'mp4' });
    expect(report.valid).toBe(true);
    const typeWarnings = report.warnings.filter(w => w.type === 'UNSUPPORTED_CLIP_TYPE');
    expect(typeWarnings).toHaveLength(2); // text + shape
  });
});
