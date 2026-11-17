// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file stylex-size-boundary.browser.test.mjs
 * @input Core's compact StyleX key (touchKeys.compact, alone and nested in
 *   the touch key, as the touch presentation notes nest it) compiled by core's
 *   build; run with
 *   ASTRYX_STYLEX_BROWSER=1 after installing Chromium (CI's test-build job
 *   does both)
 * @output Real-browser proof that the compact keys match at 767px wide and
 *   499px tall and not at 768px or 500px, under a fine and a coarse pointer,
 *   and that the range spelling StyleX lowers does match at the edge
 * @position The browser half of
 *   packages/core/src/theme/themeAdaptations.edges.test.ts
 */

import fs from 'node:fs';
import path from 'node:path';

import {transformSync} from '@babel/core';
import stylexBabelPlugin from '@stylexjs/babel-plugin';
import {chromium} from 'playwright';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {TOUCH_QUERY} from '../packages/core/src/utils/touchQueries';

const CORE = path.resolve(import.meta.dirname, '../packages/core');

const OFF = 'rgb(0, 0, 255)';
const ON = 'rgb(255, 0, 0)';

// The compact key exactly as Core spells it. The `.stylex.ts` module only
// loads compiled, so the test reads its literal.
const COMPACT_STYLE_KEY = /^\s*compact:\s*'([^']+)'/m.exec(
  fs.readFileSync(
    path.join(CORE, 'src/utils/touchPresentation.stylex.ts'),
    'utf8',
  ),
)[1];
const TOUCH_KEY = `@media ${TOUCH_QUERY}`;
// The range spelling the compact definition gives script.
const COMPACT_QUERY = '(width < 768px), (height < 500px)';

// Literal keys, as Core writes them. `range` is the spelling StyleX lowers
// to a length that also matches at the edge: the control.
const PROBE = `
import * as stylex from '@stylexjs/stylex';
export const styles = stylex.create({
  compact: {color: {default: '${OFF}', '${COMPACT_STYLE_KEY}': '${ON}'}},
  compactTouch: {
    color: {
      default: '${OFF}',
      '${TOUCH_KEY}': {default: null, '${COMPACT_STYLE_KEY}': '${ON}'},
    },
  },
  range: {color: {default: '${OFF}', '@media ${COMPACT_QUERY}': '${ON}'}},
});
`;

// [width, height, compact]: each edge, a pixel below it and a pixel above it.
const SIZES = [
  [767, 900, true],
  [768, 900, false],
  [769, 900, false],
  [1280, 499, true],
  [1280, 500, false],
  [1280, 501, false],
];

function compileProbe() {
  const result = transformSync(PROBE, {
    filename: path.join(CORE, 'src/SizeBoundaryProbe.tsx'),
    configFile: path.join(CORE, 'babel.config.json'),
    cwd: CORE,
  });
  const classes = name =>
    new RegExp(`${name}:\\s*\\{([^}]*)\\}`)
      .exec(result.code)[1]
      .match(/"(x\w+(?: x\w+)*)"/g)
      .map(value => value.slice(1, -1))
      .join(' ');
  return {
    css: stylexBabelPlugin.processStylexRules(result.metadata.stylex, false),
    compact: classes('compact'),
    compactTouch: classes('compactTouch'),
    range: classes('range'),
  };
}

describe.runIf(process.env.ASTRYX_STYLEX_BROWSER === '1')(
  "core's compact StyleX keys at the edges, in Chromium",
  () => {
    let browser;
    let probe;
    beforeAll(async () => {
      probe = compileProbe();
      browser = await chromium.launch({args: ['--no-sandbox']});
    }, 60_000);
    afterAll(async () => {
      await browser?.close();
    });

    for (const coarse of [false, true]) {
      it(`match below the edges only, with a ${coarse ? 'coarse' : 'fine'} pointer`, async () => {
        const context = await browser.newContext({hasTouch: coarse});
        const page = await context.newPage();
        try {
          await page.setContent(
            `<style>${probe.css}</style>` +
              `<div id="compact" class="${probe.compact}"></div>` +
              `<div id="compactTouch" class="${probe.compactTouch}"></div>` +
              `<div id="range" class="${probe.range}"></div>`,
          );
          const seen = [];
          const expected = [];
          for (const [width, height, compact] of SIZES) {
            await page.setViewportSize({width, height});
            seen.push(
              await page.evaluate(() => {
                const on = id =>
                  getComputedStyle(document.getElementById(id)).color;
                return {
                  size: `${innerWidth}x${innerHeight}`,
                  compact: on('compact'),
                  compactTouch: on('compactTouch'),
                  range: on('range'),
                };
              }),
            );
            const edge = compact || width === 768 || height === 500;
            expected.push({
              size: `${width}x${height}`,
              compact: compact ? ON : OFF,
              compactTouch: compact && coarse ? ON : OFF,
              range: edge ? ON : OFF,
            });
          }
          expect(seen).toEqual(expected);
        } finally {
          await context.close();
        }
      });
    }
  },
);
