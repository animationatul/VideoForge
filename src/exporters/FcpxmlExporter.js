/**
 * @module FcpxmlExporter
 * Generates an Apple Final Cut Pro X XML file (.fcpxml).
 *
 * FCPXML is the interchange format for Final Cut Pro 10.x.
 * It uses a spine/gap model rather than the classic track model.
 *
 * Specification reference: developer.apple.com/documentation/professional_video_applications/fcpxml_reference
 */

import { promises as fs } from 'fs';
import path from 'path';
import Exporter from './Exporter.js';

class FcpxmlExporter extends Exporter {
  /**
   * @param {import('../core/Project.js').default} project
   * @param {object} [options={}]
   * @param {string} [options.fcpxmlVersion='1.10'] - FCPXML schema version.
   * @param {string} [options.uid]                  - Optional project UID override.
   */
  constructor(project, options = {}) {
    super(project, options);

    /** @type {string} */
    this.fcpxmlVersion = options.fcpxmlVersion ?? '1.10';

    /** @type {string} */
    this.uid = options.uid ?? this.project.id;
  }

  /**
   * Write an FCPXML file to `outputPath`.
   * @param {string|undefined} outputPath
   * @returns {Promise<string>}
   */
  async export(outputPath) {
    this.validate();

    const dest = this.resolveOutputPath(outputPath, '.fcpxml');
    await fs.mkdir(path.dirname(dest), { recursive: true });

    const xml = this._buildFcpxml();
    await fs.writeFile(dest, xml, 'utf8');

    return dest;
  }

  // ─── XML builder ─────────────────────────────────────────────────────────────

  /**
   * @returns {string}
   */
  _buildFcpxml() {
    const tl = this.project.timeline;

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<!DOCTYPE fcpxml>`,
      `<fcpxml version="${this.fcpxmlVersion}">`,
      '  <resources>',
      this._buildResources(),
      '  </resources>',
      '  <library>',
      '    <event>',
      `      <project name="${this._esc(this.project.name)}" uid="${this._esc(this.uid)}">`,
      '        <sequence>',
      `          <spine>`,
      this._buildSpine(),
      '          </spine>',
      '        </sequence>',
      '      </project>',
      '    </event>',
      '  </library>',
      '</fcpxml>',
    ].join('\n');
  }

  /**
   * Emit <format> and <asset> resource elements.
   * @returns {string}
   */
  _buildResources() {
    // TODO: Collect unique assets from all clips and emit one <asset> per file.
    //       Emit a <format> element describing the sequence resolution/fps.
    const tl = this.project.timeline;
    return [
      `    <format id="r1" frameDuration="1/${tl.fps}s"`,
      `            width="${tl.width}" height="${tl.height}"/>`,
      '    <!-- TODO: per-asset <asset> elements -->',
    ].join('\n');
  }

  /**
   * Emit spine <clip> and <gap> elements.
   * @returns {string}
   */
  _buildSpine() {
    // TODO: Traverse tracks and emit primary story elements.
    //       Connected clips (B-roll, titles) attach as <clip> children of the primary clips.
    return '            <!-- TODO: spine clips and gaps -->';
  }

  /**
   * @param {string} str
   * @returns {string}
   */
  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export default FcpxmlExporter;
