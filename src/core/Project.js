/**
 * @module Project
 * Root object of a VideoForge edit session.
 *
 * A Project owns a Timeline and an ordered list of Tracks.
 * All persistence, export dispatch, and high-level operations live here.
 */

import { promises as fs } from 'fs';
import path from 'path';
import IdGenerator from '../utils/IdGenerator.js';
import Timeline from './Timeline.js';
import Track from './Track.js';
import { TRACK_TYPES, EXPORT_TYPES } from '../utils/Constants.js';

class Project {
  /**
   * @param {object} [options={}]
   * @param {string} [options.name='Untitled Project']
   * @param {number} [options.fps]
   * @param {number} [options.width]
   * @param {number} [options.height]
   * @param {number} [options.sampleRate]
   * @param {number} [options.channels]
   */
  constructor(options = {}) {
    /** @type {string} */
    this.id = IdGenerator.generate('project');

    /** @type {string} */
    this.name = options.name ?? 'Untitled Project';

    /** @type {Timeline} */
    this.timeline = new Timeline({
      fps: options.fps,
      width: options.width,
      height: options.height,
      sampleRate: options.sampleRate,
      channels: options.channels,
    });
    this.timeline._project = this;

    /**
     * Ordered list of tracks.  The order determines the render stack
     * (index 0 = bottom-most, last index = top-most).
     * @type {Track[]}
     */
    this._tracks = [];

    /** @type {object} Free-form project metadata (author, description, tags, etc.). */
    this.metadata = {};

    /** @type {string} VideoForge schema version for forward-compat checking. */
    this.version = '1.0.0';

    /** @type {Date} */
    this.createdAt = new Date();

    /** @type {Date} */
    this.updatedAt = new Date();
  }

  // ─── Track management ─────────────────────────────────────────────────────────

  /**
   * Create a new Track of the given type and append it to the track list.
   *
   * @param {string} [type=TRACK_TYPES.VIDEO] - One of TRACK_TYPES.*
   * @param {object} [options={}] - Forwarded to Track constructor.
   * @returns {Track}
   */
  addTrack(type = TRACK_TYPES.VIDEO, options = {}) {
    const track = new Track(type, options);
    this._tracks.push(track);
    this._touch();
    return track;
  }

  /**
   * Retrieve a track by its ID.
   * @param {string} id
   * @returns {Track|undefined}
   */
  getTrack(id) {
    return this._tracks.find((t) => t.id === id);
  }

  /**
   * Alias for getTrack() — preferred for chained usage.
   * @param {string} id
   * @returns {Track|undefined}
   */
  track(id) {
    return this.getTrack(id);
  }

  /**
   * Remove a track by ID and all its clips.
   * @param {string} id
   * @returns {boolean} True if a track was removed.
   */
  removeTrack(id) {
    const idx = this._tracks.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this._tracks.splice(idx, 1);
    this._touch();
    return true;
  }

  /**
   * Return all tracks in render-stack order (bottom → top).
   * @returns {Track[]}
   */
  getTracks() {
    return [...this._tracks];
  }

  /**
   * Reorder tracks by providing the desired array of track IDs.
   * IDs not present in `orderedIds` are appended at the end in their original order.
   *
   * @param {string[]} orderedIds
   * @returns {Project} this (chainable)
   */
  reorderTracks(orderedIds) {
    const map = new Map(this._tracks.map((t) => [t.id, t]));
    const reordered = orderedIds.map((id) => map.get(id)).filter(Boolean);
    const remaining = this._tracks.filter((t) => !orderedIds.includes(t.id));
    this._tracks = [...reordered, ...remaining];
    this._touch();
    return this;
  }

  // ─── Export ───────────────────────────────────────────────────────────────────

  /**
   * Export the project using the specified format.
   *
   * @param {object} options
   * @param {string} [options.type='json']   - One of EXPORT_TYPES.*
   * @param {string} [options.output]        - Output file path.
   * @param {object} [options.encoderOptions] - Format-specific options passed to the exporter.
   * @returns {Promise<string>} Resolves to the output path.
   */
  async export(options = {}) {
    const type = options.type ?? EXPORT_TYPES.JSON;

    // Lazy-load exporters to keep the core module light.
    let ExporterClass;
    switch (type) {
      case EXPORT_TYPES.JSON: {
        const { default: JsonExporter } = await import('../exporters/JsonExporter.js');
        ExporterClass = JsonExporter;
        break;
      }
      case EXPORT_TYPES.PREMIERE: {
        const { default: PremiereXmlExporter } = await import('../exporters/PremiereXmlExporter.js');
        ExporterClass = PremiereXmlExporter;
        break;
      }
      case EXPORT_TYPES.FCPXML: {
        const { default: FcpxmlExporter } = await import('../exporters/FcpxmlExporter.js');
        ExporterClass = FcpxmlExporter;
        break;
      }
      case EXPORT_TYPES.MP4: {
        const { default: Mp4Exporter } = await import('../exporters/Mp4Exporter.js');
        ExporterClass = Mp4Exporter;
        break;
      }
      default:
        throw new Error(`Unknown export type: "${type}". Use one of: ${Object.values(EXPORT_TYPES).join(', ')}`);
    }

    const exporter = new ExporterClass(this, options);
    const outputPath = await exporter.export(options.output);
    this._touch();
    return outputPath;
  }

  // ─── Persistence ─────────────────────────────────────────────────────────────

  /**
   * Save the project to a .vfp (VideoForge Project) JSON file.
   * @param {string} filePath
   * @returns {Promise<string>} Resolves to the written file path.
   */
  async save(filePath) {
    const resolved = path.resolve(filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, JSON.stringify(this.toJSON(), null, 2), 'utf8');
    return resolved;
  }

  /**
   * Load a project from a .vfp JSON file.
   * @param {string} filePath
   * @returns {Promise<Project>}
   */
  static async load(filePath) {
    const raw = await fs.readFile(path.resolve(filePath), 'utf8');
    return Project.fromJSON(JSON.parse(raw));
  }

  // ─── Serialisation ────────────────────────────────────────────────────────────

  /**
   * Serialise the full project to a plain object.
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      timeline: this.timeline.toJSON(),
      tracks: this._tracks.map((t) => t.toJSON()),
      metadata: { ...this.metadata },
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Reconstruct a Project from a plain object produced by toJSON().
   * @param {object} data
   * @returns {Project}
   */
  static fromJSON(data) {
    const project = new Project({ name: data.name });
    project.id = data.id;
    project.version = data.version;
    project.metadata = data.metadata ?? {};
    project.createdAt = new Date(data.createdAt);
    project.updatedAt = new Date(data.updatedAt);

    if (data.timeline) {
      project.timeline = Timeline.fromJSON(data.timeline);
      project.timeline._project = project;
    }

    for (const trackData of data.tracks ?? []) {
      const track = Track.fromJSON(trackData);
      project._tracks.push(track);
    }

    return project;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  _touch() {
    this.updatedAt = new Date();
  }
}

export default Project;
