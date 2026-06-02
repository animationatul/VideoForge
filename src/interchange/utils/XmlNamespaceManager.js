/**
 * @module XmlNamespaceManager
 * Namespace management for VideoForge metadata blocks embedded in XML exports.
 *
 * VideoForge preserves unsupported features (captions, complex animations, effects)
 * in a dedicated XML namespace so they survive round-trips through Premiere / FCP.
 */

import XmlBuilder from './XmlBuilder.js';
import { escapeAttr, escapeText } from './XmlEscaper.js';

/** VideoForge namespace URI */
const VF_NAMESPACE = 'https://videoforge.dev/ns/1.0';

/** VideoForge namespace prefix */
const VF_PREFIX = 'vf';

/** Well-known third-party namespaces used in interchange formats. */
const KNOWN_NAMESPACES = new Map([
  ['xmeml',  'http://www.apple.com/finalcutpro/1/'],
  ['fcpxml', 'http://apple.com/fcpxml/1'],
  ['dc',     'http://purl.org/dc/elements/1.1/'],
  ['xmp',    'http://ns.adobe.com/xap/1.0/'],
  ['prm',    'http://ns.adobe.com/premiere/1.0/'],
  [VF_PREFIX, VF_NAMESPACE],
]);

class XmlNamespaceManager {
  constructor() {
    /** @type {Map<string, string>} prefix → URI */
    this._declared = new Map();
    /** @type {Map<string, string>} URI → prefix */
    this._uriToPrefix = new Map();

    // Always declare VideoForge namespace.
    this.declare(VF_PREFIX, VF_NAMESPACE);
  }

  // ─── Namespace declaration ────────────────────────────────────────────────────

  /**
   * Declare a namespace prefix/URI pair.
   * @param {string} prefix
   * @param {string} uri
   * @returns {XmlNamespaceManager} this
   */
  declare(prefix, uri) {
    this._declared.set(prefix, uri);
    this._uriToPrefix.set(uri, prefix);
    return this;
  }

  /**
   * Declare all well-known namespaces.
   * @returns {XmlNamespaceManager}
   */
  declareAll() {
    for (const [prefix, uri] of KNOWN_NAMESPACES) {
      this.declare(prefix, uri);
    }
    return this;
  }

  /**
   * Get the URI for a registered prefix.
   * @param {string} prefix
   * @returns {string|undefined}
   */
  getUri(prefix) {
    return this._declared.get(prefix);
  }

  /**
   * Get the prefix for a registered URI.
   * @param {string} uri
   * @returns {string|undefined}
   */
  getPrefix(uri) {
    return this._uriToPrefix.get(uri);
  }

  /**
   * Build xmlns:* attribute object for an XML element.
   * @param {string[]} [prefixes] - Subset to include. Defaults to all declared.
   * @returns {object}
   */
  xmlnsAttrs(prefixes) {
    const list = prefixes ?? [...this._declared.keys()];
    const attrs = {};
    for (const prefix of list) {
      const uri = this._declared.get(prefix);
      if (uri) attrs[`xmlns:${prefix}`] = uri;
    }
    return attrs;
  }

  // ─── VideoForge metadata block ────────────────────────────────────────────────

  /**
   * Serialize a JavaScript value (object/array/primitive) as a VideoForge
   * metadata XML block using the `vf:` namespace.
   *
   * @param {string} elementName  - Local name under `vf:`, e.g. "captionClip"
   * @param {*} data              - The data to serialize.
   * @param {XmlBuilder} [xb]     - Builder to append to. Creates a new one if omitted.
   * @returns {XmlBuilder}
   */
  buildVfMetadata(elementName, data, xb) {
    const b = xb ?? new XmlBuilder();
    const tagName = `${VF_PREFIX}:${elementName}`;
    b.open(tagName);
    _serializeValue(data, b);
    b.close();
    return b;
  }

  /**
   * Serialize the videoForge payload of an IntermediateTimeline into an XML block
   * that exporters embed as a comment or metadata element.
   *
   * @param {object} payload - Any serializable object.
   * @param {string} [wrapperTag='vf:metadata']
   * @returns {string} XML fragment string.
   */
  serializePayload(payload, wrapperTag = 'vf:metadata') {
    const b = new XmlBuilder();
    b.open(wrapperTag, this.xmlnsAttrs([VF_PREFIX]));
    _serializeValue(payload, b);
    b.close();
    return b.toString();
  }

  /**
   * Emit the VideoForge namespace xmlns declaration as an attribute string.
   * Useful when manually building element opening tags.
   * @returns {string}
   */
  vfXmlns() {
    return `xmlns:${VF_PREFIX}="${escapeAttr(VF_NAMESPACE)}"`;
  }

  /** @returns {string} VF namespace prefix */
  get vfPrefix() { return VF_PREFIX; }

  /** @returns {string} VF namespace URI */
  get vfNamespace() { return VF_NAMESPACE; }
}

// ─── Private recursive value serializer ──────────────────────────────────────

function _serializeValue(value, b) {
  if (value === null || value === undefined) {
    b.leaf('vf:null');
    return;
  }
  if (typeof value === 'string') {
    b.leaf('vf:string', {}, value);
    return;
  }
  if (typeof value === 'number') {
    b.leaf('vf:number', {}, String(value));
    return;
  }
  if (typeof value === 'boolean') {
    b.leaf('vf:boolean', {}, String(value));
    return;
  }
  if (Array.isArray(value)) {
    b.open('vf:array', { length: value.length });
    for (const item of value) _serializeValue(item, b);
    b.close();
    return;
  }
  if (typeof value === 'object') {
    b.open('vf:object');
    for (const [key, val] of Object.entries(value)) {
      b.open('vf:entry', { key: escapeAttr(key) });
      _serializeValue(val, b);
      b.close();
    }
    b.close();
  }
}

export default XmlNamespaceManager;
export { VF_NAMESPACE, VF_PREFIX, KNOWN_NAMESPACES };
