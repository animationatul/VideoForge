/**
 * @module XmlBuilder
 * Fluent, stack-based XML builder with automatic indentation.
 *
 * @example
 * const xml = new XmlBuilder()
 *   .declaration()
 *   .open('root', { version: '1.0' })
 *     .leaf('child', { id: '1' }, 'Hello')
 *     .comment('end of children')
 *   .close()
 *   .toString();
 */

import { escapeAttr, escapeText } from './XmlEscaper.js';

class XmlBuilder {
  /**
   * @param {object} [options={}]
   * @param {string}  [options.indent='  ']   - Indentation string per level.
   * @param {boolean} [options.pretty=true]   - Enable indentation/newlines.
   * @param {string}  [options.newline='\n']  - Newline character(s).
   */
  constructor(options = {}) {
    this._indent  = options.indent  ?? '  ';
    this._pretty  = options.pretty  ?? true;
    this._newline = options.newline ?? '\n';
    this._parts   = [];   // string fragments
    this._stack   = [];   // open element names
    this._depth   = 0;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  _push(str) {
    this._parts.push(str);
    return this;
  }

  _nl() {
    if (this._pretty) this._push(this._newline);
    return this;
  }

  _indentStr() {
    return this._pretty ? this._indent.repeat(this._depth) : '';
  }

  _attrs(attrs) {
    if (!attrs || typeof attrs !== 'object') return '';
    return Object.entries(attrs)
      .filter(([, v]) => v != null)
      .map(([k, v]) => ` ${k}="${escapeAttr(String(v))}"`)
      .join('');
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  /**
   * Emit an XML declaration.
   * @param {string} [version='1.0']
   * @param {string} [encoding='UTF-8']
   * @param {string|null} [standalone=null] - 'yes' | 'no' | null
   * @returns {XmlBuilder}
   */
  declaration(version = '1.0', encoding = 'UTF-8', standalone = null) {
    let decl = `<?xml version="${version}" encoding="${encoding}"`;
    if (standalone) decl += ` standalone="${standalone}"`;
    decl += '?>';
    return this._push(decl)._nl();
  }

  /**
   * Emit a DOCTYPE declaration.
   * @param {string} rootElement
   * @param {string} [systemId]
   * @param {string} [publicId]
   * @returns {XmlBuilder}
   */
  doctype(rootElement, systemId, publicId) {
    let dt = `<!DOCTYPE ${rootElement}`;
    if (publicId && systemId) dt += ` PUBLIC "${publicId}" "${systemId}"`;
    else if (systemId) dt += ` SYSTEM "${systemId}"`;
    dt += '>';
    return this._push(dt)._nl();
  }

  /**
   * Emit a processing instruction.
   * @param {string} target
   * @param {string} [data]
   * @returns {XmlBuilder}
   */
  pi(target, data) {
    const content = data ? `<?${target} ${data}?>` : `<?${target}?>`;
    return this._push(this._indentStr() + content)._nl();
  }

  /**
   * Open an element (push to stack, emit opening tag without closing it).
   * @param {string} name
   * @param {object} [attrs={}]
   * @returns {XmlBuilder}
   */
  open(name, attrs = {}) {
    this._push(this._indentStr() + `<${name}${this._attrs(attrs)}>`);
    this._nl();
    this._stack.push(name);
    this._depth++;
    return this;
  }

  /**
   * Close the most recently opened element.
   * @returns {XmlBuilder}
   */
  close() {
    if (this._stack.length === 0) throw new Error('XmlBuilder: close() called with empty stack');
    this._depth--;
    const name = this._stack.pop();
    this._push(this._indentStr() + `</${name}>`);
    this._nl();
    return this;
  }

  /**
   * Emit a self-contained leaf element: <name attrs>text</name> or <name attrs/>
   * @param {string} name
   * @param {object} [attrs={}]
   * @param {string|null} [textContent=null]
   * @returns {XmlBuilder}
   */
  leaf(name, attrs = {}, textContent = null) {
    const attrStr = this._attrs(attrs);
    if (textContent == null || textContent === '') {
      this._push(this._indentStr() + `<${name}${attrStr}/>`);
    } else {
      this._push(this._indentStr() + `<${name}${attrStr}>${escapeText(String(textContent))}</${name}>`);
    }
    return this._nl();
  }

  /**
   * Emit a self-contained leaf element with pre-escaped / raw content.
   * Use when you've already escaped or constructed the inner content.
   * @param {string} name
   * @param {object} [attrs={}]
   * @param {string|null} [rawContent=null]
   * @returns {XmlBuilder}
   */
  leafRaw(name, attrs = {}, rawContent = null) {
    const attrStr = this._attrs(attrs);
    if (rawContent == null || rawContent === '') {
      this._push(this._indentStr() + `<${name}${attrStr}/>`);
    } else {
      this._push(this._indentStr() + `<${name}${attrStr}>${rawContent}</${name}>`);
    }
    return this._nl();
  }

  /**
   * Emit a text node at the current depth.
   * @param {string} text
   * @returns {XmlBuilder}
   */
  text(text) {
    if (text != null && text !== '') {
      this._push(this._indentStr() + escapeText(String(text)));
      this._nl();
    }
    return this;
  }

  /**
   * Emit a raw (pre-escaped) text node.
   * @param {string} raw
   * @returns {XmlBuilder}
   */
  raw(raw) {
    if (raw != null && raw !== '') {
      this._push(String(raw));
    }
    return this;
  }

  /**
   * Emit an XML comment.
   * @param {string} text
   * @returns {XmlBuilder}
   */
  comment(text) {
    const safe = String(text ?? '').replace(/--/g, '- -');
    return this._push(this._indentStr() + `<!-- ${safe} -->`)._nl();
  }

  /**
   * Emit a blank line (useful for readability in pretty mode).
   * @returns {XmlBuilder}
   */
  blank() {
    if (this._pretty) this._push(this._newline);
    return this;
  }

  /**
   * Embed another XmlBuilder's output at the current indentation level.
   * @param {XmlBuilder} builder
   * @returns {XmlBuilder}
   */
  embed(builder) {
    if (!(builder instanceof XmlBuilder)) throw new TypeError('embed() expects an XmlBuilder instance');
    const inner = builder.toString();
    if (inner) {
      // Re-indent each line by current depth.
      const prefix = this._indentStr();
      const reindented = inner
        .split(this._newline)
        .map((line) => (line ? prefix + line : line))
        .join(this._newline);
      this._push(reindented);
      if (!reindented.endsWith(this._newline)) this._nl();
    }
    return this;
  }

  /**
   * Assert the stack is empty (all opened elements have been closed).
   * @returns {XmlBuilder}
   */
  assertClosed() {
    if (this._stack.length > 0) {
      throw new Error(`XmlBuilder: unclosed elements: ${this._stack.join(', ')}`);
    }
    return this;
  }

  /**
   * Return the number of currently open elements.
   * @returns {number}
   */
  get depth() {
    return this._depth;
  }

  /**
   * Return the current open element name (top of stack), or null.
   * @returns {string|null}
   */
  get currentElement() {
    return this._stack.length > 0 ? this._stack[this._stack.length - 1] : null;
  }

  /**
   * Serialise to a string.
   * @returns {string}
   */
  toString() {
    return this._parts.join('');
  }

  /**
   * Reset the builder to a clean state.
   * @returns {XmlBuilder}
   */
  reset() {
    this._parts = [];
    this._stack = [];
    this._depth = 0;
    return this;
  }

  /**
   * Clone this builder (copies accumulated parts, resets stack).
   * Used to branch off a sub-builder for conditional sections.
   * @returns {XmlBuilder}
   */
  clone() {
    const b = new XmlBuilder({ indent: this._indent, pretty: this._pretty, newline: this._newline });
    b._parts = [...this._parts];
    return b;
  }

  /**
   * Create a child builder with the same options but a clean state.
   * @returns {XmlBuilder}
   */
  child() {
    return new XmlBuilder({ indent: this._indent, pretty: this._pretty, newline: this._newline });
  }
}

export default XmlBuilder;
