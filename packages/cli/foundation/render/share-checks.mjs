// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file The checks a render runs on the file it just wrote, so the person
 * or agent who shares it need not run them by hand: what the file asks the
 * network for, and whether its embedded source gives back every carried file
 * exactly.
 * @input the bytes of the written file, the page module, the carried files
 * @output {outside, roundTrip}
 * @position read by renderToFile in api/render/_adapter.mjs after it writes
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {readSourceBlock} from './source-block.mjs';
import {assetRef} from './render-page.mjs';

/** Elements whose attribute loads a resource when the file opens. */
const LOADING_ATTRS = /<(img|script|link|iframe|object|embed|source|video|audio|track|input|image|use)\b([^>]*)>/gi;
const ATTR = /\s(src|href|data|poster|srcset|xlink:href)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;

/**
 * Every outside address the file's markup and stylesheets load when it
 * opens: the src, href, data, poster and srcset of loading elements (a link
 * a reader clicks, `<a href>`, loads nothing), and each url() and @import of
 * its `<style>` elements. The page's own script is not read: what it fetches
 * is the page's behavior, not the file's.
 * Each reference is read as the render reads the page's own (assetRef).
 * @param {string} html
 * @param {string} dir the folder the file sits in
 * @returns {string[]} each address once, in file order
 */
export function outsideRequests(html, dir) {
  const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, m =>
    m.slice(0, m.indexOf('>') + 1),
  );
  /** @type {Set<string>} */
  const found = new Set();
  /** @param {string} value */
  const add = value => {
    const ref = assetRef(value, {dir, root: dir});
    if (ref?.kind === 'remote') found.add(ref.ref);
  };
  for (const [, , attrs] of withoutScripts.matchAll(LOADING_ATTRS)) {
    for (const m of attrs.matchAll(ATTR)) {
      const value = m[3] ?? m[4] ?? m[5] ?? '';
      if (m[1].toLowerCase() === 'srcset') {
        for (const part of value.split(',')) add(part.trim().split(/\s+/)[0] ?? '');
      } else add(value);
    }
  }
  for (const [, css] of withoutScripts.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    for (const m of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi)) add(m[1] ?? m[2] ?? m[3] ?? '');
    for (const m of css.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) add(m[1] ?? m[2] ?? '');
  }
  return [...found];
}

/**
 * Whether the file's embedded source gives back every file the render
 * carried, byte for byte, compared in memory with the files on disk.
 * @param {string} html the written file
 * @param {string} input the page module, absolute
 * @param {string[]} files the carried files, relative to the folder that
 *   holds them all, the page first
 * @returns {{exact: boolean, files: number}}
 */
export function roundTrip(html, input, files) {
  const block = readSourceBlock(html);
  if (!block.found || !('source' in block) || !block.source) return {exact: false, files: 0};
  const embedded = block.source.files;
  const root = carryRoot(input, files[0] ?? path.basename(input));
  const exact =
    embedded.length === files.length &&
    embedded.every(
      (/** @type {{path: string, base64: string}} */ f) => {
        try {
          return Buffer.from(f.base64, 'base64').equals(fs.readFileSync(path.join(root, f.path)));
        } catch {
          return false;
        }
      },
    );
  return {exact, files: embedded.length};
}

/**
 * The folder the carried paths are relative to: the page's path less its
 * carried path.
 * @param {string} input absolute
 * @param {string} page the page's carried path
 */
function carryRoot(input, page) {
  let root = path.dirname(input);
  for (let i = page.split('/').length - 1; i > 0; i -= 1) root = path.dirname(root);
  return root;
}
