// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file The checks a render runs on the file it just wrote, so the person
 * or agent who shares it need not run them by hand: what the file asks the
 * network for, and whether its embedded source gives back every carried file
 * exactly. A check reports; it never stops the write.
 * @input the bytes of the written file, the page module, the carried files
 * @output {outside, roundTrip}
 * @position read by renderToFile in api/render/_adapter.mjs after it writes
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {readSourceBlock} from './source-block.mjs';
import {CSS_URL, assetRef, cssUrlRef, importParams} from './render-page.mjs';
import {scanHtml} from './html-reader.mjs';

/** Elements whose attributes load a resource when the file opens. */
const LOADING = new Set(['img', 'script', 'link', 'iframe', 'object', 'embed', 'source', 'video', 'audio', 'track', 'input', 'image', 'use']);
/** The attributes that load it. */
const LOADING_ATTRS = new Set(['src', 'href', 'data', 'poster', 'srcset', 'xlink:href']);

/**
 * Every outside address the file's markup and stylesheets load when it
 * opens: the src, href, data, poster and srcset of loading elements (a link
 * a reader clicks, `<a href>`, loads nothing), each url() of a `style`
 * attribute or `<style>` element, and each CSS import rule of a `<style>`
 * element.
 * Tags and attributes are read as the render reads its markup (scanHtml),
 * and each reference as the render reads the page's own (assetRef). The
 * page's own script is not read: what it fetches is the page's behavior,
 * not the file's.
 * @param {string} html
 * @param {string} dir the folder the file sits in
 * @returns {string[]} each address once, in file order
 */
export function outsideRequests(html, dir) {
  /** @type {Set<string>} */
  const found = new Set();
  /** @param {string} value */
  const add = value => {
    const ref = assetRef(value, {dir, root: dir});
    if (ref?.kind === 'remote') found.add(ref.ref);
  };
  /** @param {string} css */
  const addCss = css => {
    // @import rules come first in a stylesheet, so file order holds.
    for (const m of css.matchAll(/@import\s+([^;]+);?/gi)) {
      const url = importParams(m[1])?.url;
      if (url) add(url);
    }
    for (const m of css.matchAll(new RegExp(CSS_URL.source, 'g'))) add(cssUrlRef(m));
  };
  let inStyle = false;
  for (const token of scanHtml(html)) {
    if (token.kind === 'start') {
      inStyle = token.tag === 'style';
      for (const [name, value] of token.attrs) {
        if (name === 'style') addCss(value);
        if (!LOADING.has(token.tag) || !LOADING_ATTRS.has(name)) continue;
        if (name === 'srcset') {
          for (const part of value.split(',')) add(part.trim().split(/\s+/)[0] ?? '');
        } else add(value);
      }
    } else if (token.kind === 'raw' && inStyle) {
      addCss(html.slice(token.start, token.end));
    }
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
 * @returns {{exact: boolean, files: number, differs: string[]}} `differs`:
 *   the carried paths whose embedded copy differs from the file on disk, or
 *   that are missing on either side
 */
export function roundTrip(html, input, files) {
  const block = readSourceBlock(html);
  if (!block.found || !('source' in block) || !block.source) return {exact: false, files: 0, differs: [...files]};
  /** @type {Map<string, string>} */
  const embedded = new Map(block.source.files.map((/** @type {{path: string, base64: string}} */ f) => [f.path, f.base64]));
  const root = carryRoot(input, files[0] ?? path.basename(input));
  /** @type {string[]} */
  const differs = [];
  for (const rel of new Set([...files, ...embedded.keys()])) {
    const copy = embedded.get(rel);
    let same = false;
    if (copy !== undefined && files.includes(rel)) {
      try {
        same = Buffer.from(copy, 'base64').equals(fs.readFileSync(path.join(root, rel)));
      } catch {
        same = false;
      }
    }
    if (!same) differs.push(rel);
  }
  return {exact: differs.length === 0, files: embedded.size, differs};
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
