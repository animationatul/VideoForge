/**
 * @module PremiereXmlExporter
 * Generates an Adobe Premiere Pro XML interchange file (.xml / FCP7XML).
 *
 * The FCP7XML format is the legacy interchange standard recognised by
 * Premiere Pro (File → Import), DaVinci Resolve, and other NLEs.
 *
 * References:
 *   - Apple FCP7XML specification (Final Cut Pro 7 XML Interchange Format)
 *   - Premiere Pro XML import documentation
 */

import { promises as fs } from 'fs';
import path from 'path';
import Exporter from './Exporter.js';

class PremiereXmlExporter extends Exporter {
  /**
   * @param {import('../core/Project.js').default} project
   * @param {object} [options={}]
   * @param {string} [options.ntsc='false']    - 'true' for NTSC frame rates.
   * @param {string} [options.colordepth='24'] - Bit depth for the XML header.
   */
  constructor(project, options = {}) {
    super(project, options);

    /** @type {string} */
    this.ntsc = options.ntsc ?? 'false';

    /** @type {string} */
    this.colordepth = options.colordepth ?? '24';
  }

  /**
   * Write an FCP7 XML file to `outputPath`.
   * @param {string|undefined} outputPath
   * @returns {Promise<string>}
   */
  async export(outputPath) {
    this.validate();

    const dest = this.resolveOutputPath(outputPath, '.xml');
    await fs.mkdir(path.dirname(dest), { recursive: true });

    const xml = this._buildXml();
    await fs.writeFile(dest, xml, 'utf8');

    return dest;
  }

  // ─── XML builder ─────────────────────────────────────────────────────────────

  /**
   * Assemble the full FCP7 XML document.
   * @returns {string}
   */
  _buildXml() {
    const tl = this.project.timeline;
    const fps = tl.fps;

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE xmeml>',
      '<xmeml version="5">',
      '  <sequence>',
      `    <name>${this._esc(this.project.name)}</name>`,
      `    <duration>${this.project.timeline.getTotalFrames()}</duration>`,
      '    <rate>',
      `      <timebase>${fps}</timebase>`,
      `      <ntsc>${this.ntsc}</ntsc>`,
      '    </rate>',
      '    <media>',
      '      <video>',
      this._buildVideoTracks(),
      '      </video>',
      '      <audio>',
      this._buildAudioTracks(),
      '      </audio>',
      '    </media>',
      '  </sequence>',
      '</xmeml>',
    ].join('\n');
  }

  /**
   * @returns {string}
   */
  _buildVideoTracks() {
    // TODO: Iterate this.project.getTracks(), filter by video/image/text/shape,
    //       and emit one <track> element per track with nested <clipitem> elements.
    //       Each clipitem needs: name, start, end, in, out, file[@id], and effect elements.
    return '        <!-- TODO: video track elements -->';
  }

  /**
   * @returns {string}
   */
  _buildAudioTracks() {
    // TODO: Iterate audio tracks and emit <track> / <clipitem> elements.
    return '        <!-- TODO: audio track elements -->';
  }

  /**
   * Escape XML special characters.
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

export default PremiereXmlExporter;
