'use strict';

/** Strip harakat / tatweel for pronunciation matching (same rules as seed script). */
function toPlainArabic(s) {
  if (!s) return '';
  return String(s)
    .replace(/\u0671/g, '\u0627')
    .replace(/[\u064B-\u0652\u0640\u0670]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { toPlainArabic };
