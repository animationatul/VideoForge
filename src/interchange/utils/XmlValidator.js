/**
 * @module XmlValidator
 * Structural and schema validation for generated XML interchange documents.
 *
 * Performs lightweight validation (no external schema parser dependency):
 *   - Well-formedness checks on generated XML strings
 *   - Element/attribute presence requirements for Premiere and FCPXML
 *   - Timecode value range checks
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean}   valid
 * @property {string[]}  errors
 * @property {string[]}  warnings
 */

class XmlValidator {
  constructor() {
    /** @type {string[]} */
    this._errors = [];
    /** @type {string[]} */
    this._warnings = [];
  }

  // ─── Entry points ─────────────────────────────────────────────────────────────

  /**
   * Validate a Premiere XMEML XML string.
   * @param {string} xml
   * @returns {ValidationResult}
   */
  validatePremiereXml(xml) {
    this._reset();
    this._checkDeclaration(xml);
    this._checkRootElement(xml, 'xmeml');
    this._checkRequiredElements(xml, [
      'xmeml', 'sequence', 'media', 'video', 'audio',
    ]);
    this._checkNoEmptyIds(xml);
    this._checkBalancedTags(xml);
    this._checkPremiereRateElements(xml);
    return this._result();
  }

  /**
   * Validate an FCPXML 1.10 XML string.
   * @param {string} xml
   * @returns {ValidationResult}
   */
  validateFcpXml(xml) {
    this._reset();
    this._checkDeclaration(xml);
    this._checkRootElement(xml, 'fcpxml');
    this._checkRequiredElements(xml, [
      'fcpxml', 'resources', 'library', 'event', 'project', 'sequence', 'spine',
    ]);
    this._checkFcpRationalTimes(xml);
    this._checkNoEmptyIds(xml);
    this._checkBalancedTags(xml);
    return this._result();
  }

  /**
   * Validate a CMX3600 EDL string.
   * @param {string} edl
   * @returns {ValidationResult}
   */
  validateEdl(edl) {
    this._reset();
    if (!edl.startsWith('TITLE:') && !edl.startsWith('FCM:') && !edl.match(/^\d{3,4}\s+/m)) {
      this._errors.push('EDL does not appear to be CMX3600 format (missing TITLE: or edit events)');
    }
    const lines = edl.split('\n');
    let eventCount = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('TITLE:') || trimmed.startsWith('FCM:')) continue;
      const m = trimmed.match(/^(\d{3,4})\s+/);
      if (m) {
        eventCount++;
        this._checkEdlEventLine(trimmed, eventCount);
      }
    }
    if (eventCount === 0) this._warnings.push('EDL contains no edit events');
    return this._result();
  }

  // ─── Structural checks ────────────────────────────────────────────────────────

  _checkDeclaration(xml) {
    if (!xml.trimStart().startsWith('<?xml')) {
      this._warnings.push('XML declaration (<?xml ...?>) is missing');
    }
  }

  _checkRootElement(xml, expected) {
    const m = xml.match(/<([a-zA-Z_][\w:.-]*)/);
    if (!m) {
      this._errors.push('No root element found');
      return;
    }
    // Skip XML declaration PI
    const rootMatch = xml.replace(/<\?[^?]+\?>/g, '').match(/<([a-zA-Z_][\w:.-]*)/);
    if (!rootMatch) {
      this._errors.push('No root element found after XML declaration');
      return;
    }
    const root = rootMatch[1].split(':').pop();
    if (root !== expected) {
      this._errors.push(`Expected root element <${expected}>, found <${rootMatch[1]}>`);
    }
  }

  _checkRequiredElements(xml, elements) {
    for (const el of elements) {
      const re = new RegExp(`<${el}[\\s/>]`);
      if (!re.test(xml)) {
        this._errors.push(`Required element <${el}> not found`);
      }
    }
  }

  _checkNoEmptyIds(xml) {
    const re = /\bid=""/g;
    if (re.test(xml)) {
      this._errors.push('One or more elements have empty id="" attributes');
    }
  }

  _checkBalancedTags(xml) {
    // Strip declarations, comments, CDATA.
    const stripped = xml
      .replace(/<\?[^?]*\?>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<!\[CDATA\[[\s\S]*?]]>/g, '');

    const stack = [];
    const tagRe = /<\/?([a-zA-Z_][\w:.-]*)(?:[^>]*)?(\/?)>/g;
    let m;
    while ((m = tagRe.exec(stripped)) !== null) {
      const full = m[0];
      const name = m[1];
      const selfClose = m[2] === '/' || full.endsWith('/>');
      if (full.startsWith('</')) {
        const top = stack.pop();
        if (top !== name) {
          this._warnings.push(`Mismatched tag: opened <${top}> closed </${name}>`);
          if (stack.length > 200) break;
        }
      } else if (!selfClose) {
        stack.push(name);
        if (stack.length > 10000) {
          this._warnings.push('Tag depth exceeds 10,000 — stopping balance check');
          break;
        }
      }
    }
    if (stack.length > 0) {
      this._errors.push(`Unclosed elements at end of document: ${stack.slice(-5).join(', ')}`);
    }
  }

  _checkPremiereRateElements(xml) {
    // Every <clipitem> should contain a <rate> → <timebase>
    const clipCount = (xml.match(/<clipitem[\s>]/g) ?? []).length;
    const tbCount   = (xml.match(/<timebase>/g) ?? []).length;
    if (clipCount > 0 && tbCount === 0) {
      this._errors.push('Premiere XML has <clipitem> elements but no <timebase> elements found');
    }
  }

  _checkFcpRationalTimes(xml) {
    // All duration= and offset= attributes in FCPXML should match N/Ds or Ns pattern.
    const re = /(?:duration|offset|start|tcStart)="([^"]+)"/g;
    let m;
    const bad = [];
    while ((m = re.exec(xml)) !== null) {
      const val = m[1];
      if (val !== '0s' && !/^\d+\/\d+s$/.test(val) && !/^\d+s$/.test(val)) {
        bad.push(val);
      }
    }
    if (bad.length > 0) {
      this._errors.push(`Invalid FCPXML rational time values: ${[...new Set(bad)].slice(0, 5).join(', ')}`);
    }
  }

  _checkEdlEventLine(line, idx) {
    const tcRe = /\d{2}:\d{2}:\d{2}[:;]\d{2}/g;
    const tcs = line.match(tcRe);
    if (!tcs || tcs.length < 4) {
      this._warnings.push(`Event ${idx}: expected 4 timecodes, found ${tcs?.length ?? 0}`);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  _reset() {
    this._errors = [];
    this._warnings = [];
  }

  _result() {
    return {
      valid: this._errors.length === 0,
      errors: [...this._errors],
      warnings: [...this._warnings],
    };
  }
}

export default XmlValidator;
