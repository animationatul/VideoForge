/**
 * @module Exporter
 * Abstract base class for all export formats.
 *
 * Concrete exporters (JsonExporter, PremiereXmlExporter, …) extend this class
 * and implement export().  Callers interact through Project.export(options).
 */

import path from 'path';

class Exporter {
  /**
   * @param {import('../core/Project.js').default} project
   * @param {object} [options={}]
   * @param {string} [options.output]             - Default output path.
   * @param {object} [options.encoderOptions={}]  - Format-specific settings.
   */
  constructor(project, options = {}) {
    if (new.target === Exporter) {
      throw new TypeError('Exporter is abstract — use a concrete subclass.');
    }

    /** @type {import('../core/Project.js').default} */
    this.project = project;

    /** @type {object} */
    this.options = { ...options };

    /** @type {object} */
    this.encoderOptions = options.encoderOptions ?? {};
  }

  // ─── Abstract interface ───────────────────────────────────────────────────────

  /**
   * Execute the export.  Subclasses must override.
   *
   * @param {string} outputPath - Resolved output file path.
   * @returns {Promise<string>} Resolves to the path of the written file.
   */
  async export(outputPath) {
    throw new Error(`${this.constructor.name}.export() is not implemented.`);
  }

  // ─── Shared utilities ─────────────────────────────────────────────────────────

  /**
   * Validate the project and throw if the state is not exportable.
   * Subclasses can override to add format-specific validation.
   */
  validate() {
    if (!this.project) throw new Error('Exporter has no project assigned.');
    if (this.project.getTracks().length === 0) {
      throw new Error('Project has no tracks — nothing to export.');
    }
  }

  /**
   * Resolve and normalise an output path, applying the project name as a
   * default filename when only a directory is given.
   *
   * @param {string|undefined} outputPath
   * @param {string} defaultExtension - e.g. '.json'
   * @returns {string}
   */
  resolveOutputPath(outputPath, defaultExtension) {
    if (!outputPath) {
      const safeName = this.project.name.replace(/[^a-z0-9_\-\s]/gi, '_');
      return path.resolve(`${safeName}${defaultExtension}`);
    }
    const resolved = path.resolve(outputPath);
    // If no extension, append the default.
    return path.extname(resolved) ? resolved : `${resolved}${defaultExtension}`;
  }

  /**
   * Build a summary of the project state for debugging or logging.
   * @returns {object}
   */
  getSummary() {
    const tl = this.project.timeline;
    return {
      projectId: this.project.id,
      name: this.project.name,
      duration: this.project.timeline.getTotalDuration(),
      trackCount: this.project.getTracks().length,
      clipCount: tl.getClipCount(),
      resolution: `${tl.width}×${tl.height}`,
      fps: tl.fps,
    };
  }
}

export default Exporter;
