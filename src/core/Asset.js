/**
 * @module Asset
 * Represents a media file (video, audio, image) or synthetic resource (text, shape)
 * that can be referenced by one or more Clips.
 */

import IdGenerator from '../utils/IdGenerator.js';
import { ASSET_TYPES } from '../utils/Constants.js';

class Asset {
  /**
   * @param {string} path - Absolute or relative path to the source file.
   *                        Use an empty string for synthetic assets.
   * @param {string} [type=ASSET_TYPES.VIDEO] - One of ASSET_TYPES.*
   * @param {object} [metadata={}] - Optional caller-supplied metadata.
   */
  constructor(path, type = ASSET_TYPES.VIDEO, metadata = {}) {
    /** @type {string} */
    this.id = IdGenerator.generate('asset');

    /** @type {string} */
    this.path = path;

    /** @type {string} */
    this.type = type;

    /**
     * Resolved metadata after calling load().
     * Populated lazily — always check `this.loaded` before reading.
     *
     * @type {{
     *   duration?: number,
     *   width?: number,
     *   height?: number,
     *   fps?: number,
     *   sampleRate?: number,
     *   channels?: number,
     *   codec?: string,
     *   fileSize?: number,
     * } & object}
     */
    this.metadata = { ...metadata };

    /** @type {boolean} */
    this.loaded = Object.keys(metadata).length > 0;

    /** @type {Date} */
    this.createdAt = new Date();
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Probe the source file and populate `this.metadata`.
   * @returns {Promise<Asset>} Resolves to this asset once metadata is ready.
   */
  async load() {
    // TODO: Implement media probing via ffprobe or a native binding.
    //       Expected fields: duration, width, height, fps, codec, sampleRate, channels, fileSize.
    this.loaded = true;
    return this;
  }

  /**
   * Convenience accessor for duration — returns 0 if metadata is absent.
   * @returns {number} Duration in seconds.
   */
  get duration() {
    return this.metadata.duration ?? 0;
  }

  // ─── Serialisation ──────────────────────────────────────────────────────────

  /**
   * Serialise to a plain object for JSON export.
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      path: this.path,
      type: this.type,
      metadata: this.metadata,
      loaded: this.loaded,
      createdAt: this.createdAt.toISOString(),
    };
  }

  /**
   * Reconstruct an Asset from a plain object produced by toJSON().
   * @param {object} data
   * @returns {Asset}
   */
  static fromJSON(data) {
    const asset = new Asset(data.path, data.type, data.metadata);
    asset.id = data.id;
    asset.loaded = data.loaded;
    asset.createdAt = new Date(data.createdAt);
    return asset;
  }
}

export default Asset;
