// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file A palette a newer CLI made names the newer recipe and the update.
 * @input Palette configs with a recipe numbered past this CLI's, and one
 *   with an unknown recipe that is not an Astryx one
 * @output Proof that `theme palette generate` and the theme editor refuse a
 *   newer recipe with the update command, keeping the refusal's code, and
 *   that any other unknown recipe keeps the generator's refusal
 * @position api/theme/palette/generate — tests
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {ERROR_CODES} from '../../../../foundation/response/error-codes.mjs';
import {paletteFiles, paletteMapping} from '../../../theme-edit/_palette.mjs';
import {themePaletteGenerate} from './generate.mjs';
import {PALETTE_RECIPES} from './generator.mjs';
import {newerRecipe} from './newer-recipe.mjs';

/** @type {string} */
let cwd;
beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'astryx-newer-recipe-'));
});
afterEach(() => fs.rmSync(cwd, {recursive: true, force: true}));

const NEWER = `astryx-oklch-v${PALETTE_RECIPES.length + 1}`;

/** @param {string} file @param {unknown} config */
function write(file, config) {
  const full = path.join(cwd, file);
  fs.mkdirSync(path.dirname(full), {recursive: true});
  fs.writeFileSync(full, JSON.stringify(config));
}

/** @param {() => unknown} run */
function refusal(run) {
  try {
    run();
  } catch (error) {
    return /** @type {any} */ (error);
  }
  throw new Error('expected a refusal');
}

describe('a palette a newer CLI made', () => {
  it('is a recipe numbered past every recipe this CLI knows', () => {
    expect(newerRecipe(NEWER)).toBe(NEWER);
    for (const known of PALETTE_RECIPES) expect(newerRecipe(known)).toBeNull();
    expect(newerRecipe('astryx-oklch-v0')).toBeNull();
    expect(newerRecipe('dusty')).toBeNull();
    expect(newerRecipe(undefined)).toBeNull();
  });

  it('theme palette generate names the recipe and the update', () => {
    write('palette.config.json', {
      recipe: NEWER,
      families: [{id: 'accent', seed: '#5b3cc4'}],
    });
    const error = refusal(() =>
      themePaletteGenerate('palette.config.json', {}, {cwd}),
    );
    expect(error.code).toBe(ERROR_CODES.ERR_PALETTE_GENERATION);
    expect(error.message).toContain(
      `palette.config.json was made with a newer version of the Astryx CLI: its colors use the ${NEWER} recipe`,
    );
    expect(error.message).toContain(`knows ${PALETTE_RECIPES.join(', ')}`);
    expect(error.message).toMatch(
      /Update the CLI, then run the command again: .*@astryxdesign\/cli@latest\. Nothing was changed\.$/,
    );
    expect(error.suggestions?.[0]?.name).toMatch(/@astryxdesign\/cli@latest$/);
  });

  it('the theme editor names the recipe and the update', () => {
    write(paletteFiles('saved').config, {
      recipe: NEWER,
      families: [{id: 'accent', seed: '#5b3cc4'}],
    });
    const data = {
      settings: [
        {
          source: /** @type {const} */ ('dial'),
          thing: 'accent',
          value: '#5b3cc4',
        },
      ],
    };
    const error = refusal(() =>
      paletteMapping(cwd, 'saved', data, undefined, {}),
    );
    expect(error.code).toBe(ERROR_CODES.ERR_PALETTE_GENERATION);
    expect(error.message).toContain(
      `${paletteFiles('saved').config} was made with a newer version of the theme editor: its colors use the ${NEWER} recipe`,
    );
    expect(error.message).toMatch(/@astryxdesign\/cli@latest/);
  });

  it('any other unknown recipe keeps the refusal of the generator', () => {
    write('palette.config.json', {
      recipe: 'dusty',
      families: [{id: 'accent', seed: '#5b3cc4'}],
    });
    const error = refusal(() =>
      themePaletteGenerate('palette.config.json', {}, {cwd}),
    );
    expect(error.code).toBe(ERROR_CODES.ERR_PALETTE_GENERATION);
    expect(error.message).toMatch(/^Unknown palette recipe: dusty \(known: /);
  });
});
