// Copyright (c) Meta Platforms, Inc. and affiliates.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {describe, expect, it} from 'vitest';
import {outsideRequests, roundTrip} from './share-checks.mjs';
import {sourceBlock} from './source-block.mjs';

describe('outsideRequests', () => {
  it('names what loading elements and stylesheets fetch, once each, and nothing a reader clicks or the script holds', () => {
    const html = [
      '<html><head><style>@import "https://fonts.example/a.css"; .x{background:url(//cdn.example/b.png)} .y{background:url(data:image/png;base64,AA)}</style>',
      '<link rel="stylesheet" href="https://cdn.example/c.css"></head><body>',
      '<img src="https://img.example/d.png" srcset="https://img.example/d2.png 2x, local.png 1x">',
      '<img src="data:image/png;base64,AA"><a href="https://example.com/read-more">more</a>',
      '<img src="https://img.example/d.png">',
      '<script>fetch("https://api.example/e")</script></body></html>',
    ].join('');
    expect(outsideRequests(html, os.tmpdir())).toEqual([
      'https://cdn.example/c.css',
      'https://img.example/d.png',
      'https://img.example/d2.png',
      '//cdn.example/b.png',
      'https://fonts.example/a.css',
    ]);
  });

  it('is empty for a file that loads nothing from the network', () => {
    expect(
      outsideRequests('<html><body><img src="data:image/png;base64,AA"><a href="https://x.example">x</a></body></html>', os.tmpdir()),
    ).toEqual([]);
  });
});

describe('roundTrip', () => {
  const page = (/** @type {Record<string, string>} */ files) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'share-checks-'));
    for (const [rel, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), {recursive: true});
      fs.writeFileSync(path.join(dir, rel), text);
    }
    const carried = Object.keys(files);
    const block = sourceBlock(
      carried[0],
      carried.map(rel => ({path: rel, bytes: fs.readFileSync(path.join(dir, rel))})),
    );
    return {dir, carried, html: `<html><body><p>x</p>${block}</body></html>`};
  };

  it('is exact when every carried file comes back byte for byte, a page below the carry root included', () => {
    const {dir, carried, html} = page({'pages/page.tsx': 'export default () => null;\n', 'data.json': '{"a":1}\n'});
    expect(roundTrip(html, path.join(dir, 'pages/page.tsx'), carried)).toEqual({exact: true, files: 2});
  });

  it('is not exact when a carried file changed after the render', () => {
    const {dir, carried, html} = page({'page.tsx': 'export default () => null;\n'});
    fs.writeFileSync(path.join(dir, 'page.tsx'), 'export default () => 1;\n');
    expect(roundTrip(html, path.join(dir, 'page.tsx'), carried)).toEqual({exact: false, files: 1});
  });
});
