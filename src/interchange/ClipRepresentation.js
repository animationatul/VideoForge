/**
 * @module ClipRepresentation
 * Canonical representation of a single clip in the Intermediate Timeline.
 *
 * Covers video, audio, image, text, shape, and caption clips.
 * All times are in seconds.
 */

import IdGenerator from '../utils/IdGenerator.js';

class ClipRepresentation {
  /**
   * @param {object} [data={}]
   * @param {string}  [data.id]
   * @param {string}  [data.type='video']         - 'video'|'audio'|'image'|'text'|'shape'|'caption'
   * @param {string}  [data.assetId='']           - ID of the AssetReference (empty for synthetic clips).
   * @param {string}  [data.name='']
   *
   * Timeline position (in seconds):
   * @param {number}  [data.timelineStart=0]      - Start position on the project timeline.
   * @param {number}  [data.timelineEnd=0]        - End position on the project timeline.
   *
   * Source in/out (in seconds, relative to the source asset):
   * @param {number}  [data.sourceStart=0]        - In-point within the source file.
   * @param {number}  [data.sourceEnd=0]          - Out-point within the source file.
   *
   * Transform:
   * @param {number}  [data.speed=1]              - Playback speed multiplier.
   * @param {boolean} [data.reverse=false]        - Play in reverse.
   * @param {boolean} [data.mute=false]           - Mute audio on this clip.
   * @param {number}  [data.volume=1]             - Audio volume (0–2).
   * @param {number}  [data.opacity=1]            - Video opacity (0–1).
   * @param {object}  [data.position={x:0,y:0}]  - Pixel position offset.
   * @param {object}  [data.scale={x:1,y:1}]     - Scale.
   * @param {number}  [data.rotation=0]           - Rotation in degrees.
   * @param {object}  [data.crop={l:0,r:0,t:0,b:0}] - Crop in pixels.
   * @param {object}  [data.anchor={x:0.5,y:0.5}] - Anchor point [0,1].
   *
   * Effects and transitions:
   * @param {import('./EffectRepresentation.js').default[]}     [data.effects=[]]
   * @param {import('./TransitionRepresentation.js').default[]} [data.transitions=[]]
   *
   * Caption data (only for type === 'caption'):
   * @param {import('./CaptionRepresentation.js').default|null} [data.captionData=null]
   *
   * Passthrough for unsupported properties:
   * @param {object}  [data.videoForgeMetadata={}]
   */
  constructor(data = {}) {
    this.id            = data.id            ?? IdGenerator.generate('clip');
    this.type          = data.type          ?? 'video';
    this.assetId       = data.assetId       ?? '';
    this.name          = data.name          ?? '';

    // Timeline position
    this.timelineStart = data.timelineStart ?? 0;
    this.timelineEnd   = data.timelineEnd   ?? 0;

    // Source in/out
    this.sourceStart   = data.sourceStart   ?? 0;
    this.sourceEnd     = data.sourceEnd     ?? 0;

    // Transform
    this.speed         = data.speed         ?? 1;
    this.reverse       = data.reverse       ?? false;
    this.mute          = data.mute          ?? false;
    this.volume        = data.volume        ?? 1;
    this.opacity       = data.opacity       ?? 1;
    this.position      = data.position      ?? { x: 0, y: 0 };
    this.scale         = data.scale         ?? { x: 1, y: 1 };
    this.rotation      = data.rotation      ?? 0;
    this.crop          = data.crop          ?? { l: 0, r: 0, t: 0, b: 0 };
    this.anchor        = data.anchor        ?? { x: 0.5, y: 0.5 };

    this.effects       = data.effects       ?? [];
    this.transitions   = data.transitions   ?? [];
    this.captionData   = data.captionData   ?? null;
    this.videoForgeMetadata = data.videoForgeMetadata ?? {};
  }

  // ─── Computed properties ──────────────────────────────────────────────────────

  /** Duration on the timeline (seconds). */
  get timelineDuration() { return this.timelineEnd - this.timelineStart; }

  /** Duration of the source segment used (accounts for speed). */
  get sourceDuration() { return this.sourceEnd - this.sourceStart; }

  /** @returns {boolean} */
  get isVideo()   { return this.type === 'video'; }

  /** @returns {boolean} */
  get isAudio()   { return this.type === 'audio'; }

  /** @returns {boolean} */
  get isImage()   { return this.type === 'image'; }

  /** @returns {boolean} */
  get isText()    { return this.type === 'text' || this.type === 'shape'; }

  /** @returns {boolean} */
  get isCaption() { return this.type === 'caption'; }

  /**
   * Build from a VideoForge Clip instance.
   * @param {import('../core/Clip.js').default} clip
   * @param {import('./EffectRepresentation.js').default[]} [effectReps=[]]
   * @param {import('./CaptionRepresentation.js').default|null} [captionRep=null]
   * @returns {ClipRepresentation}
   */
  static fromClip(clip, effectReps = [], captionRep = null) {
    // VideoClip/AudioClip store these on private _* properties because the
    // public names (speed, volume, reverse, mute, opacity, position, scale,
    // rotation) are getter/setter methods, not plain properties.
    // We read the private backing fields with a safe fallback to the default.
    return new ClipRepresentation({
      id:            clip.id,
      type:          clip.type,
      assetId:       clip.asset?.id ?? '',
      name:          clip.name ?? '',
      timelineStart: clip.startTime,
      timelineEnd:   clip.endTime,
      sourceStart:   clip.inPoint,
      sourceEnd:     clip.outPoint,
      speed:         clip._playbackRate   ?? 1,
      reverse:       clip._reversed       ?? false,
      mute:          clip._muted          ?? false,
      volume:        clip._volumeLevel    ?? 1,
      opacity:       clip._opacityLevel   ?? 1,
      position:      (clip._x != null || clip._y != null)
                       ? { x: clip._x ?? 0, y: clip._y ?? 0 }
                       : { x: 0, y: 0 },
      scale:         (clip._scaleX != null || clip._scaleY != null)
                       ? { x: clip._scaleX ?? 1, y: clip._scaleY ?? 1 }
                       : { x: 1, y: 1 },
      rotation:      clip._rotation       ?? 0,
      crop:          clip.crop ?? { l: 0, r: 0, t: 0, b: 0 },
      anchor:        clip.anchor ?? { x: 0.5, y: 0.5 },
      effects:       effectReps,
      captionData:   captionRep,
    });
  }

  toJSON() {
    return {
      id:            this.id,
      type:          this.type,
      assetId:       this.assetId,
      name:          this.name,
      timelineStart: this.timelineStart,
      timelineEnd:   this.timelineEnd,
      sourceStart:   this.sourceStart,
      sourceEnd:     this.sourceEnd,
      speed:         this.speed,
      reverse:       this.reverse,
      mute:          this.mute,
      volume:        this.volume,
      opacity:       this.opacity,
      position:      this.position,
      scale:         this.scale,
      rotation:      this.rotation,
      crop:          this.crop,
      anchor:        this.anchor,
      effects:       this.effects.map((e) => (typeof e.toJSON === 'function' ? e.toJSON() : e)),
      transitions:   this.transitions.map((t) => (typeof t.toJSON === 'function' ? t.toJSON() : t)),
      captionData:   this.captionData ? (typeof this.captionData.toJSON === 'function' ? this.captionData.toJSON() : this.captionData) : null,
      videoForgeMetadata: this.videoForgeMetadata,
    };
  }
}

export default ClipRepresentation;
