/**
 * @file mp4-integration.test.js
 * Integration tests for the MP4 exporter that require a real FFmpeg binary.
 *
 * All tests are automatically skipped when FFmpeg is not available in PATH.
 *
 * Test fixtures are synthetic (generated via FFmpeg's lavfi source) so no
 * real media files are needed.  Fixtures and output files are created in a
 * temporary directory and removed in afterAll.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import Project from '../../src/core/Project.js';
import Mp4Exporter from '../../src/exporters/mp4/Mp4Exporter.js';

const execFileAsync = promisify(execFile);

// ── Fixture paths ─────────────────────────────────────────────────────────────

const TMP        = '/tmp/vf-mp4-integration';
const FIXTURE_W_AUDIO  = path.join(TMP, 'src_with_audio.mp4');   // 3 s, 320×240, sine tone
const FIXTURE_NO_AUDIO = path.join(TMP, 'src_no_audio.mp4');     // 3 s, 320×240, silent
const OUT        = path.join(TMP, 'out');

// ── Availability check + fixture creation ─────────────────────────────────────

let ffmpegAvailable = false;

beforeAll(async () => {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    ffmpegAvailable = true;
  } catch {
    return;
  }

  await fs.mkdir(TMP, { recursive: true });
  await fs.mkdir(OUT, { recursive: true });

  // 3-second test video WITH embedded stereo audio (lavfi sources, no real media)
  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=30:duration=3',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '40',
    '-c:a', 'aac',
    '-shortest',
    FIXTURE_W_AUDIO,
  ]);

  // 3-second test video WITHOUT audio
  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=30:duration=3',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '40',
    '-an',
    FIXTURE_NO_AUDIO,
  ]);
}, 60_000);

afterAll(async () => {
  await fs.rm(TMP, { recursive: true, force: true }).catch(() => {});
});

// ── Test helper ───────────────────────────────────────────────────────────────

/** Wrap tests so they skip cleanly when FFmpeg is absent. */
function ffmpegTest(name, fn) {
  test(name, async () => {
    if (!ffmpegAvailable) return;
    await fn();
  }, 30_000);
}

// ── Probe helpers ─────────────────────────────────────────────────────────────

async function probeAudioStream(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type,channels',
      '-of', 'json',
      filePath,
    ]);
    const data = JSON.parse(stdout);
    return data.streams?.[0] ?? null;
  } catch {
    return null;
  }
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

function makeExporter(project) {
  return new Mp4Exporter(project, { preset: 'ultrafast', crf: 40 });
}

// ── Detection: manually set audioChannels ─────────────────────────────────────

describe('Mp4Exporter integration — embedded audio (manual detection)', () => {
  ffmpegTest('single video clip with audioChannels=2 exports audio stream', async () => {
    const outFile = path.join(OUT, 'manual_single.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    const clip = p.addTrack('video').addVideo(FIXTURE_W_AUDIO, { inPoint: 0, outPoint: 3 });
    clip.asset.audioChannels = 2;

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);
    expect(result.fileSize).toBeGreaterThan(0);

    const audio = await probeAudioStream(outFile);
    expect(audio).not.toBeNull();
  });

  ffmpegTest('trim preserves embedded audio (inPoint=1, outPoint=3 → ~2 s output)', async () => {
    const outFile = path.join(OUT, 'manual_trim.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    const clip = p.addTrack('video').addVideo(FIXTURE_W_AUDIO, { inPoint: 1, outPoint: 3 });
    clip.asset.audioChannels = 2;

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);

    const dur = await probeDuration(outFile);
    expect(dur).toBeGreaterThan(1.5);
    expect(dur).toBeLessThan(2.5);

    expect(await probeAudioStream(outFile)).not.toBeNull();
  });

  ffmpegTest('speed(2) halves duration for both video and embedded audio', async () => {
    const outFile = path.join(OUT, 'manual_speed.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    const clip = p.addTrack('video').addVideo(FIXTURE_W_AUDIO, { inPoint: 0, outPoint: 3 });
    clip.asset.audioChannels = 2;
    clip.speed(2);

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);

    // 3 s at 2× ≈ 1.5 s
    const dur = await probeDuration(outFile);
    expect(dur).toBeGreaterThan(1.0);
    expect(dur).toBeLessThan(2.0);

    expect(await probeAudioStream(outFile)).not.toBeNull();
  });

  ffmpegTest('reverse(true) produces output with audio stream', async () => {
    const outFile = path.join(OUT, 'manual_reverse.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    const clip = p.addTrack('video').addVideo(FIXTURE_W_AUDIO, { inPoint: 0, outPoint: 3 });
    clip.asset.audioChannels = 2;
    clip.reverse(true);

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);
    expect(await probeAudioStream(outFile)).not.toBeNull();
  });

  ffmpegTest('fadeIn(1) produces output with audio stream', async () => {
    const outFile = path.join(OUT, 'manual_fadein.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    const clip = p.addTrack('video').addVideo(FIXTURE_W_AUDIO, { inPoint: 0, outPoint: 3 });
    clip.asset.audioChannels = 2;
    clip.fadeIn(1);

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);
    expect(await probeAudioStream(outFile)).not.toBeNull();
  });

  ffmpegTest('fadeOut(1) produces output with audio stream', async () => {
    const outFile = path.join(OUT, 'manual_fadeout.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    const clip = p.addTrack('video').addVideo(FIXTURE_W_AUDIO, { inPoint: 0, outPoint: 3 });
    clip.asset.audioChannels = 2;
    clip.fadeOut(1);

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);
    expect(await probeAudioStream(outFile)).not.toBeNull();
  });

  ffmpegTest('mute() suppresses audio but file still has audio stream', async () => {
    const outFile = path.join(OUT, 'manual_mute.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    const clip = p.addTrack('video').addVideo(FIXTURE_W_AUDIO, { inPoint: 0, outPoint: 3 });
    clip.asset.audioChannels = 2;
    clip.mute();

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);
    // The audio stream exists but is silent (volume=0 filter applied)
    expect(await probeAudioStream(outFile)).not.toBeNull();
  });

  ffmpegTest('two video clips concatenate video and audio', async () => {
    const outFile = path.join(OUT, 'manual_concat.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    const vt = p.addTrack('video');
    const c1 = vt.addVideo(FIXTURE_W_AUDIO, { inPoint: 0,   outPoint: 1.5 });
    const c2 = vt.addVideo(FIXTURE_W_AUDIO, { inPoint: 1.5, outPoint: 3   });
    c1.asset.audioChannels = 2;
    c2.asset.audioChannels = 2;

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);

    // Two 1.5-second clips → ~3 seconds total
    const dur = await probeDuration(outFile);
    expect(dur).toBeGreaterThan(2.5);
    expect(dur).toBeLessThan(3.5);

    expect(await probeAudioStream(outFile)).not.toBeNull();
  });

  ffmpegTest('video-without-audio source: output has no audio stream', async () => {
    const outFile = path.join(OUT, 'manual_noaudio.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    p.addTrack('video').addVideo(FIXTURE_NO_AUDIO, { inPoint: 0, outPoint: 3 });
    // audioChannels not set (stays 0)

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);

    expect(await probeAudioStream(outFile)).toBeNull();
  });
});

// ── Detection: automatic via FFprobe ─────────────────────────────────────────

describe('Mp4Exporter integration — embedded audio (FFprobe auto-detection)', () => {
  ffmpegTest('ffprobe detects audio channels and includes audio in output', async () => {
    const outFile = path.join(OUT, 'auto_detect.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    // Do NOT set audioChannels — let the exporter detect it via ffprobe
    p.addTrack('video').addVideo(FIXTURE_W_AUDIO, { inPoint: 0, outPoint: 3 });

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);

    const audio = await probeAudioStream(outFile);
    expect(audio).not.toBeNull();
  });

  ffmpegTest('ffprobe on no-audio source: output has no audio stream', async () => {
    const outFile = path.join(OUT, 'auto_noaudio.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    // FIXTURE_NO_AUDIO has no audio — ffprobe should return 0
    p.addTrack('video').addVideo(FIXTURE_NO_AUDIO, { inPoint: 0, outPoint: 3 });

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);

    expect(await probeAudioStream(outFile)).toBeNull();
  });

  ffmpegTest('trim + auto-detection preserves audio', async () => {
    const outFile = path.join(OUT, 'auto_trim.mp4');
    const p = new Project({ name: 'T', fps: 30, width: 320, height: 240 });
    p.addTrack('video').addVideo(FIXTURE_W_AUDIO, { inPoint: 1, outPoint: 3 });

    const result = await makeExporter(p).export(outFile);
    expect(result.success).toBe(true);

    const dur = await probeDuration(outFile);
    expect(dur).toBeGreaterThan(1.5);
    expect(dur).toBeLessThan(2.5);

    expect(await probeAudioStream(outFile)).not.toBeNull();
  });
});
