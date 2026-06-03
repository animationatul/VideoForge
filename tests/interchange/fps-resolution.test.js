/**
 * @file fps-resolution.test.js
 * Regression tests for FPS resolution across the export pipeline.
 *
 * VideoForge stores fps/width/height on project.timeline.*, NOT on project
 * directly. These tests verify that every exporter and interchange module
 * reads the correct values for all supported frame rates.
 */

import { describe, test, expect } from '@jest/globals';
import Project from '../../src/core/Project.js';
import { resolveFps, resolveWidth, resolveHeight, resolveSampleRate, resolveChannels, resolveSequenceParams } from '../../src/utils/FpsResolver.js';
import TimelineConverter from '../../src/interchange/TimelineConverter.js';
import InterchangeValidator from '../../src/interchange/validation/InterchangeValidator.js';
import PremiereXmlExporter from '../../src/exporters/PremiereXmlExporter.js';
import FcpxmlExporter from '../../src/exporters/FcpxmlExporter.js';
import EdlExporter from '../../src/exporters/EdlExporter.js';
import TimeCode from '../../src/interchange/utils/TimeCode.js';

// ─── Supported frame rates ────────────────────────────────────────────────────

const RATES = [
  { fps: 24,    expectedTimebase: 24,  ntsc: false, fcpDuration: '1/24s',        dfMode: 'NDF' },
  { fps: 25,    expectedTimebase: 25,  ntsc: false, fcpDuration: '1/25s',        dfMode: 'NDF' },
  { fps: 29.97, expectedTimebase: 30,  ntsc: true,  fcpDuration: '1001/30000s',  dfMode: 'DF'  },
  { fps: 30,    expectedTimebase: 30,  ntsc: false, fcpDuration: '1/30s',        dfMode: 'NDF' },
  { fps: 50,    expectedTimebase: 50,  ntsc: false, fcpDuration: '1/50s',        dfMode: 'NDF' },
  { fps: 59.94, expectedTimebase: 60,  ntsc: true,  fcpDuration: '1001/60000s',  dfMode: 'DF'  },
  { fps: 60,    expectedTimebase: 60,  ntsc: false, fcpDuration: '1/60s',        dfMode: 'NDF' },
];

// Build a minimal project at the given fps
function makeProject(fps, width = 1920, height = 1080) {
  const p = new Project({ name: `Test ${fps}fps`, fps, width, height });
  p.addTrack('video').addVideo('/footage/main.mp4', { inPoint: 0, outPoint: 5 });
  p.addTrack('audio').addAudio('/audio/music.wav', { inPoint: 0, outPoint: 5 });
  return p;
}

// ─── FpsResolver unit tests ───────────────────────────────────────────────────

describe('FpsResolver', () => {
  test('resolveFps() reads from project.timeline.fps', () => {
    const p = makeProject(23.976);
    expect(resolveFps(p)).toBe(p.timeline.fps);
    expect(resolveFps(p)).not.toBe(30);
  });

  test.each(RATES)('resolveFps() returns $fps for a $fps project', ({ fps }) => {
    const p = makeProject(fps);
    expect(resolveFps(p)).toBe(fps);
  });

  test('resolveWidth/resolveHeight read from project.timeline', () => {
    const p = new Project({ name: 'Dims', fps: 30, width: 3840, height: 2160 });
    expect(resolveWidth(p)).toBe(3840);
    expect(resolveHeight(p)).toBe(2160);
  });

  test('resolveSampleRate reads from project.timeline', () => {
    const p = new Project({ name: 'Audio', fps: 30, sampleRate: 44100 });
    expect(resolveSampleRate(p)).toBe(44100);
  });

  test('resolveSequenceParams returns all five fields', () => {
    const p = new Project({ name: 'All', fps: 25, width: 1280, height: 720, sampleRate: 48000, channels: 1 });
    const params = resolveSequenceParams(p);
    expect(params.fps).toBe(25);
    expect(params.width).toBe(1280);
    expect(params.height).toBe(720);
    expect(params.sampleRate).toBe(48000);
    expect(params.channels).toBe(1);
  });

  test('resolveFps() falls back to DEFAULTS.FPS for a project with no timeline', () => {
    expect(resolveFps(null)).toBe(30);
    expect(resolveFps({})).toBe(30);
  });
});

// ─── TimelineConverter ────────────────────────────────────────────────────────

describe('TimelineConverter — fps resolution', () => {
  const converter = new TimelineConverter();

  test.each(RATES)('ITR fps matches project fps for $fps', ({ fps }) => {
    const p   = makeProject(fps);
    const itr = converter.convert(p);
    expect(itr.fps).toBe(fps);
  });

  test('ITR width and height match project dimensions', () => {
    const p   = new Project({ name: 'HD', fps: 30, width: 2560, height: 1440 });
    p.addTrack('video').addVideo('/a.mp4', { inPoint: 0, outPoint: 3 });
    const itr = converter.convert(p);
    expect(itr.width).toBe(2560);
    expect(itr.height).toBe(1440);
  });

  test('assets inherit correct fps from ITR', () => {
    const p   = makeProject(24);
    const itr = converter.convert(p);
    const videoAsset = itr.assets.find((a) => a.path.includes('main.mp4'));
    expect(videoAsset).toBeDefined();
    expect(videoAsset.fps).toBe(24);
  });

  test('29.97fps project produces ntsc=true ITR asset fps', () => {
    const p   = makeProject(29.97);
    const itr = converter.convert(p);
    expect(itr.fps).toBe(29.97);
  });
});

// ─── ClipRepresentation — getter method fix ───────────────────────────────────

describe('ClipRepresentation — clip property extraction', () => {
  const converter = new TimelineConverter();

  test('speed is a number, not a function', () => {
    const p = makeProject(30);
    const itr = converter.convert(p);
    for (const track of itr.tracks) {
      for (const clip of track.clips) {
        expect(typeof clip.speed).toBe('number');
      }
    }
  });

  test('speed defaults to 1 when not set', () => {
    const p = makeProject(30);
    const itr = converter.convert(p);
    const clip = itr.getVideoTracks()[0].clips[0];
    expect(clip.speed).toBe(1);
  });

  test('reverse is a boolean, not a function', () => {
    const p = makeProject(30);
    const itr = converter.convert(p);
    for (const track of itr.getVideoTracks()) {
      for (const clip of track.clips) {
        expect(typeof clip.reverse).toBe('boolean');
      }
    }
  });

  test('volume is a number, not a function', () => {
    const p = makeProject(30);
    const itr = converter.convert(p);
    for (const track of itr.tracks) {
      for (const clip of track.clips) {
        expect(typeof clip.volume).toBe('number');
      }
    }
  });

  test('mute is a boolean, not a function', () => {
    const p = makeProject(30);
    const itr = converter.convert(p);
    for (const track of itr.tracks) {
      for (const clip of track.clips) {
        expect(typeof clip.mute).toBe('boolean');
      }
    }
  });

  test('EDL speed comment does not contain function source code', () => {
    const p   = makeProject(30);
    const edl = new EdlExporter(p, { validateInput: false }).toString();
    expect(edl).not.toMatch(/function\s*\(/);
    expect(edl).not.toContain('_playbackRate');
  });
});

// ─── InterchangeValidator ─────────────────────────────────────────────────────

describe('InterchangeValidator — fps resolution', () => {
  const validator = new InterchangeValidator();

  test.each(RATES)('validateProject() reports valid for $fps project', ({ fps }) => {
    const result = validator.validateProject(makeProject(fps));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('validateProject() correctly reads fps from project.timeline (not undefined)', () => {
    const p = makeProject(24);
    // project.fps is undefined — validator must NOT fall back to 30 silently
    expect(p.fps).toBeUndefined();
    const result = validator.validateProject(p);
    expect(result.valid).toBe(true);
  });
});

// ─── PremiereXmlExporter — rate metadata ─────────────────────────────────────

describe('PremiereXmlExporter — fps in XML', () => {
  test.each(RATES)(
    'Premiere XML contains correct <timebase> for $fps',
    ({ fps, expectedTimebase, ntsc }) => {
      const p   = makeProject(fps);
      const xml = new PremiereXmlExporter(p, { validateInput: false, validateOutput: false }).toString();

      expect(xml).toContain(`<timebase>${expectedTimebase}</timebase>`);
      expect(xml).toContain(`<ntsc>${ntsc ? 'TRUE' : 'FALSE'}</ntsc>`);
    },
  );

  test('29.97fps project uses DF displayformat', () => {
    const p   = makeProject(29.97);
    const xml = new PremiereXmlExporter(p, { validateInput: false, validateOutput: false }).toString();
    expect(xml).toContain('<displayformat>DF</displayformat>');
  });

  test('24fps project uses NDF displayformat', () => {
    const p   = makeProject(24);
    const xml = new PremiereXmlExporter(p, { validateInput: false, validateOutput: false }).toString();
    expect(xml).toContain('<displayformat>NDF</displayformat>');
  });

  test('frame counts are correct for 24fps (5s clip = 120 frames)', () => {
    const p   = makeProject(24);
    const xml = new PremiereXmlExporter(p, { validateInput: false, validateOutput: false }).toString();
    expect(xml).toContain('<out>120</out>');
  });

  test('frame counts are correct for 60fps (5s clip = 300 frames)', () => {
    const p   = makeProject(60);
    const xml = new PremiereXmlExporter(p, { validateInput: false, validateOutput: false }).toString();
    expect(xml).toContain('<out>300</out>');
  });
});

// ─── FcpxmlExporter — rational time ──────────────────────────────────────────

describe('FcpxmlExporter — fps in XML', () => {
  test.each(RATES)(
    'FCPXML contains correct frameDuration for $fps',
    ({ fps, fcpDuration }) => {
      const p   = makeProject(fps);
      const xml = new FcpxmlExporter(p, { validateInput: false, validateOutput: false }).toString();
      expect(xml).toContain(`frameDuration="${fcpDuration}"`);
    },
  );

  test('29.97fps project has rational asset duration (not integer)', () => {
    const p   = makeProject(29.97);
    const xml = new FcpxmlExporter(p, { validateInput: false, validateOutput: false }).toString();
    // 5 seconds at 29.97 = 150150/30000s
    expect(xml).toMatch(/duration="\d+\/30000s"/);
  });

  test('24fps clip at 5s has duration 120/24s (= 5s)', () => {
    const p   = makeProject(24);
    const xml = new FcpxmlExporter(p, { validateInput: false, validateOutput: false }).toString();
    expect(xml).toContain('duration="120/24s"');
  });

  test('tcFormat is NDF for 30fps', () => {
    const p   = makeProject(30);
    const xml = new FcpxmlExporter(p, { validateInput: false, validateOutput: false }).toString();
    expect(xml).toContain('tcFormat="NDF"');
  });

  test('tcFormat is DF for 29.97fps', () => {
    const p   = makeProject(29.97);
    const xml = new FcpxmlExporter(p, { validateInput: false, validateOutput: false }).toString();
    expect(xml).toContain('tcFormat="DF"');
  });
});

// ─── EdlExporter — NDF vs DF ─────────────────────────────────────────────────

describe('EdlExporter — NDF/DF mode', () => {
  test.each(RATES)(
    'EDL uses $dfMode for $fps',
    ({ fps, dfMode }) => {
      const p   = makeProject(fps);
      const edl = new EdlExporter(p, { validateInput: false }).toString();
      expect(edl).toContain(`FCM: ${dfMode === 'DF' ? 'DROP FRAME' : 'NON-DROP FRAME'}`);
    },
  );

  test('29.97fps EDL timecodes use ; separator', () => {
    const p   = makeProject(29.97);
    const edl = new EdlExporter(p, { validateInput: false }).toString();
    expect(edl).toMatch(/\d{2}:\d{2}:\d{2};\d{2}/);
  });

  test('24fps EDL timecodes use : separator (NDF)', () => {
    const p   = makeProject(24);
    const edl = new EdlExporter(p, { validateInput: false }).toString();
    expect(edl).toMatch(/\d{2}:\d{2}:\d{2}:\d{2}/);
    expect(edl).not.toMatch(/\d{2}:\d{2}:\d{2};\d{2}/);
  });
});

// ─── TimeCode accuracy at various frame rates ─────────────────────────────────

describe('TimeCode — accuracy at all supported fps', () => {
  test.each(RATES)('5s at $fps round-trips via frames', ({ fps }) => {
    const tc     = new TimeCode(5, fps);
    const frames = tc.toFrames();
    const back   = TimeCode.fromFrames(frames, fps);
    expect(back.seconds).toBeCloseTo(5, 6);
  });

  test('29.97fps — 1s NDF is 00:00:01:00', () => {
    expect(new TimeCode(1, 29.97).toSmpteNdf()).toBe('00:00:01:00');
  });

  test('59.94fps — 1s NDF is 00:00:01:00', () => {
    expect(new TimeCode(1, 59.94).toSmpteNdf()).toBe('00:00:01:00');
  });

  test('24fps — 1s NDF is 00:00:01:00', () => {
    expect(new TimeCode(1, 24).toSmpteNdf()).toBe('00:00:01:00');
  });

  test('fcpFrameDuration is correct for all rates', () => {
    for (const { fps, fcpDuration } of RATES) {
      expect(TimeCode.fcpFrameDuration(fps)).toBe(fcpDuration);
    }
  });
});
