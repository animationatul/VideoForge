/**
 * @module JsonExporter
 * Serialises the entire project to a VideoForge JSON file (.vfp).
 *
 * This is the canonical lossless format — every other exporter can be
 * implemented by reading a .vfp and converting.
 */

import { promises as fs } from 'fs';
import path from 'path';
import Exporter from './Exporter.js';

class JsonExporter extends Exporter {
  /**
   * @param {import('../core/Project.js').default} project
   * @param {object} [options={}]
   * @param {boolean} [options.pretty=true]    - Pretty-print the JSON output.
   * @param {number}  [options.indent=2]       - Indentation spaces when pretty=true.
   */
  constructor(project, options = {}) {
    super(project, options);

    /** @type {boolean} */
    this.pretty = options.pretty ?? true;

    /** @type {number} */
    this.indent = options.indent ?? 2;
  }

  /**
   * Write the project as JSON to `outputPath`.
   *
   * @param {string|undefined} outputPath
   * @returns {Promise<string>} Resolved output path.
   */
  async export(outputPath) {
    this.validate();

    const dest = this.resolveOutputPath(outputPath, '.vfp');
    await fs.mkdir(path.dirname(dest), { recursive: true });

    const payload = this.project.toJSON();
    const text = this.pretty
      ? JSON.stringify(payload, null, this.indent)
      : JSON.stringify(payload);

    await fs.writeFile(dest, text, 'utf8');

    return dest;
  }

  /**
   * Return the serialised project as a plain object without writing to disk.
   * Useful for in-memory pipelines (e.g., sending over a network).
   *
   * @returns {object}
   */
  toObject() {
    this.validate();
    return this.project.toJSON();
  }

  /**
   * Return the serialised project as a JSON string without writing to disk.
   * @returns {string}
   */
  toString() {
    this.validate();
    return this.pretty
      ? JSON.stringify(this.project.toJSON(), null, this.indent)
      : JSON.stringify(this.project.toJSON());
  }
}

export default JsonExporter;
