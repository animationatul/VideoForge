/**
 * @module IdGenerator
 * Lightweight unique-ID utility — no external dependencies.
 */

let _counter = 0;

class IdGenerator {
  /**
   * Generate a prefixed unique ID using timestamp + random + monotonic counter.
   * Safe for same-millisecond calls.
   *
   * @param {string} [prefix='id'] - Short string prepended to the ID.
   * @returns {string}
   */
  static generate(prefix = 'id') {
    const ts = Date.now().toString(36);
    const rnd = Math.random().toString(36).substring(2, 8);
    const cnt = (++_counter).toString(36).padStart(4, '0');
    return `${prefix}_${ts}${rnd}${cnt}`;
  }

  /**
   * Generate a RFC 4122 v4 UUID.
   * @returns {string}
   */
  static uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /** Reset the internal counter (useful in tests). */
  static reset() {
    _counter = 0;
  }
}

export default IdGenerator;
