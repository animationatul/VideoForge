/**
 * @file tests/helpers/fixtures.js
 * Shared test fixture generator for VideoForge integration tests.
 *
 * Generates small synthetic media files using FFmpeg's lavfi source.
 * All files are created in a temporary directory and can be cleaned up
 * with cleanupFixtures().
 *
 * Requires FFmpeg to be installed; caller is responsible for checking
 * availability and skipping tests when it is absent.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

export const FIXTURE_DIR = '/tmp/vf-test-fixtures';

export const FIXTURES = {
  VIDEO_ONLY:        path.join(FIXTURE_DIR, 'video-only.mp4'),
  VIDEO_WITH_AUDIO:  path.join(FIXTURE_DIR, 'video-with-audio.mp4'),
  AUDIO_WAV:         path.join(FIXTURE_DIR, 'audio.wav'),
  IMAGE_JPG:         path.join(FIXTURE_DIR, 'image.jpg'),
};

/**
 * Generate all test fixtures.  Safe to call multiple times — FFmpeg
 * receives -y so it overwrites silently.
 * @returns {Promise<void>}
 */
export async function generateFixtures() {
  await fs.mkdir(FIXTURE_DIR, { recursive: true });

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=30:duration=3',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '40',
    '-an',
    FIXTURES.VIDEO_ONLY,
  ]);

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=30:duration=3',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '40',
    '-c:a', 'aac',
    '-shortest',
    FIXTURES.VIDEO_WITH_AUDIO,
  ]);

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3:sample_rate=48000',
    '-c:a', 'pcm_s16le',
    FIXTURES.AUDIO_WAV,
  ]);

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'color=c=blue:size=320x240:rate=1',
    '-frames:v', '1',
    FIXTURES.IMAGE_JPG,
  ]);
}

/**
 * Remove all generated test fixtures and the temporary directory.
 * @returns {Promise<void>}
 */
export async function cleanupFixtures() {
  await fs.rm(FIXTURE_DIR, { recursive: true, force: true }).catch(() => {});
}

/**
 * Check whether FFmpeg is available in PATH.
 * @returns {Promise<boolean>}
 */
export async function isFfmpegAvailable() {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}
