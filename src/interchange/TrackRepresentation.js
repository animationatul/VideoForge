/**
 * @module TrackRepresentation
 * Canonical representation of a timeline track in the ITR.
 */

import IdGenerator from '../utils/IdGenerator.js';

class TrackRepresentation {
  /**
   * @param {object} [data={}]
   * @param {string}  [data.id]
   * @param {string}  [data.type='video']     - 'video'|'audio'|'caption'|'text'|'shape'
   * @param {string}  [data.name='']
   * @param {number}  [data.index=0]          - Zero-based track index in the timeline.
   * @param {boolean} [data.muted=false]
   * @param {boolean} [data.solo=false]
   * @param {boolean} [data.locked=false]
   * @param {boolean} [data.visible=true]
   * @param {number}  [data.volume=1]         - Track master volume.
   * @param {import('./ClipRepresentation.js').default[]} [data.clips=[]]
   */
  constructor(data = {}) {
    this.id      = data.id      ?? IdGenerator.generate('track');
    this.type    = data.type    ?? 'video';
    this.name    = data.name    ?? '';
    this.index   = data.index   ?? 0;
    this.muted   = data.muted   ?? false;
    this.solo    = data.solo    ?? false;
    this.locked  = data.locked  ?? false;
    this.visible = data.visible ?? true;
    this.volume  = data.volume  ?? 1;

    /** @type {import('./ClipRepresentation.js').default[]} */
    this.clips   = data.clips   ?? [];
  }

  // ─── Computed properties ──────────────────────────────────────────────────────

  /** @returns {number} Total duration = end time of last clip. */
  get duration() {
    if (this.clips.length === 0) return 0;
    return Math.max(...this.clips.map((c) => c.timelineEnd));
  }

  /** @returns {boolean} */
  get isVideo()   { return this.type === 'video'; }

  /** @returns {boolean} */
  get isAudio()   { return this.type === 'audio'; }

  /** @returns {boolean} */
  get isCaption() { return this.type === 'caption'; }

  /** Return clips sorted by timelineStart. */
  getSortedClips() {
    return [...this.clips].sort((a, b) => a.timelineStart - b.timelineStart);
  }

  /**
   * Build from a VideoForge Track instance.
   * @param {import('../core/Track.js').default} track
   * @param {number} index
   * @param {import('./ClipRepresentation.js').default[]} clipReps
   * @returns {TrackRepresentation}
   */
  static fromTrack(track, index, clipReps) {
    return new TrackRepresentation({
      id:      track.id,
      type:    track.type,
      name:    track.name,
      index,
      muted:   track.muted,
      solo:    track.solo,
      locked:  track.locked,
      visible: track.visible,
      volume:  track.volume,
      clips:   clipReps,
    });
  }

  toJSON() {
    return {
      id:      this.id,
      type:    this.type,
      name:    this.name,
      index:   this.index,
      muted:   this.muted,
      solo:    this.solo,
      locked:  this.locked,
      visible: this.visible,
      volume:  this.volume,
      clips:   this.clips.map((c) => (typeof c.toJSON === 'function' ? c.toJSON() : c)),
    };
  }
}

export default TrackRepresentation;
