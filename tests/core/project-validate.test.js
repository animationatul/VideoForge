/**
 * @file project-validate.test.js
 * Tests for Project.validate() — the project-level validation API.
 */

import { describe, test, expect } from '@jest/globals';
import Project from '../../src/core/Project.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeProject() {
  return new Project({ name: 'Test', fps: 30, width: 1920, height: 1080 });
}

// ── empty project ─────────────────────────────────────────────────────────────

describe('validate() — empty project', () => {
  test('returns valid with no tracks', () => {
    const result = makeProject().validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  test('returns object shape { valid, warnings, errors }', () => {
    const result = makeProject().validate();
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ── EMPTY_TRACK ───────────────────────────────────────────────────────────────

describe('validate() — EMPTY_TRACK', () => {
  test('warns when a track has no clips', () => {
    const p = makeProject();
    p.addTrack('video', { name: 'Video' });
    const result = p.validate();
    expect(result.valid).toBe(true);
    const w = result.warnings.filter(w => w.type === 'EMPTY_TRACK');
    expect(w).toHaveLength(1);
    expect(w[0].severity).toBe('warning');
    expect(w[0].message).toContain('Video');
  });

  test('no EMPTY_TRACK warning when track has clips', () => {
    const p = makeProject();
    p.addTrack('video').addVideo('clip.mp4', { outPoint: 5 });
    const result = p.validate();
    expect(result.warnings.filter(w => w.type === 'EMPTY_TRACK')).toHaveLength(0);
  });

  test('two empty tracks produce two warnings', () => {
    const p = makeProject();
    p.addTrack('video');
    p.addTrack('audio');
    const result = p.validate();
    expect(result.warnings.filter(w => w.type === 'EMPTY_TRACK')).toHaveLength(2);
  });
});

// ── MISSING_ASSET ─────────────────────────────────────────────────────────────

describe('validate() — MISSING_ASSET', () => {
  test('error when video clip has empty asset path', () => {
    const p = makeProject();
    p.addTrack('video').addVideo('', { outPoint: 5 });
    const result = p.validate();
    expect(result.valid).toBe(false);
    const e = result.errors.filter(e => e.type === 'MISSING_ASSET');
    expect(e).toHaveLength(1);
    expect(e[0].severity).toBe('error');
  });

  test('error when audio clip has empty asset path', () => {
    const p = makeProject();
    p.addTrack('audio').addAudio('', { outPoint: 5 });
    const result = p.validate();
    expect(result.errors.filter(e => e.type === 'MISSING_ASSET')).toHaveLength(1);
  });

  test('no error when asset path is present', () => {
    const p = makeProject();
    p.addTrack('video').addVideo('/path/to/clip.mp4', { outPoint: 5 });
    expect(p.validate().errors.filter(e => e.type === 'MISSING_ASSET')).toHaveLength(0);
  });
});

// ── INVALID_TRIM ──────────────────────────────────────────────────────────────

describe('validate() — INVALID_TRIM', () => {
  test('error when outPoint equals inPoint', () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('clip.mp4');
    clip.inPoint  = 5;
    clip.outPoint = 5;
    const result = p.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.filter(e => e.type === 'INVALID_TRIM')).toHaveLength(1);
  });

  test('error when outPoint is less than inPoint', () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('clip.mp4');
    clip.inPoint  = 10;
    clip.outPoint = 5;
    const result = p.validate();
    expect(result.errors.filter(e => e.type === 'INVALID_TRIM')).toHaveLength(1);
  });

  test('error when inPoint is negative', () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('clip.mp4', { outPoint: 5 });
    clip.inPoint = -1;
    const result = p.validate();
    const trimErrors = result.errors.filter(e => e.type === 'INVALID_TRIM');
    expect(trimErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('valid trim generates no INVALID_TRIM errors', () => {
    const p = makeProject();
    p.addTrack('video').addVideo('clip.mp4', { inPoint: 2, outPoint: 8 });
    expect(p.validate().errors.filter(e => e.type === 'INVALID_TRIM')).toHaveLength(0);
  });

  test('error message contains relevant values', () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('clip.mp4');
    clip.inPoint  = 10;
    clip.outPoint = 5;
    const err = p.validate().errors.find(e => e.type === 'INVALID_TRIM');
    expect(err.message).toMatch(/10/);
    expect(err.message).toMatch(/5/);
  });
});

// ── NEGATIVE_DURATION ─────────────────────────────────────────────────────────

describe('validate() — NEGATIVE_DURATION', () => {
  test('error when computed duration is negative', () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('clip.mp4');
    // Force a state where outPoint < inPoint (bypassing trim() guard)
    clip.inPoint  = 20;
    clip.outPoint = 10;
    const result = p.validate();
    // Both INVALID_TRIM and NEGATIVE_DURATION should be reported
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'NEGATIVE_DURATION' || e.type === 'INVALID_TRIM')).toBe(true);
  });
});

// ── MP4 exporter context ──────────────────────────────────────────────────────

describe('validate({ exporter: "mp4" }) — UNSUPPORTED_CLIP_TYPE', () => {
  test('warns about image clips', () => {
    const p = makeProject();
    p.addTrack('image').addImage('logo.png', { outPoint: 5 });
    const w = p.validate({ exporter: 'mp4' }).warnings
      .filter(w => w.type === 'UNSUPPORTED_CLIP_TYPE');
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain('image');
  });

  test('warns about shape clips', () => {
    const p = makeProject();
    p.addTrack('shape').addShape('rectangle', { outPoint: 5 });
    const w = p.validate({ exporter: 'mp4' }).warnings
      .filter(w => w.type === 'UNSUPPORTED_CLIP_TYPE');
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain('shape');
  });

  test('warns about text clips', () => {
    const p = makeProject();
    p.addTrack('text').addText('Hello', { outPoint: 5 });
    const w = p.validate({ exporter: 'mp4' }).warnings
      .filter(w => w.type === 'UNSUPPORTED_CLIP_TYPE');
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain('text');
  });

  test('warns about caption clips (also type="text")', () => {
    const p = makeProject();
    p.addTrack('video').addCaption('Hello world', { outPoint: 5 });
    const w = p.validate({ exporter: 'mp4' }).warnings
      .filter(w => w.type === 'UNSUPPORTED_CLIP_TYPE');
    expect(w).toHaveLength(1);
  });

  test('no UNSUPPORTED_CLIP_TYPE warning for video clips', () => {
    const p = makeProject();
    p.addTrack('video').addVideo('clip.mp4', { outPoint: 5 });
    const w = p.validate({ exporter: 'mp4' }).warnings
      .filter(w => w.type === 'UNSUPPORTED_CLIP_TYPE');
    expect(w).toHaveLength(0);
  });

  test('no UNSUPPORTED_CLIP_TYPE warning for audio clips', () => {
    const p = makeProject();
    p.addTrack('audio').addAudio('music.mp3', { outPoint: 5 });
    const w = p.validate({ exporter: 'mp4' }).warnings
      .filter(w => w.type === 'UNSUPPORTED_CLIP_TYPE');
    expect(w).toHaveLength(0);
  });

  test('does not add mp4 warnings without exporter option', () => {
    const p = makeProject();
    p.addTrack('image').addImage('logo.png', { outPoint: 5 });
    const w = p.validate().warnings
      .filter(w => w.type === 'UNSUPPORTED_CLIP_TYPE');
    expect(w).toHaveLength(0);
  });
});

describe('validate({ exporter: "mp4" }) — UNSUPPORTED_EFFECT', () => {
  test('warns about transition effect', () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('clip.mp4', { outPoint: 5 });
    clip.effects.push({ type: 'transition', id: 'fx1' });
    const w = p.validate({ exporter: 'mp4' }).warnings
      .filter(w => w.type === 'UNSUPPORTED_EFFECT');
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain('transition');
  });

  test('warns about colorCorrection effect', () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('clip.mp4', { outPoint: 5 });
    clip.effects.push({ type: 'colorCorrection', id: 'fx1' });
    const w = p.validate({ exporter: 'mp4' }).warnings
      .filter(w => w.type === 'UNSUPPORTED_EFFECT');
    expect(w).toHaveLength(1);
  });

  test('warns about blur effect', () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('clip.mp4', { outPoint: 5 });
    clip.effects.push({ type: 'blur', id: 'fx1' });
    const w = p.validate({ exporter: 'mp4' }).warnings
      .filter(w => w.type === 'UNSUPPORTED_EFFECT');
    expect(w).toHaveLength(1);
  });

  test('warns about custom effect', () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('clip.mp4', { outPoint: 5 });
    clip.effects.push({ type: 'custom', id: 'fx1' });
    const w = p.validate({ exporter: 'mp4' }).warnings
      .filter(w => w.type === 'UNSUPPORTED_EFFECT');
    expect(w).toHaveLength(1);
  });

  test('no warning for fadeIn and fadeOut effects', () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('clip.mp4', { outPoint: 5 });
    clip.fadeIn(1).fadeOut(1);
    const w = p.validate({ exporter: 'mp4' }).warnings
      .filter(w => w.type === 'UNSUPPORTED_EFFECT');
    expect(w).toHaveLength(0);
  });

  test('multiple unsupported effects each produce a warning', () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('clip.mp4', { outPoint: 5 });
    clip.effects.push({ type: 'transition', id: 'fx1' });
    clip.effects.push({ type: 'colorCorrection', id: 'fx2' });
    clip.effects.push({ type: 'blur', id: 'fx3' });
    const w = p.validate({ exporter: 'mp4' }).warnings
      .filter(w => w.type === 'UNSUPPORTED_EFFECT');
    expect(w).toHaveLength(3);
  });

  test('does not warn about effects without exporter option', () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('clip.mp4', { outPoint: 5 });
    clip.effects.push({ type: 'transition', id: 'fx1' });
    const w = p.validate().warnings
      .filter(w => w.type === 'UNSUPPORTED_EFFECT');
    expect(w).toHaveLength(0);
  });
});

// ── valid flag semantics ───────────────────────────────────────────────────────

describe('validate() — valid flag', () => {
  test('valid=true when project has only warnings', () => {
    const p = makeProject();
    p.addTrack('video'); // empty track → warning
    expect(p.validate().valid).toBe(true);
  });

  test('valid=false when project has at least one error', () => {
    const p = makeProject();
    const clip = p.addTrack('video').addVideo('clip.mp4');
    clip.inPoint  = 10;
    clip.outPoint = 5;
    expect(p.validate().valid).toBe(false);
  });

  test('valid=true for fully correct project', () => {
    const p = makeProject();
    const vt = p.addTrack('video');
    vt.addVideo('/footage/a.mp4', { inPoint: 0, outPoint: 10 }).fadeIn(1).fadeOut(1);
    vt.addVideo('/footage/b.mp4', { inPoint: 0, outPoint: 5 });
    p.addTrack('audio').addAudio('/audio/music.mp3', { inPoint: 0, outPoint: 15 });
    expect(p.validate().valid).toBe(true);
    expect(p.validate().errors).toHaveLength(0);
  });
});
