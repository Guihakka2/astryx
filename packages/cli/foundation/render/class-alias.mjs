// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file Shorter class lists for a rendered page's first paint, for
 * `astryx experimental render`. A page that repeats an element (a table
 * row, a list item) repeats its class list each time, and StyleX writes one
 * class per declaration, so the lists are most of a large page's markup.
 * Each list of StyleX classes that repeats becomes one short alias class in
 * the first paint, and every rule that names one of its classes also names
 * the alias in the same place, so the alias matches exactly where the
 * classes it stands for match: rule order, specificity, pseudo-classes and
 * at-rules stay as they were. Only the markup the file paints first
 * changes; the page's script draws its own elements with the classes StyleX
 * wrote. Names StyleX did not write (`astryx-*`, a theme's own) stay.
 *
 * A class keeps its own name when a rule could not name an alias in its
 * place: inside :not(), where the alias would need the opposite meaning; in
 * an at-rule's prelude (@scope (.card)); or in a selector with too many
 * forms. A stylesheet with a selector the parser cannot read keeps every
 * class.
 *
 * @position foundation/render — used by render-page.mjs
 */

import postcss from 'postcss';
import {selectorParser} from '../runtime/lazy-dependencies.mjs';

/** A class StyleX writes: its prefix and a base-36 hash. */
const STYLEX_CLASS = /^x[0-9a-z]{5,}$/;

/** The prefix of an alias class; no StyleX or Astryx class starts with it. */
export const ALIAS_PREFIX = '_a';

/** The fewest bytes of repeated class lists worth reading the stylesheet for. */
const MIN_SAVING = 16 * 1024;

/** At most this many selectors one selector becomes with its aliases. */
const MAX_FORMS = 64;

/** A class attribute in markup as React writes it. */
const CLASS_ATTR = /\sclass="([^"]*)"/g;

/**
 * The selectors inside each top-level pair of parentheses of an at-rule's
 * prelude (`(.card) to (.content)`, `selector(.x)`).
 * @param {string} params
 * @returns {string[]}
 */
function parenthesized(params) {
  /** @type {string[]} */
  const out = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < params.length; i++) {
    if (params[i] === '(') {
      if (depth === 0) start = i + 1;
      depth += 1;
    } else if (params[i] === ')' && depth > 0) {
      depth -= 1;
      if (depth === 0) out.push(params.slice(start, i));
    }
  }
  return out;
}

/** @param {import('postcss').Rule} rule */
const inKeyframes = rule =>
  rule.parent?.type === 'atrule' && /keyframes$/i.test(/** @type {import('postcss').AtRule} */ (rule.parent).name);

/**
 * The page's markup and stylesheet with each repeated list of StyleX classes
 * written as one alias class, where that makes the file smaller.
 * @param {string} markup the first-paint markup
 * @param {string} css the page's stylesheet
 * @returns {{markup: string, css: string, aliases: number}}
 */
export function aliasClasses(markup, css) {
  const unchanged = {markup, css, aliases: 0};
  // Each list of StyleX classes the markup writes, and how often. Most pages
  // repeat little: reading the stylesheet would cost more time than the few
  // bytes an alias could save.
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const m of markup.matchAll(CLASS_ATTR)) {
    const key = m[1].split(/\s+/).filter(c => STYLEX_CLASS.test(c)).join(' ');
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let most = 0;
  /** The classes of the lists that repeat. @type {Set<string>} */
  const candidates = new Set();
  for (const [key, count] of counts) {
    if (count < 3) continue;
    most += (count - 1) * key.length;
    for (const c of key.split(' ')) candidates.add(c);
  }
  if (most < MIN_SAVING) return unchanged;
  /**
   * Whether a selector may name a class of a repeated list: only those
   * selectors are parsed. A selector names a class as `.name`.
   * @param {string} text
   */
  const mayName = text => {
    for (const m of text.matchAll(/\.(x[0-9a-z]{5,})/g)) if (candidates.has(m[1])) return true;
    return false;
  };

  const parser = selectorParser();
  /** @type {import('postcss').Root} */
  let root;
  try {
    root = postcss.parse(css);
  } catch {
    return unchanged;
  }
  /** Classes no alias may stand for. @type {Set<string>} */
  const unsafe = new Set();
  /** Characters of selector text naming each class. @type {Map<string, number>} */
  const selectorBytes = new Map();
  /** Each style rule with its parsed selector. @type {{rule: import('postcss').Rule, ast: any}[]} */
  const rules = [];
  let unreadable = false;
  root.walkAtRules(at => {
    if (!mayName(at.params)) return;
    for (const inner of parenthesized(at.params)) {
      try {
        parser().astSync(inner).walkClasses((/** @type {any} */ c) => {
          unsafe.add(c.value);
        });
      } catch {
        // Not a selector (a media feature such as min-width: 600px).
      }
    }
  });
  root.walkRules(rule => {
    if (inKeyframes(rule) || !mayName(rule.selector)) return;
    try {
      const ast = parser().astSync(rule.selector);
      rules.push({rule, ast});
      ast.each((/** @type {any} */ sel) => {
        const size = String(sel).trim().length + 1;
        sel.walkClasses((/** @type {any} */ c) => {
          selectorBytes.set(c.value, (selectorBytes.get(c.value) ?? 0) + size);
          for (let p = c.parent; p; p = p.parent) {
            if (p.type === 'pseudo' && p.value.toLowerCase() === ':not') unsafe.add(c.value);
          }
        });
      });
    } catch {
      unreadable = true;
    }
  });
  if (unreadable) return unchanged;
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = withAliases(markup, counts, root, rules, selectorBytes, unsafe);
    if (result) return result;
  }
  return unchanged;
}

/**
 * One try at the aliases for the classes not in `unsafe`: null when a rule
 * turned out to need a class kept (too many forms), which is then in
 * `unsafe` for the next try. The stylesheet changes only on success.
 * @param {string} markup
 * @param {Map<string, number>} counts each list of StyleX classes, and how often the markup writes it
 * @param {import('postcss').Root} root
 * @param {{rule: import('postcss').Rule, ast: any}[]} rules
 * @param {Map<string, number>} selectorBytes
 * @param {Set<string>} unsafe
 * @returns {{markup: string, css: string, aliases: number} | null}
 */
function withAliases(markup, counts, root, rules, selectorBytes, unsafe) {
  /** @param {string} c */
  const aliasable = c => selectorBytes.has(c) && !unsafe.has(c);
  /** Each list's aliasable classes. @type {Map<string, number>} */
  const lists = new Map();
  for (const [key, count] of counts) {
    const k = key.split(' ').filter(aliasable).join(' ');
    if (k) lists.set(k, (lists.get(k) ?? 0) + count);
  }
  // An alias pays for itself when the markup it shortens outweighs the
  // selectors it adds to the stylesheet.
  /** @type {Map<string, string>} */
  const aliasOf = new Map();
  for (const [key, count] of [...lists].sort((a, b) => b[1] * b[0].length - a[1] * a[0].length)) {
    const name = `${ALIAS_PREFIX}${aliasOf.size.toString(36)}`;
    const added = key.split(' ').reduce((sum, c) => sum + (selectorBytes.get(c) ?? 0), 0);
    if (count * (key.length - name.length) > added) aliasOf.set(key, name);
  }
  if (aliasOf.size === 0) return {markup, css: root.toString(), aliases: 0};
  /** The aliases each class is in. @type {Map<string, string[]>} */
  const holders = new Map();
  for (const [key, name] of aliasOf) {
    for (const c of key.split(' ')) holders.set(c, [...(holders.get(c) ?? []), name]);
  }
  /** @type {Map<import('postcss').Rule, string>} */
  const selectors = new Map();
  for (const {rule, ast} of rules) {
    /** @type {string[]} */
    const forms = [];
    let tooMany = false;
    ast.each((/** @type {any} */ sel) => {
      /** @type {string[]} */
      const named = [];
      sel.walkClasses((/** @type {any} */ c) => {
        if (holders.has(c.value) && !named.includes(c.value)) named.push(c.value);
      });
      if (named.length === 0) return;
      const choices = named.map(c => [c, ...(/** @type {string[]} */ (holders.get(c)))]);
      const total = choices.reduce((n, list) => n * list.length, 1);
      if (total > MAX_FORMS) {
        for (const c of named) unsafe.add(c);
        tooMany = true;
        return;
      }
      // Every combination but the selector as written: each class as itself
      // or as one of the aliases that hold it.
      for (let k = 1; k < total; k++) {
        let rest = k;
        /** @type {Map<string, string>} */
        const pick = new Map();
        for (const list of choices) {
          pick.set(list[0], list[rest % list.length]);
          rest = Math.floor(rest / list.length);
        }
        const form = sel.clone();
        form.walkClasses((/** @type {any} */ c) => {
          c.value = pick.get(c.value) ?? c.value;
        });
        forms.push(String(form).trim());
      }
    });
    if (tooMany) return null;
    if (forms.length > 0) selectors.set(rule, `${rule.selector},${forms.join(',')}`);
  }
  for (const [rule, selector] of selectors) rule.selector = selector;
  /** The alias of each list as the markup writes it. @type {Map<string, string | null>} */
  const named = new Map();
  const out = markup.replace(CLASS_ATTR, (/** @type {string} */ whole, /** @type {string} */ list) => {
    let replaced = named.get(list);
    if (replaced === undefined) {
      const classes = list.split(/\s+/).filter(Boolean);
      const stylex = classes.filter(c => STYLEX_CLASS.test(c) && aliasable(c));
      const name = aliasOf.get(stylex.join(' '));
      replaced = name ? [...classes.filter(c => !stylex.includes(c)), name].join(' ') : null;
      named.set(list, replaced);
    }
    return replaced === null ? whole : ` class="${replaced}"`;
  });
  return {markup: out, css: root.toString(), aliases: aliasOf.size};
}
