// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file A rendered page opened in JSDOM with its scripts run as a browser
 * runs them. JSDOM runs classic scripts but not module scripts, and a
 * rendered page's script is an inline module: this runs each inline module
 * once the document is parsed, in strict mode, with no `this` at its top
 * level, and reports what it throws as the window's `error` event, as a
 * browser does. Tests only; a rendered file never holds this.
 *
 * @position test-utils — used by the render tests that run a page's script
 */

import {JSDOM} from 'jsdom';

/**
 * @param {string} html
 * @param {import('jsdom').ConstructorOptions} [options]
 * @returns {JSDOM}
 */
export function pageDom(html, options = {}) {
  const dom = new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, ...options});
  const {window} = dom;
  // The document is parsed once the constructor returns, which is when a
  // browser runs a page's module scripts.
  for (const script of window.document.querySelectorAll('script[type="module"]:not([src])')) {
    try {
      window.eval(`(function () {'use strict';\n${script.textContent}\n}).call(undefined);`);
    } catch (error) {
      window.dispatchEvent(new window.ErrorEvent('error', {error, message: String(/** @type {any} */ (error)?.message ?? error)}));
    }
  }
  return dom;
}
