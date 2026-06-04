/**
 * @file premiere-fixes.test.js
 * Regression tests for the four targeted bug fixes in PremiereXmlExporter:
 *   Bug 1 — fadeIn/fadeOut effects produce opacity keyframes (not unknown effectid)
 *   Bug 2 — MP4 video clips with embedded audio emit both video and audio clipitems
 *   Bug 3 — Caption FadeAnimation/SlideAnimation produce Premiere keyframe filters
 *   Bug 4 — CaptionKeyframeSet opacity/position/scale/rotation produce Premiere keyframe filters
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import Project from '../../src/core/Project.js';
import PremiereXmlExporter from '../../src/exporters/PremiereXmlExporter.js';
import { FadeAnimation, SlideAnimation, ScaleAnimation, RotateAnimation, ZoomAnimation, BounceAnimation } from '../../src/captions/CaptionAnimation.js';
import { KeyframeSet } from '../../src/captions/CaptionKeyframe.js';

// ─── Shared options (skip validation for unit tests) ──────────────────────────

const OPT = { validateInput: false, validateOutput: false };

// ─── Helper: generate XML from a project ──────────────────────────────────────

function xml(project, opts = {}) {
  return new PremiereXmlExporter(project, { ...OPT, ...opts }).toString();
}

// ─── Bug 1: Fade In / Fade Out → opacity keyframes ───────────────────────────

describe('Bug 1 — fadeIn/fadeOut converted to Premiere opacity keyframes', () => {
  let project;
  let track;

  beforeEach(() => {
    project = new Project({ name: 'FadeTest', fps: 30, width: 1920, height: 1080 });
    track   = project.addTrack('video');
  });

  test('fadeIn(2) on a clip produces <effectid>opacity</effectid> filter', () => {
    const clip = track.addVideo('/footage/a.mp4', { inPoint: 0, outPoint: 10 });
    clip.fadeIn(2);
    const out = xml(project);
    expect(out).toContain('<effectid>opacity</effectid>');
  });

  test('fadeIn(2) does NOT produce unrecognised <effectid>fadeIn</effectid>', () => {
    const clip = track.addVideo('/footage/a.mp4', { inPoint: 0, outPoint: 10 });
    clip.fadeIn(2);
    const out = xml(project);
    expect(out).not.toContain('<effectid>fadeIn</effectid>');
  });

  test('fadeOut(1.5) produces <effectid>opacity</effectid> filter', () => {
    const clip = track.addVideo('/footage/b.mp4', { inPoint: 0, outPoint: 5 });
    clip.fadeOut(1.5);
    const out = xml(project);
    expect(out).toContain('<effectid>opacity</effectid>');
  });

  test('fadeOut(1.5) does NOT produce unrecognised <effectid>fadeOut</effectid>', () => {
    const clip = track.addVideo('/footage/b.mp4', { inPoint: 0, outPoint: 5 });
    clip.fadeOut(1.5);
    const out = xml(project);
    expect(out).not.toContain('<effectid>fadeOut</effectid>');
  });

  test('fadeIn produces <keyframe> elements inside the opacity parameter', () => {
    const clip = track.addVideo('/footage/c.mp4', { inPoint: 0, outPoint: 6 });
    clip.fadeIn(2);
    const out = xml(project);
    expect(out).toContain('<keyframe>');
    expect(out).toContain('<when>');
  });

  test('fadeOut produces the opacity-zero keyframe at start of fade', () => {
    // A 6-second clip at 30fps = 180 frames; 2-second fade starts at frame 120.
    const clip = track.addVideo('/footage/d.mp4', { inPoint: 0, outPoint: 6 });
    clip.fadeOut(2);
    const out = xml(project);
    // The fade-out starting value (fromOpacity=100) keyframe should appear at frame 120
    expect(out).toContain('<when>120</when>');
  });

  test('fadeIn + fadeOut on the same clip both emit keyframes without duplicate filters', () => {
    const clip = track.addVideo('/footage/e.mp4', { inPoint: 0, outPoint: 10 });
    clip.fadeIn(1);
    clip.fadeOut(1);
    const out = xml(project);
    // Only one opacity filter block should be emitted (merged)
    const opacityFilterCount = (out.match(/<effectid>opacity<\/effectid>/g) ?? []).length;
    expect(opacityFilterCount).toBe(1);
    // Should have at least 3 keyframes (in-start, in-end/out-start, out-end)
    const kfCount = (out.match(/<keyframe>/g) ?? []).length;
    expect(kfCount).toBeGreaterThanOrEqual(3);
  });
});

// ─── Bug 2: Embedded audio from MP4 video clips ────────────────────────────────

describe('Bug 2 — MP4 video clips with embedded audio emit audio clipitems', () => {
  test('video clip with asset.audioChannels=2 produces an audio clipitem', () => {
    const p  = new Project({ name: 'EmbeddedAudio', fps: 30, width: 1920, height: 1080 });
    const vt = p.addTrack('video');
    const clip = vt.addVideo('/footage/with_audio.mp4', { inPoint: 0, outPoint: 5 });
    // Mark asset as having embedded audio
    clip.asset.audioChannels = 2;

    const out = xml(p);

    // Should have a video clipitem AND an audio clipitem for the same master clip
    expect(out).toContain('<clipitem id="' + clip.id + '_video"');
    expect(out).toContain('<clipitem id="' + clip.id + '_audio"');
  });

  test('audio section contains audio clipitem when video clip has embedded audio', () => {
    const p  = new Project({ name: 'EmbeddedAudio2', fps: 30 });
    const vt = p.addTrack('video');
    const clip = vt.addVideo('/footage/with_audio.mp4', { inPoint: 0, outPoint: 5 });
    clip.asset.audioChannels = 2;

    const out = xml(p);

    // The audio clipitem must appear inside the <audio> section
    const audioSectionStart = out.indexOf('<audio>');
    const audioSectionEnd   = out.lastIndexOf('</audio>');
    const audioSection      = out.slice(audioSectionStart, audioSectionEnd);
    expect(audioSection).toContain(`id="${clip.id}_audio"`);
  });

  test('video clip WITHOUT embedded audio does not emit spurious audio clipitem', () => {
    const p  = new Project({ name: 'NoEmbedAudio', fps: 30 });
    const vt = p.addTrack('video');
    const clip = vt.addVideo('/footage/videoonly.mp4', { inPoint: 0, outPoint: 5 });
    // Do NOT set audioChannels — defaults to 0 (no audio)

    const out = xml(p);

    // Should NOT have an audio clipitem for this clip in the audio section
    const audioSectionStart = out.indexOf('<audio>');
    const audioSectionEnd   = out.lastIndexOf('</audio>');
    const audioSection      = out.slice(audioSectionStart, audioSectionEnd);
    expect(audioSection).not.toContain(`id="${clip.id}_audio"`);
  });

  test('multiple video clips — only the one with audioChannels gets audio clipitem', () => {
    const p  = new Project({ name: 'Mixed', fps: 30 });
    const vt = p.addTrack('video');
    const clipA = vt.addVideo('/footage/a.mp4', { inPoint: 0, outPoint: 5 });
    const clipB = vt.addVideo('/footage/b.mp4', { inPoint: 5, outPoint: 10 });
    clipA.asset.audioChannels = 2;

    const out = xml(p);
    expect(out).toContain(`id="${clipA.id}_audio"`);
    expect(out).not.toContain(`id="${clipB.id}_audio"`);
  });

  test('embedded audio clipitem preserves trim points (in/out frames)', () => {
    const p  = new Project({ name: 'Trim', fps: 30 });
    const vt = p.addTrack('video');
    const clip = vt.addVideo('/footage/a.mp4', { inPoint: 2, outPoint: 7 });
    clip.asset.audioChannels = 2;

    const out = xml(p);

    // in=2s@30fps=60, out=7s@30fps=210
    const audioClipStart = out.indexOf(`id="${clip.id}_audio"`);
    const audioClipEnd   = out.indexOf('</clipitem>', audioClipStart);
    const audioClip      = out.slice(audioClipStart, audioClipEnd);

    expect(audioClip).toContain('<in>60</in>');
    expect(audioClip).toContain('<out>210</out>');
  });
});

// ─── Bug 3: Caption animations → Premiere keyframe filters ────────────────────

describe('Bug 3 — Caption FadeAnimation produces Premiere opacity keyframe filter', () => {
  function makeProjectWithCaptionClip(setupFn) {
    const p  = new Project({ name: 'CaptionAnim', fps: 30, width: 1920, height: 1080 });
    const vt = p.addTrack('video');
    vt.addVideo('/footage/main.mp4', { inPoint: 0, outPoint: 10 });
    const ct = p.addTrack('caption');
    const clip = ct.addCaption('Hello world', { outPoint: 5 });
    if (setupFn) setupFn(clip);
    return { p, clip };
  }

  test('FadeAnimation (direction=in) on caption produces opacity keyframes in generatoritem', () => {
    const { p } = makeProjectWithCaptionClip((clip) => {
      clip.addAnimation(new FadeAnimation({ direction: 'in', duration: 1 }));
    });
    const out = xml(p);
    // generatoritem should contain an opacity filter
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    expect(genBlock).toContain('<effectid>opacity</effectid>');
    expect(genBlock).toContain('<keyframe>');
  });

  test('FadeAnimation (direction=out) produces opacity going from 100 to 0', () => {
    const { p } = makeProjectWithCaptionClip((clip) => {
      clip.addAnimation(new FadeAnimation({ direction: 'out', duration: 1 }));
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    expect(genBlock).toContain('<effectid>opacity</effectid>');
    // First keyframe should have value 100 (fromOpacity=1 for direction=out)
    const firstKfMatch = genBlock.match(/<keyframe>.*?<when>0<\/when>.*?<value>(\d+)<\/value>/s);
    expect(firstKfMatch).not.toBeNull();
    expect(firstKfMatch[1]).toBe('100');
  });

  test('FadeAnimation with delay produces hold keyframe before the fade starts', () => {
    const { p } = makeProjectWithCaptionClip((clip) => {
      clip.addAnimation(new FadeAnimation({ direction: 'in', duration: 1, delay: 0.5 }));
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    // delay=0.5s@30fps → frame 15 should be a hold keyframe (value=0 if direction=in)
    expect(genBlock).toContain('<when>15</when>');
  });

  test('SlideAnimation (direction=up) produces motion center keyframe filter', () => {
    const { p } = makeProjectWithCaptionClip((clip) => {
      clip.addAnimation(new SlideAnimation({ direction: 'up', distance: 60, duration: 0.5 }));
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    expect(genBlock).toContain('<effectid>motion</effectid>');
    expect(genBlock).toContain('<parameterid>center</parameterid>');
    expect(genBlock).toContain('<keyframe>');
  });

  test('SlideAnimation with fade=true also emits an opacity filter', () => {
    const { p } = makeProjectWithCaptionClip((clip) => {
      clip.addAnimation(new SlideAnimation({ direction: 'left', fade: true, duration: 0.5 }));
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    expect(genBlock).toContain('<effectid>motion</effectid>');
    expect(genBlock).toContain('<effectid>opacity</effectid>');
  });

  test('ScaleAnimation produces motion scale keyframe filter', () => {
    const { p } = makeProjectWithCaptionClip((clip) => {
      clip.addAnimation(new ScaleAnimation({ fromScale: 0, toScale: 1, duration: 0.5 }));
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    expect(genBlock).toContain('<parameterid>scale</parameterid>');
    expect(genBlock).toContain('<keyframe>');
  });

  test('ZoomAnimation (mode=in) produces scale keyframe filter', () => {
    const { p } = makeProjectWithCaptionClip((clip) => {
      clip.addAnimation(new ZoomAnimation({ mode: 'in', duration: 0.5 }));
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    expect(genBlock).toContain('<parameterid>scale</parameterid>');
  });

  test('RotateAnimation produces motion rotation keyframe filter', () => {
    const { p } = makeProjectWithCaptionClip((clip) => {
      clip.addAnimation(new RotateAnimation({ fromDegrees: -90, toDegrees: 0, duration: 0.5 }));
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    expect(genBlock).toContain('<parameterid>rotation</parameterid>');
    expect(genBlock).toContain('<keyframe>');
  });

  test('unsupported animation type (BounceAnimation) emits XML comment, not a filter', () => {
    const { p } = makeProjectWithCaptionClip((clip) => {
      clip.addAnimation(new BounceAnimation({ duration: 0.5 }));
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    // Should have a comment mentioning the unsupported type, but no bounce filter
    expect(genBlock).toContain('bounce');
    expect(genBlock).toContain('<!--');
    expect(genBlock).not.toContain('<effectid>bounce</effectid>');
  });

  test('disabled animation is skipped', () => {
    const { p } = makeProjectWithCaptionClip((clip) => {
      const anim  = new FadeAnimation({ direction: 'in', duration: 1 });
      anim.enabled = false;
      clip.addAnimation(anim);
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    // No animation-produced opacity filter should appear (only the text/style effect block)
    expect(genBlock).not.toContain('<keyframe>');
  });
});

// ─── Bug 4: CaptionKeyframeSet → Premiere keyframe filters ───────────────────

describe('Bug 4 — CaptionKeyframeSet produces Premiere keyframe filters', () => {
  function makeProjectWithKeyframes(setupFn) {
    const p  = new Project({ name: 'CaptionKf', fps: 30, width: 1920, height: 1080 });
    const vt = p.addTrack('video');
    vt.addVideo('/footage/main.mp4', { inPoint: 0, outPoint: 10 });
    const ct = p.addTrack('caption');
    const clip = ct.addCaption('Hello', { outPoint: 5 });
    if (setupFn) setupFn(clip);
    return { p, clip };
  }

  test('opacity keyframe track produces opacity filter with keyframes in generatoritem', () => {
    const { p } = makeProjectWithKeyframes((clip) => {
      const kfs = clip.captionKeyframeSet;
      kfs.set('opacity', 0,   0);
      kfs.set('opacity', 1,   1);
      kfs.set('opacity', 4,   1);
      kfs.set('opacity', 4.5, 0);
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    expect(genBlock).toContain('<effectid>opacity</effectid>');
    expect(genBlock).toContain('<keyframe>');
  });

  test('opacity keyframe values are multiplied by 100 (Premiere scale)', () => {
    const { p } = makeProjectWithKeyframes((clip) => {
      const kfs = clip.captionKeyframeSet;
      kfs.set('opacity', 0, 0);
      kfs.set('opacity', 1, 1);
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    // frame 0 → opacity 0 → value 0; frame 30 → opacity 1 → value 100
    expect(genBlock).toMatch(/<when>0<\/when>\s*<value>0<\/value>/);
    expect(genBlock).toMatch(/<when>30<\/when>\s*<value>100<\/value>/);
  });

  test('x/y keyframe tracks produce motion center filter in generatoritem', () => {
    const { p } = makeProjectWithKeyframes((clip) => {
      const kfs = clip.captionKeyframeSet;
      kfs.set('x', 0, 0);
      kfs.set('x', 2, 100);
      kfs.set('y', 0, 0);
      kfs.set('y', 2, -50);
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    expect(genBlock).toContain('<parameterid>center</parameterid>');
    expect(genBlock).toContain('<keyframe>');
  });

  test('scaleX keyframe track produces motion scale filter in generatoritem', () => {
    const { p } = makeProjectWithKeyframes((clip) => {
      const kfs = clip.captionKeyframeSet;
      kfs.set('scaleX', 0, 0.5);
      kfs.set('scaleX', 1, 1.0);
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    expect(genBlock).toContain('<parameterid>scale</parameterid>');
    // 0.5 * 100 = 50; 1.0 * 100 = 100
    expect(genBlock).toContain('<value>50</value>');
    expect(genBlock).toContain('<value>100</value>');
  });

  test('rotation keyframe track produces motion rotation filter in generatoritem', () => {
    const { p } = makeProjectWithKeyframes((clip) => {
      const kfs = clip.captionKeyframeSet;
      kfs.set('rotation', 0, -90);
      kfs.set('rotation', 1, 0);
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    expect(genBlock).toContain('<parameterid>rotation</parameterid>');
    expect(genBlock).toContain('<value>-90</value>');
  });

  test('center keyframe pixel values use half-width+offset convention', () => {
    // 1920x1080 project; offset x=100 at t=0 → center = 960+100=1060 540+0=540
    const { p } = makeProjectWithKeyframes((clip) => {
      const kfs = clip.captionKeyframeSet;
      kfs.set('x', 0, 100);
      kfs.set('y', 0, 0);
    });
    const out = xml(p);
    const genStart = out.indexOf('<generatoritem');
    const genEnd   = out.indexOf('</generatoritem>', genStart);
    const genBlock = out.slice(genStart, genEnd);
    expect(genBlock).toContain('1060 540');
  });
});
