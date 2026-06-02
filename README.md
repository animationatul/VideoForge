# VideoForge

A developer-first JavaScript (Node.js) library for building video editors, automation tools, and AI-powered editing systems.

VideoForge provides a **Timeline Engine** as its core abstraction. You compose a project by adding tracks and clips, attaching effects, and exporting to any supported format — all through a clean, chainable API. No UI, no FFmpeg wiring required for the library itself.

---

## Architecture

```
Project
├── Timeline          ← query engine (duration, fps, resolution)
├── Tracks[]
│   └── Clips[]       ← VideoClip / AudioClip / ImageClip / TextClip / ShapeClip
│       └── Effects[] ← FadeEffect / Transition / custom Effect
└── Exporters         ← JSON / Premiere XML / FCPXML / MP4
```

The MCP server is **not** part of this library — it acts as a thin layer that calls the library API.

---

## Installation

```bash
npm install videoforge
# or, within this repo:
node examples/basic-usage.js
```

Requires Node.js ≥ 18.

---

## Quick Start

```js
import { Project } from 'videoforge';

const project = new Project({ name: 'My Edit', fps: 30 });

const track = project.addTrack('video');
const clip  = track.addVideo('intro.mp4');

clip.trim(5, 20);   // use source seconds 5–20
clip.fadeIn(1);     // 1-second opacity ramp

await project.export({
  type:   'json',
  output: './project.vfp',
});
```

---

## API Reference

### `Project`

```js
import { Project } from 'videoforge';

const project = new Project({ name: 'My Film', fps: 24, width: 3840, height: 2160 });

// Tracks
const track = project.addTrack('video');        // returns Track
project.getTrack(id);                           // Track | undefined
project.track(id);                              // alias for getTrack
project.removeTrack(id);                        // boolean
project.getTracks();                            // Track[]
project.reorderTracks([id1, id2, id3]);         // Project (chainable)

// Export
await project.export({ type: 'json',    output: './out.vfp'     });
await project.export({ type: 'premiere', output: './out.xml'    });
await project.export({ type: 'fcpxml',  output: './out.fcpxml'  });
await project.export({ type: 'mp4',     output: './out.mp4'     }); // requires FFmpeg

// Persistence
await project.save('./autosave.vfp');
const loaded = await Project.load('./autosave.vfp');

// Serialisation
const json = project.toJSON();
const clone = Project.fromJSON(json);
```

---

### `Track`

```js
const videoTrack = project.addTrack('video');
const audioTrack = project.addTrack('audio');
const textTrack  = project.addTrack('text');
const shapeTrack = project.addTrack('shape');

// Clip factories (returns the created clip)
const clip = videoTrack.addVideo('footage.mp4', { outPoint: 60 });
              audioTrack.addAudio('music.mp3');
              textTrack .addText('Hello World', { fontSizeValue: 48 });
              shapeTrack.addShape('rectangle', { width: 200, height: 100 });
              videoTrack.addImage('logo.png');

// Management
track.getClip(id);       // Clip | undefined
track.getClips();        // Clip[] sorted by startTime
track.removeClip(id);    // boolean
track.moveClip(id, t);   // boolean
track.getDuration();     // number (seconds)
```

---

### `Clip` (base — all subclasses inherit these)

```js
clip.trim(5, 20);         // set in/out points (source seconds)
clip.move(30);            // reposition on the timeline
clip.split(60);           // returns { head, tail }
clip.copy();              // deep-clone with new ID
clip.remove();            // removes from owning track

clip.fadeIn(1);           // 1-second fade-in effect
clip.fadeOut(0.5);        // 0.5-second fade-out effect

clip.addEffect(effect);   // append to effect chain
clip.removeEffect(id);    // boolean
clip.getEffect(id);       // Effect | undefined

clip.toJSON();            // serialise
```

---

### `VideoClip`

```js
const clip = track.addVideo('scene.mp4');

clip.volume(0.8);   // set volume (0–2), returns this
clip.volume();      // read current value → 0.8
clip.mute();        // silence without losing volume setting
clip.unmute();

clip.speed(2);      // 2× playback speed
clip.speed();       // read → 2
clip.reverse();     // toggle reversed playback
clip.reverse(true); // set explicitly
```

---

### `AudioClip`

```js
const music = track.addAudio('bg.mp3');

music.volume(0.5);
music.pan(-0.3);    // stereo pan (-1 left … 0 center … 1 right)
music.speed(1.05);
music.mute();
```

---

### `ImageClip`

```js
const logo = track.addImage('logo.png', { outPoint: 10 });

logo.position(100, 50);    // x, y on canvas
logo.position();           // → { x: 100, y: 50 }
logo.scale(0.5);           // uniform scale
logo.scale(1.5, 1);        // non-uniform
logo.rotation(45);         // degrees clockwise
logo.opacity(0.8);         // 0–1
```

---

### `TextClip`

```js
const title = track.addText('VideoForge', { startTime: 0, outPoint: 5 });

title.font('Helvetica Neue');
title.fontSize(72);
title.color('#FFFFFF');
title.background('#00000080');  // semi-transparent black
title.align('center');          // 'left' | 'center' | 'right' | 'justify'
title.bold(true);
title.italic(false);
title.position(960, 540);
title.opacity(0.9);
```

---

### `ShapeClip`

```js
import { SHAPE_TYPES } from 'videoforge';

const box = track.addShape(SHAPE_TYPES.RECTANGLE);

box.position(0, 900);
box.size(640, 80);
box.fillColor('#1A1A2E');
box.strokeColor('#FFFFFF');
box.strokeWidth(2);
box.opacity(0.85);
box.rotation(0);
box.cornerRadius(8);
```

---

### Effects

```js
import { FadeEffect, Transition, TRANSITION_TYPES, EASING } from 'videoforge';

// Manual effect construction
const fadeIn  = new FadeEffect('in',  1.5, { easing: EASING.EASE_OUT });
const fadeOut = new FadeEffect('out', 1,   { easing: EASING.EASE_IN });

clip.addEffect(fadeIn);

// Transitions link two adjacent clips
const dissolve = new Transition(TRANSITION_TYPES.CROSS_DISSOLVE, 1);
dissolve.link(clipA, clipB);
clipB.addEffect(dissolve);

// Opacity at a given moment within a fade
const opacity = fadeIn.getOpacityAt(0.75); // seconds into the fade
```

---

### `Timeline`

```js
const tl = project.timeline;

tl.getTotalDuration();        // seconds
tl.getTotalFrames();          // frame count
tl.timeToFrame(12.5);         // → 375  (at 30fps)
tl.frameToTime(375);          // → 12.5

tl.getClipsAtTime(10);        // Clip[] active at t=10s
tl.getClipsInRange(5, 15);    // Clip[] overlapping the window
tl.findOverlaps();            // [[clipA, clipB], ...] conflicts per track
tl.getClipCount();
tl.getTrackCount();
```

---

### Exporters

All exporters are available directly if you need lower-level access:

```js
import { JsonExporter, PremiereXmlExporter, FcpxmlExporter } from 'videoforge';

const exporter = new JsonExporter(project, { pretty: true });
await exporter.export('./output/project.vfp');

// In-memory — no file written
const obj = new JsonExporter(project).toObject();
const str = new JsonExporter(project).toString();
```

---

### Preview (skeleton)

```js
import { PreviewRenderer, PreviewPlayer } from 'videoforge';

const renderer = new PreviewRenderer(project.timeline);
renderer.setBackend(myCanvasBackend);  // bring your own backend

const player = new PreviewPlayer(renderer, project.timeline, {
  loop: true,
  onFrame: (time, frame) => { /* draw frame */ },
  onStateChange: (state) => console.log('State:', state),
});

player.play();
player.seek(30);
player.pause();
player.stop();

console.log(player.currentTime);  // seconds
console.log(player.state);        // 'playing' | 'paused' | 'idle' | 'ended'
```

---

## File Structure

```
src/
├── core/
│   ├── Project.js        Root project — owns tracks and timeline
│   ├── Track.js          Clip container for one timeline lane
│   ├── Clip.js           Abstract base for all clip types
│   ├── Asset.js          Source media file reference
│   └── Timeline.js       Temporal query engine
│
├── clips/
│   ├── VideoClip.js      Video with volume/speed/reverse controls
│   ├── AudioClip.js      Audio with volume/pan/speed controls
│   ├── ImageClip.js      Still image with 2-D transforms
│   ├── TextClip.js       Synthetic text renderer
│   └── ShapeClip.js      Synthetic geometry renderer
│
├── effects/
│   ├── Effect.js         Abstract base for all effects
│   ├── FadeEffect.js     Opacity ramp (in / out)
│   └── Transition.js     Between-clip transition (dissolve, wipe, …)
│
├── exporters/
│   ├── Exporter.js            Abstract base exporter
│   ├── JsonExporter.js        VideoForge JSON (.vfp) — fully implemented
│   ├── PremiereXmlExporter.js FCP7/Premiere XML — skeleton
│   ├── FcpxmlExporter.js      FCPXML 1.10 — skeleton
│   └── Mp4Exporter.js         FFmpeg render — skeleton
│
├── preview/
│   ├── PreviewPlayer.js    Playback driver (rAF / setInterval)
│   └── PreviewRenderer.js  Frame compositor (backend-agnostic)
│
├── utils/
│   ├── IdGenerator.js     Prefixed unique IDs + UUID v4
│   └── Constants.js       All enumerations and defaults
│
└── index.js               Public surface — re-exports everything
```

---

## Constants

```js
import {
  TRACK_TYPES,      // video | audio | image | text | shape
  CLIP_TYPES,       // video | audio | image | text | shape
  ASSET_TYPES,      // video | audio | image | font | synthetic
  EFFECT_TYPES,     // fadeIn | fadeOut | transition | colorCorrection | blur | custom
  TRANSITION_TYPES, // crossDissolve | wipeLeft | wipeRight | wipeUp | wipeDown | slide | zoom | dipToBlack | dipToWhite
  EXPORT_TYPES,     // json | premiere | fcpxml | mp4
  SHAPE_TYPES,      // rectangle | ellipse | triangle | line | polygon | arrow
  TEXT_ALIGN,       // left | center | right | justify
  PLAYER_STATE,     // idle | playing | paused | buffering | ended
  EASING,           // linear | easeIn | easeOut | easeInOut
  DEFAULTS,         // { FPS, WIDTH, HEIGHT, SAMPLE_RATE, … }
} from 'videoforge';
```

---

## Extending VideoForge

### Custom Effect

```js
import { Effect, EFFECT_TYPES } from 'videoforge';

class ChromaKeyEffect extends Effect {
  constructor(keyColor = '#00FF00', tolerance = 0.1) {
    super(EFFECT_TYPES.CUSTOM, { keyColor, tolerance });
  }

  apply(context) {
    if (!this.enabled) return context;
    // TODO: GPU shader or pixel-level chroma key.
    return context;
  }
}
```

### Custom Exporter

```js
import { Exporter } from 'videoforge';
import { promises as fs } from 'fs';

class EdlExporter extends Exporter {
  async export(outputPath) {
    this.validate();
    const dest = this.resolveOutputPath(outputPath, '.edl');
    const edl  = this._buildEdl();
    await fs.writeFile(dest, edl, 'utf8');
    return dest;
  }

  _buildEdl() {
    // CMX3600 EDL format
    let lines = ['TITLE: ' + this.project.name, 'FCM: NON-DROP FRAME', ''];
    // … build edit decision list from tracks …
    return lines.join('\n');
  }
}
```

---

## Roadmap

- [ ] Clip-type `fromJSON` registry (full round-trip deserialisation)
- [ ] Premiere XML / FCPXML track-level generation
- [ ] MP4 render pipeline (FFmpeg filter-complex builder)
- [ ] `node-canvas` PreviewRenderer backend
- [ ] Color correction effect (LUT / curves)
- [ ] Keyframe animation on any numeric property
- [ ] MCP server layer (separate package: `videoforge-mcp`)

---

## License

MIT
