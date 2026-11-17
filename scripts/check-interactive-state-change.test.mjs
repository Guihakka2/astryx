// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file Buttons change visibly on hover and on press, with no theme and in
 *   every official theme
 * @input Core's button paints and default tokens, the official themes'
 *   token maps and button rules
 * @output A failure for each theme (or Core alone), mode and button variant
 *   whose hover or pressed paint over its fill looks the same as at rest
 * @position Theme guard beside the text contrast checks
 *
 * Core paints a button's hover and press as `--color-overlay-hover` and
 * `--color-overlay-pressed` over the variant's fill. A filled variant sets
 * both to a tint of its own label colour; a theme's button rule may set them
 * again. The step counted is the one the look check uses: a pixel changes
 * when its red, green and blue move by more than 24 in total.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {compositeOver} from '../packages/core/src/theme/contrast.ts';
import {parseColor} from '../packages/core/src/utils/color.ts';
import {
  FIRST_PARTY_THEMES,
  MODES,
  resolveColor,
  themeTokens,
} from './lib/theme-contrast.mjs';

const CORE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../packages/core/src',
);

/** Core's default color tokens, as tokens.stylex.ts writes them. */
const CORE_TOKENS = Object.fromEntries(
  [
    ...fs
      .readFileSync(path.join(CORE, 'theme/tokens.stylex.ts'), 'utf8')
      .matchAll(/^\s*'(--color-[\w-]+)':\s*'([^']+)'/gm),
  ].map(m => [m[1], m[2]]),
);

/** Core's paint for a filled button's hover and press, from Button.tsx. */
const buttonSource = fs.readFileSync(
  path.join(CORE, 'Button/Button.tsx'),
  'utf8',
);
const corePaint = (/** @type {string} */ name) =>
  new RegExp(`const ${name} =\\s*'([^']+)'`).exec(buttonSource)?.[1];
const FILLED_PAINT = {
  hover: corePaint('FILLED_HOVER_PAINT'),
  pressed: corePaint('FILLED_PRESSED_PAINT'),
};

/** Core's fill and label for each button variant, and whether it is filled. */
const VARIANTS = {
  primary: {
    fill: 'var(--color-accent)',
    label: 'var(--color-on-accent)',
    filled: true,
  },
  secondary: {
    fill: 'var(--color-neutral)',
    label: 'var(--color-text-primary)',
    filled: true,
  },
  ghost: {fill: 'transparent', label: 'var(--color-text-primary)'},
  destructive: {
    fill: 'var(--color-error)',
    label: 'var(--color-on-error)',
    filled: true,
  },
};

/** The smallest change a person sees, as the look check counts it. */
const VISIBLE_STEP = 24;

/** A paint mixed from the element's own text colour. */
const LABEL_MIX =
  /^color-mix\(in srgb, currentColor (\d+(?:\.\d+)?)%, transparent\)$/i;

/**
 * @param {unknown} value
 * @param {Record<string, unknown>} tokens
 * @param {number} modeIndex
 * @param {{r: number, g: number, b: number, a: number}} label
 */
function paintOf(value, tokens, modeIndex, label) {
  const own = typeof value === 'string' ? value.trim() : '';
  const named = own.startsWith('var(')
    ? tokens[own.slice(4, -1).split(',')[0].trim()]
    : value;
  const raw = Array.isArray(named) ? named[modeIndex] : named;
  const mix = typeof raw === 'string' ? LABEL_MIX.exec(raw.trim()) : null;
  if (mix) return {...label, a: Number(mix[1]) / 100};
  if (raw === 'transparent') return {r: 0, g: 0, b: 0, a: 0};
  const color = resolveColor(raw, tokens, modeIndex);
  return color == null ? null : parseColor(color);
}

/** @param {{r: number, g: number, b: number}} a @param {{r: number, g: number, b: number}} b */
const step = (a, b) =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

function measurements() {
  const rows = [];
  const themes = {
    'Core with no theme': {tokens: {}},
    ...FIRST_PARTY_THEMES,
  };
  for (const [themeName, theme] of Object.entries(themes)) {
    const button = theme.components?.button ?? {};
    for (const [modeIndex, mode] of MODES.entries()) {
      for (const [variant, core] of Object.entries(VARIANTS)) {
        const rule = {...button.base, ...button[`variant:${variant}`]};
        const tokens = {...CORE_TOKENS, ...themeTokens(theme, rule)};
        const page = parseColor(
          resolveColor(tokens['--color-background-body'], tokens, modeIndex),
        );
        const black = {r: 0, g: 0, b: 0, a: 1};
        const label = paintOf(
          rule.color ?? core.label,
          tokens,
          modeIndex,
          black,
        );
        const fill = paintOf(
          rule.backgroundColor ?? core.fill,
          tokens,
          modeIndex,
          label,
        );
        const rest = page && fill ? compositeOver(fill, page) : null;
        for (const state of /** @type {const} */ (['hover', 'pressed'])) {
          const token = `--color-overlay-${state}`;
          const painted =
            rule[token] ?? (core.filled ? FILLED_PAINT[state] : tokens[token]);
          const overlay = paintOf(painted, tokens, modeIndex, label);
          rows.push({
            where: `${themeName} ${mode} ${variant} button ${state}`,
            step:
              rest && overlay ? step(compositeOver(overlay, rest), rest) : null,
          });
        }
      }
    }
  }
  return rows;
}

describe('button hover and press', () => {
  const rows = measurements();

  it("reads Core's filled paint and resolves every fill, label and overlay", () => {
    expect(FILLED_PAINT.hover).toMatch(LABEL_MIX);
    expect(FILLED_PAINT.pressed).toMatch(LABEL_MIX);
    expect(rows.filter(row => row.step == null).map(row => row.where)).toEqual(
      [],
    );
  });

  it('changes the fill visibly on hover and on press', () => {
    expect(
      rows
        .filter(row => row.step != null && row.step <= VISIBLE_STEP)
        .map(row => `${row.where}: moves ${row.step.toFixed(0)}`),
    ).toEqual([]);
  });
});
