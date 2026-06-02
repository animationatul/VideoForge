/**
 * @module Timeline
 * The Timeline is the temporal backbone of a Project.
 *
 * It does not own clips directly — that is the Track's responsibility.
 * Instead it acts as a query engine: given a playhead position it can
 * resolve which clips and effects are active, detect overlaps, and provide
 * metadata about the overall edit.
 */

import { DEFAULTS } from '../utils/Constants.js';

class Timeline {
  /**
   * @param {object} [options={}]
   * @param {number} [options.fps=30]
   * @param {number} [options.width=1920]
   * @param {number} [options.height=1080]
   * @param {number} [options.sampleRate=48000]
   * @param {number} [options.channels=2]
   */
  constructor(options = {}) {
    /** @type {number} Frames per second. */
    this.fps = options.fps ?? DEFAULTS.FPS;

    /** @type {number} Canvas width in pixels. */
    this.width = options.width ?? DEFAULTS.WIDTH;

    /** @type {number} Canvas height in pixels. */
    this.height = options.height ?? DEFAULTS.HEIGHT;

    /** @type {number} Audio sample rate (Hz). */
    this.sampleRate = options.sampleRate ?? DEFAULTS.SAMPLE_RATE;

    /** @type {number} Audio channels (1 = mono, 2 = stereo). */
    this.channels = options.channels ?? DEFAULTS.CHANNELS;

    /**
     * Back-reference to the owning Project — set by Project on construction.
     * @type {import('./Project.js').default|null}
     */
    this._project = null;
  }

  // ─── Computed properties ─────────────────────────────────────────────────────

  /**
   * Total project duration in seconds (end time of the last clip across all tracks).
   * @returns {number}
   */
  getTotalDuration() {
    if (!this._project) return 0;
    const durations = this._project.getTracks().map((t) => t.getDuration());
    return durations.length > 0 ? Math.max(...durations) : 0;
  }

  /**
   * Total duration expressed as a frame count.
   * @returns {number}
   */
  getTotalFrames() {
    return Math.ceil(this.getTotalDuration() * this.fps);
  }

  /**
   * Convert a timeline time (seconds) to the corresponding frame number.
   * @param {number} time
   * @returns {number}
   */
  timeToFrame(time) {
    return Math.floor(time * this.fps);
  }

  /**
   * Convert a frame number to the corresponding time in seconds.
   * @param {number} frame
   * @returns {number}
   */
  frameToTime(frame) {
    return frame / this.fps;
  }

  // ─── Query API ────────────────────────────────────────────────────────────────

  /**
   * Return all clips (across all tracks) that are active at `time`.
   * @param {number} time - Timeline position in seconds.
   * @returns {import('./Clip.js').default[]}
   */
  getClipsAtTime(time) {
    if (!this._project) return [];
    return this._project
      .getTracks()
      .flatMap((t) => t.getClips())
      .filter((c) => c.startTime <= time && c.endTime > time);
  }

  /**
   * Return all clips in the half-open interval [startTime, endTime).
   * @param {number} startTime
   * @param {number} endTime
   * @returns {import('./Clip.js').default[]}
   */
  getClipsInRange(startTime, endTime) {
    if (!this._project) return [];
    return this._project
      .getTracks()
      .flatMap((t) => t.getClips())
      .filter((c) => c.startTime < endTime && c.endTime > startTime);
  }

  /**
   * Detect clips that overlap on the same track (potential edit conflicts).
   * Returns pairs of conflicting clips.
   *
   * @returns {Array<[import('./Clip.js').default, import('./Clip.js').default]>}
   */
  findOverlaps() {
    if (!this._project) return [];
    const conflicts = [];

    for (const track of this._project.getTracks()) {
      const clips = track.getClips();
      for (let i = 0; i < clips.length - 1; i++) {
        if (clips[i].endTime > clips[i + 1].startTime) {
          conflicts.push([clips[i], clips[i + 1]]);
        }
      }
    }

    return conflicts;
  }

  /**
   * @returns {number} Total number of clips across all tracks.
   */
  getClipCount() {
    if (!this._project) return 0;
    return this._project.getTracks().reduce((sum, t) => sum + t.getClips().length, 0);
  }

  /**
   * @returns {number} Number of tracks.
   */
  getTrackCount() {
    return this._project ? this._project.getTracks().length : 0;
  }

  // ─── Serialisation ────────────────────────────────────────────────────────────

  /** @returns {object} */
  toJSON() {
    return {
      fps: this.fps,
      width: this.width,
      height: this.height,
      sampleRate: this.sampleRate,
      channels: this.channels,
    };
  }

  /**
   * @param {object} data
   * @returns {Timeline}
   */
  static fromJSON(data) {
    return new Timeline(data);
  }
}

export default Timeline;
