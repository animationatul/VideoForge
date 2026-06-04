/**
 * @module Track
 * A horizontal lane on the timeline that owns an ordered collection of Clips.
 *
 * Tracks are typed (video, audio, image, text, shape) but the type is advisory —
 * the engine does not enforce strict separation.  The factory methods
 * (addVideo, addAudio, …) create the correct Clip subclass and return it for
 * further configuration.
 */

import IdGenerator from '../utils/IdGenerator.js';
import Asset from './Asset.js';
import VideoClip from '../clips/VideoClip.js';
import AudioClip from '../clips/AudioClip.js';
import ImageClip from '../clips/ImageClip.js';
import TextClip from '../clips/TextClip.js';
import ShapeClip from '../clips/ShapeClip.js';
import CaptionClip from '../captions/CaptionClip.js';
import { TRACK_TYPES, ASSET_TYPES } from '../utils/Constants.js';

class Track {
  /**
   * @param {string} [type=TRACK_TYPES.VIDEO] - One of TRACK_TYPES.*
   * @param {object} [options={}]
   * @param {string}  [options.name='']       - Human-readable label.
   * @param {number}  [options.volume=1]      - Master volume (0–2).
   * @param {boolean} [options.muted=false]
   * @param {boolean} [options.solo=false]
   * @param {boolean} [options.locked=false]
   * @param {boolean} [options.visible=true]
   */
  constructor(type = TRACK_TYPES.VIDEO, options = {}) {
    /** @type {string} */
    this.id = IdGenerator.generate('track');

    /** @type {string} */
    this.type = type;

    /** @type {string} */
    this.name = options.name ?? `${type.charAt(0).toUpperCase() + type.slice(1)} Track`;

    /** @type {number} */
    this.volume = options.volume ?? 1;

    /** @type {boolean} */
    this.muted = options.muted ?? false;

    /** @type {boolean} When true, only soloed tracks play during preview. */
    this.solo = options.solo ?? false;

    /** @type {boolean} Prevent edits. */
    this.locked = options.locked ?? false;

    /** @type {boolean} */
    this.visible = options.visible ?? true;

    /**
     * Unordered pool of clips.  getClips() returns them sorted by startTime.
     * @type {import('./Clip.js').default[]}
     */
    this._clips = [];

    /** @type {Date} */
    this.createdAt = new Date();
  }

  // ─── Clip factories ───────────────────────────────────────────────────────────

  /**
   * Add a video clip from a file path, placed immediately after existing clips.
   * @param {string} path
   * @param {object} [options={}] - Forwarded to VideoClip constructor.
   * @returns {VideoClip}
   */
  addVideo(path, options = {}) {
    const asset = new Asset(path, ASSET_TYPES.VIDEO);
    const clip = new VideoClip(asset, { startTime: this._nextStartTime(), ...options });
    this._attach(clip);
    return clip;
  }

  /**
   * Add an audio clip from a file path.
   * @param {string} path
   * @param {object} [options={}]
   * @returns {AudioClip}
   */
  addAudio(path, options = {}) {
    const asset = new Asset(path, ASSET_TYPES.AUDIO);
    const clip = new AudioClip(asset, { startTime: this._nextStartTime(), ...options });
    this._attach(clip);
    return clip;
  }

  /**
   * Add an image clip from a file path.
   * @param {string} path
   * @param {object} [options={}]
   * @returns {ImageClip}
   */
  addImage(path, options = {}) {
    const asset = new Asset(path, ASSET_TYPES.IMAGE);
    const clip = new ImageClip(asset, { startTime: this._nextStartTime(), ...options });
    this._attach(clip);
    return clip;
  }

  /**
   * Add a text clip.
   * @param {string} text
   * @param {object} [options={}]
   * @returns {TextClip}
   */
  addText(text, options = {}) {
    const clip = new TextClip(text, { startTime: this._nextStartTime(), ...options });
    this._attach(clip);
    return clip;
  }

  /**
   * Add a shape clip.
   * @param {string} [shapeType] - One of SHAPE_TYPES.*
   * @param {object} [options={}]
   * @returns {ShapeClip}
   */
  addShape(shapeType, options = {}) {
    const clip = new ShapeClip(shapeType, { startTime: this._nextStartTime(), ...options });
    this._attach(clip);
    return clip;
  }

  /**
   * Add a caption clip with the full Motion Typography Engine attached.
   *
   * @param {string} [text='']      - Optional initial transcript text.
   * @param {object} [options={}]   - Forwarded to CaptionClip constructor.
   * @param {string} [options.preset]            - Preset name to apply immediately.
   * @param {number} [options.maxWordsPerSegment] - Auto-segment config.
   * @param {Array}  [options.wordTimings]        - Pre-parsed word timing data.
   * @returns {CaptionClip}
   */
  addCaption(text = '', options = {}) {
    const { preset, maxWordsPerSegment, wordTimings, ...clipOptions } = options;

    const clip = new CaptionClip(null, {
      startTime: this._nextStartTime(),
      ...clipOptions,
    });

    if (text) {
      clip.setTranscript(text, { maxWordsPerSegment, wordTimings });
    }

    if (preset) {
      clip.applyPreset(preset);
    }

    this._attach(clip);
    return clip;
  }

  // ─── Clip management ──────────────────────────────────────────────────────────

  /**
   * Retrieve a clip by ID.
   * @param {string} id
   * @returns {import('./Clip.js').default|undefined}
   */
  getClip(id) {
    return this._clips.find((c) => c.id === id);
  }

  /**
   * Return all clips sorted ascending by startTime.
   * @returns {import('./Clip.js').default[]}
   */
  getClips() {
    return [...this._clips].sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Remove a clip by ID.
   * @param {string} id
   * @returns {boolean} True if a clip was removed.
   */
  removeClip(id) {
    const idx = this._clips.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    const [removed] = this._clips.splice(idx, 1);
    removed._track = null;
    return true;
  }

  /**
   * Reposition a clip on the timeline.
   * @param {string} id
   * @param {number} startTime
   * @returns {boolean}
   */
  moveClip(id, startTime) {
    const clip = this.getClip(id);
    if (!clip) return false;
    clip.move(startTime);
    return true;
  }

  /**
   * Computed total duration (end time of the last clip in seconds).
   * @returns {number}
   */
  getDuration() {
    if (this._clips.length === 0) return 0;
    return Math.max(...this._clips.map((c) => c.endTime));
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────────

  _nextStartTime() {
    return this.getDuration();
  }

  _attach(clip) {
    clip._track = this;
    this._clips.push(clip);
  }

  /**
   * Insert `newClip` directly after `existingClip` in the internal array.
   * Called by Clip.split().
   */
  _insertClipAfter(existingClip, newClip) {
    const idx = this._clips.indexOf(existingClip);
    if (idx === -1) {
      this._attach(newClip);
    } else {
      this._clips.splice(idx + 1, 0, newClip);
      newClip._track = this;
    }
  }

  // ─── Serialisation ────────────────────────────────────────────────────────────

  /** @returns {object} */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      volume: this.volume,
      muted: this.muted,
      solo: this.solo,
      locked: this.locked,
      visible: this.visible,
      clips: this.getClips().map((c) => c.toJSON()),
      createdAt: this.createdAt.toISOString(),
    };
  }

  /**
   * Reconstruct a Track from serialised data produced by toJSON().
   * @param {object} data
   * @returns {Track}
   */
  static fromJSON(data) {
    const track = new Track(data.type, {
      name: data.name,
      volume: data.volume,
      muted: data.muted,
      solo: data.solo,
      locked: data.locked,
      visible: data.visible,
    });
    track.id = data.id;
    track.createdAt = new Date(data.createdAt);

    for (const clipData of data.clips ?? []) {
      let clip;
      switch (clipData.type) {
        case 'video': clip = VideoClip.fromJSON(clipData);  break;
        case 'audio': clip = AudioClip.fromJSON(clipData);  break;
        case 'image': clip = ImageClip.fromJSON(clipData);  break;
        case 'shape': clip = ShapeClip.fromJSON(clipData);  break;
        case 'text':
          // CaptionClip also serialises as type='text'; the presence of
          // the 'segments' array distinguishes it from a plain TextClip.
          clip = 'segments' in clipData
            ? CaptionClip.fromJSON(clipData)
            : TextClip.fromJSON(clipData);
          break;
        default:
          continue; // unknown type — skip safely
      }
      track._attach(clip);
    }

    return track;
  }
}

export default Track;
