// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file themeAdaptations.edges.test.ts
 * @input The size-edge helpers in themeAdaptations.ts and the source of Core
 *   and the published themes
 * @output Checks the size-edge spellings, and that every range or lowered
 *   width or height edge in Core and the themes goes through those helpers
 * @position Unit half of the boundary proof; the browser half is
 *   scripts/stylex-size-boundary.browser.test.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  belowStyleKey,
  heightBelowFeature,
  widthBelowFeature,
  widthFromFeature,
} from './themeAdaptations';

const CORE_SRC = path.resolve(__dirname, '..');
const THEMES = path.resolve(CORE_SRC, '../../themes');

// A width or height edge written by hand: a range feature, either way round
// (`(width < 768px)`, `(width < ${n}px)`, `(640px <= width)`), or a lowered
// fractional edge (`(max-width: 767.99px)`).
const HAND_WRITTEN_EDGE = [
  /\(\s*(?:width|height)\s*[<>]?=?\s*(?:[\d.]|\$\{)/,
  /(?:[\d.]+(?:px|r?em)|\})\s*[<>]=?\s*(?:width|height)\s*\)/,
  /\(\s*(?:max|min)-(?:width|height)\s*:\s*[\d.]*\.\d+px/,
];

// The helpers' own spellings, the only lines allowed to write an edge.
const HELPER_LINES = new Set([
  'return `(width < ${px}px)`;',
  'return `(height < ${px}px)`;',
  'return `(width >= ${px}px)`;',
]);

function handWrittenEdges(source: string): string[] {
  return source
    .split('\n')
    .filter(line => !/^\s*(\*|\/\/)/.test(line))
    .filter(line => /['"`]/.test(line))
    .filter(line => HAND_WRITTEN_EDGE.some(pattern => pattern.test(line)));
}

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['__tests__', 'node_modules', 'dist'].includes(entry.name)) {
        files.push(...sourceFiles(full));
      }
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(test|spec|stories)\./.test(entry.name)
    ) {
      files.push(full);
    }
  }
  return files;
}

describe('size edges', () => {
  it('spells range features for script and plain CSS', () => {
    expect(widthBelowFeature(768)).toBe('(width < 768px)');
    expect(heightBelowFeature(500)).toBe('(height < 500px)');
    expect(widthFromFeature(1024)).toBe('(width >= 1024px)');
  });

  it('spells "below" StyleX keys as the negated lower edges', () => {
    expect(belowStyleKey({width: 768})).toBe(
      '@media not all and (min-width: 768px)',
    );
    expect(belowStyleKey({width: 768, height: 500})).toBe(
      '@media not all and (min-width: 768px) and (min-height: 500px)',
    );
  });

  it('finds a hand-written edge in a planted line, and none in the helper output', () => {
    expect(handWrittenEdges(`  '@media (width < 768px)': {},`)).toHaveLength(1);
    expect(
      handWrittenEdges('  const q = `(height < ${edge}px)`;'),
    ).toHaveLength(1);
    expect(
      handWrittenEdges(`  '@container (400px <= width)': {},`),
    ).toHaveLength(1);
    expect(
      handWrittenEdges(`  '@media (max-width: 767.99px)': {},`),
    ).toHaveLength(1);
    expect(
      handWrittenEdges(`  '${belowStyleKey({width: 768, height: 500})}': {},`),
    ).toEqual([]);
    expect(handWrittenEdges(`  // (width < 768px) in a comment`)).toEqual([]);
  });

  it('keeps every range or lowered width and height edge in Core and the themes in the helpers', () => {
    const roots = [
      CORE_SRC,
      ...fs
        .readdirSync(THEMES, {withFileTypes: true})
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(THEMES, entry.name, 'src'))
        .filter(dir => fs.existsSync(dir)),
    ];
    const helper = path.join(CORE_SRC, 'theme/themeAdaptations.ts');
    const found: string[] = [];
    for (const root of roots) {
      for (const file of sourceFiles(root)) {
        for (const line of handWrittenEdges(fs.readFileSync(file, 'utf8'))) {
          if (file === helper && HELPER_LINES.has(line.trim())) {
            continue;
          }
          found.push(`${path.relative(CORE_SRC, file)}: ${line.trim()}`);
        }
      }
    }
    expect(found).toEqual([]);
  });
});
