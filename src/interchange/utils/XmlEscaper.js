/**
 * @module XmlEscaper
 * XML string escaping and unescaping utilities.
 */

const TEXT_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

const ATTR_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

const UNESCAPE_MAP = {
  '&amp;':  '&',
  '&lt;':   '<',
  '&gt;':   '>',
  '&quot;': '"',
  '&apos;': "'",
};

/**
 * Escape characters that are unsafe in XML text content (& < >).
 * @param {string} text
 * @returns {string}
 */
function escapeText(text) {
  if (text == null) return '';
  return String(text).replace(/[&<>]/g, (c) => TEXT_ESCAPE_MAP[c]);
}

/**
 * Escape characters that are unsafe in XML attribute values (& < > " ').
 * @param {string} value
 * @returns {string}
 */
function escapeAttr(value) {
  if (value == null) return '';
  return String(value).replace(/[&<>"']/g, (c) => ATTR_ESCAPE_MAP[c]);
}

/**
 * Percent-encode a URI/URL for use inside XML attribute values.
 * Encodes non-ASCII and XML-unsafe characters.
 * @param {string} url
 * @returns {string}
 */
function escapeUrl(url) {
  if (url == null) return '';
  const str = String(url);
  // First percent-encode, then XML-escape the result (& in %XX stays safe).
  // Preserve already-encoded sequences.
  try {
    const encoded = encodeURI(str)
      .replace(/#/g, '%23')
      .replace(/\?/g, '%3F')
      .replace(/&/g, '&amp;');
    return encoded;
  } catch {
    return escapeAttr(str);
  }
}

/**
 * Decode XML character references and predefined entities.
 * @param {string} text
 * @returns {string}
 */
function unescapeText(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => UNESCAPE_MAP[entity] ?? entity);
}

/**
 * Wrap text in a CDATA section. Splits `]]>` sequences that would break the section.
 * @param {string} text
 * @returns {string}
 */
function cdata(text) {
  const safe = String(text ?? '').replace(/]]>/g, ']]]]><![CDATA[>');
  return `<![CDATA[${safe}]]>`;
}

/**
 * Strip all XML tags from a string, returning only text content.
 * @param {string} xml
 * @returns {string}
 */
function stripTags(xml) {
  return String(xml ?? '').replace(/<[^>]*>/g, '');
}

export { escapeText, escapeAttr, escapeUrl, unescapeText, cdata, stripTags };
