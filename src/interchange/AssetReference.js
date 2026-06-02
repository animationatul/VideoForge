/**
 * @module AssetReference
 * Canonical representation of a media asset in the Intermediate Timeline.
 */

import IdGenerator from '../utils/IdGenerator.js';
import { ASSET_TYPES } from '../utils/Constants.js';

class AssetReference {
  /**
   * @param {object} [data={}]
   * @param {string} [data.id]
   * @param {string} [data.path='']           - Absolute or project-relative file path.
   * @param {string} [data.type]              - One of ASSET_TYPES.*
   * @param {number} [data.duration=0]        - Duration in seconds. 0 = unknown/still.
   * @param {number} [data.fps=0]             - Frame rate (0 for audio/image assets).
   * @param {number} [data.width=0]           - Pixel width (0 for audio).
   * @param {number} [data.height=0]          - Pixel height (0 for audio).
   * @param {number} [data.audioChannels=0]   - Number of audio channels.
   * @param {number} [data.sampleRate=0]      - Audio sample rate (Hz).
   * @param {number} [data.bitDepth=0]        - Audio bit depth.
   * @param {string} [data.colorSpace='']     - e.g. "Rec. 709", "Rec. 2020"
   * @param {string} [data.uid='']            - Stable content hash / UUID for deduplication.
   * @param {object} [data.metadata={}]       - Passthrough metadata.
   */
  constructor(data = {}) {
    /** @type {string} */
    this.id = data.id ?? IdGenerator.generate('asset');

    /** @type {string} */
    this.path = data.path ?? '';

    /** @type {string} */
    this.type = data.type ?? ASSET_TYPES.VIDEO;

    /** @type {number} */
    this.duration = data.duration ?? 0;

    /** @type {number} */
    this.fps = data.fps ?? 0;

    /** @type {number} */
    this.width = data.width ?? 0;

    /** @type {number} */
    this.height = data.height ?? 0;

    /** @type {number} */
    this.audioChannels = data.audioChannels ?? 0;

    /** @type {number} */
    this.sampleRate = data.sampleRate ?? 0;

    /** @type {number} */
    this.bitDepth = data.bitDepth ?? 0;

    /** @type {string} */
    this.colorSpace = data.colorSpace ?? '';

    /**
     * Stable UID for deduplication across tracks.
     * Premiere requires a single <file> element per unique asset, referenced by id.
     * @type {string}
     */
    this.uid = data.uid ?? this.id;

    /** @type {object} */
    this.metadata = data.metadata ?? {};
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /** @returns {boolean} */
  get isVideo() { return this.type === ASSET_TYPES.VIDEO; }

  /** @returns {boolean} */
  get isAudio() { return this.type === ASSET_TYPES.AUDIO; }

  /** @returns {boolean} */
  get isImage() { return this.type === ASSET_TYPES.IMAGE; }

  /** @returns {boolean} */
  get hasVideo() { return this.isVideo || this.isImage; }

  /** @returns {boolean} */
  get hasAudio() { return (this.isVideo || this.isAudio) && this.audioChannels > 0; }

  /**
   * Derive a display name from the path.
   * @returns {string}
   */
  get name() {
    if (!this.path) return this.id;
    const parts = this.path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
  }

  /**
   * Build from a Project Asset object.
   * @param {import('../core/Asset.js').default} asset
   * @param {number|string} [projectFps=30]
   * @returns {AssetReference}
   */
  static fromAsset(asset, projectFps = 30) {
    return new AssetReference({
      id: asset.id,
      path: asset.src ?? asset.path ?? '',
      type: asset.type ?? ASSET_TYPES.VIDEO,
      duration: asset.duration ?? 0,
      fps: asset.fps ?? (asset.type === ASSET_TYPES.VIDEO ? Number(projectFps) : 0),
      width: asset.width ?? (asset.type === ASSET_TYPES.VIDEO ? 1920 : 0),
      height: asset.height ?? (asset.type === ASSET_TYPES.VIDEO ? 1080 : 0),
      audioChannels: asset.audioChannels ?? (asset.type === ASSET_TYPES.AUDIO ? 2 : 0),
      sampleRate: asset.sampleRate ?? (asset.type === ASSET_TYPES.AUDIO ? 48000 : 0),
      uid: asset.uid ?? asset.id,
      metadata: asset.metadata ?? {},
    });
  }

  toJSON() {
    return {
      id: this.id,
      path: this.path,
      type: this.type,
      duration: this.duration,
      fps: this.fps,
      width: this.width,
      height: this.height,
      audioChannels: this.audioChannels,
      sampleRate: this.sampleRate,
      bitDepth: this.bitDepth,
      colorSpace: this.colorSpace,
      uid: this.uid,
      metadata: this.metadata,
    };
  }
}

export default AssetReference;
