// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file Tests for the alias classes a rendered page's first paint names its
 * repeated StyleX class lists by.
 */

import {describe, expect, it} from 'vitest';
import {aliasClasses} from './class-alias.mjs';

const LIST = 'xaaaaa1 xbbbbb1 xccccc1 xddddd1 xeeeee1';

/** @param {number} n @param {string} [extra] */
const rows = (n, extra = '') =>
  Array.from({length: n}, (_, i) => `<td class="astryx-table-cell ${LIST}${extra}" data-density="balanced">${i}</td>`).join('');

const CSS = [
  '.xaaaaa1{color:red}',
  '.xbbbbb1:hover{color:blue}',
  '@media (min-width: 600px){.xccccc1{padding:4px}}',
  '@supports (display:grid){.xddddd1{display:grid}}',
  '@container card (min-width: 300px){.xeeeee1{margin:0}}',
  '.astryx-table-cell{border:0}',
].join('\n');

describe('aliasClasses', () => {
  it('names a repeated StyleX list by one alias, keeping every other name and attribute', () => {
    const {markup, css, aliases} = aliasClasses(rows(600), CSS);
    expect(aliases).toBe(1);
    expect(markup).toContain('<td class="astryx-table-cell _a0" data-density="balanced">');
    expect(markup).not.toContain('xaaaaa1');
    expect(css).toContain('.xaaaaa1,._a0{color:red}');
    expect(css).toContain('.xbbbbb1:hover,._a0:hover{color:blue}');
    expect(css).toContain('@media (min-width: 600px){.xccccc1,._a0{padding:4px}}');
    expect(css).toContain('@supports (display:grid){.xddddd1,._a0{display:grid}}');
    expect(css).toContain('@container card (min-width: 300px){.xeeeee1,._a0{margin:0}}');
    expect(css).toContain('.astryx-table-cell{border:0}');
    expect(markup.length).toBeLessThan(rows(600).length * 0.7);
  });

  it('follows a class into compound selectors and :is, :where and :has', () => {
    const css = [
      '.xaaaaa1.xbbbbb1{color:red}',
      ':where(.xccccc1) .xddddd1{color:blue}',
      '.astryx-row:has(.xeeeee1){outline:0}',
      ':is(.xaaaaa1, .astryx-x){gap:0}',
    ].join('\n');
    const out = aliasClasses(rows(600), css).css;
    expect(out).toContain('.xaaaaa1.xbbbbb1,._a0.xbbbbb1,.xaaaaa1._a0,._a0._a0{color:red}');
    expect(out).toContain(':where(._a0) .xddddd1');
    expect(out).toContain(':where(._a0) ._a0');
    expect(out).toContain('.astryx-row:has(._a0){outline:0}');
    expect(out).toContain(':is(._a0, .astryx-x){gap:0}');
  });

  it('keeps a class a rule names inside :not() or in an @scope prelude', () => {
    const css = `${CSS}\n.astryx-x:not(.xaaaaa1){color:green}\n@scope (.xbbbbb1){.astryx-y{color:red}}`;
    const {markup} = aliasClasses(rows(600), css);
    expect(markup).toContain('xaaaaa1');
    expect(markup).toContain('xbbbbb1');
    expect(markup).not.toContain('xccccc1');
    expect(markup).toMatch(/class="astryx-table-cell xaaaaa1 xbbbbb1 _a0"/);
  });

  it('leaves a list whose alias would add more stylesheet than it saves markup', () => {
    const many = Array.from({length: 40}, (_, i) => `.xaaaaa1:nth-child(${i}){order:${i}}`).join('\n');
    const once = aliasClasses(rows(2), `${CSS}\n${many}`);
    expect(once.aliases).toBe(0);
    expect(once.markup).toBe(rows(2));
  });

  it('changes nothing when a selector cannot be read, or nothing repeats', () => {
    expect(aliasClasses(rows(600), `${CSS}\n.xaaaaa1[{color:red}`).aliases).toBe(0);
    expect(aliasClasses('<p class="astryx-text">hi</p>', CSS)).toEqual({markup: '<p class="astryx-text">hi</p>', css: CSS, aliases: 0});
  });
});
