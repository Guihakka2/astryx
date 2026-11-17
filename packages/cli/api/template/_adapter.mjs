// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file The `template` subject's adapter for icon mapping (AST-084 FR9),
 * which reads the project's icon sets through the `Project` seam, for the
 * project's component list, and for the not-found hint that names another
 * lookup command.
 *
 * @position api/template — adapter read by the template dispatcher
 */

import {Project} from '../../foundation/config/project.mjs';
import {NO_ICON_SETS} from '../../foundation/discovery/template-icons.mjs';

/**
 * The installed icon sets and the project's choice. A project the CLI cannot
 * read has no icon set, so templates are written unchanged.
 * @param {string} cwd
 * @returns {Promise<{sets: import('../../foundation/discovery/icon-set-discovery.mjs').DiscoveredIconSet[], choice: import('../../foundation/discovery/icon-set-discovery.mjs').IconSetChoice}>}
 */
export async function loadTemplateIconSets(cwd) {
  try {
    const project = await Project.load(cwd);
    const {sets, choice} = await project.iconSets();
    // Icon sets are experimental (spec:AST-017 FR27): a copied template
    // follows one only when the project opts in with `experimental.iconSet`.
    if (!choice.configured) return NO_ICON_SETS;
    return {sets, choice};
  } catch (error) {
    return {
      sets: [],
      choice: {
        status: 'none',
        reason: `The project could not be read, so no icon set applies: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

/**
 * Each component `astryx component --list` lists in the project, Core's and
 * each configured integration's, mapped to its package. It reads the same
 * kept list that command reads. A project whose components cannot be listed
 * has none here, so no component is named.
 * @param {string} cwd
 * @returns {Promise<Map<string, string>>}
 */
export async function loadComponentCatalog(cwd) {
  try {
    const [{coreContentDir}, {componentList}] = await Promise.all([
      import('../component/_adapter.mjs'),
      import('../component/list/list.mjs'),
    ]);
    const list = await componentList(coreContentDir(cwd), {
      cwd,
      detail: 'brief',
      zh: false,
      dense: false,
      lang: null,
    });
    /** @type {Map<string, string>} */
    const catalog = new Map();
    for (const entries of Object.values(list.data.components)) {
      for (const entry of /** @type {Array<{name: string, package: string}>} */ (
        entries
      )) {
        if (!catalog.has(entry.name)) catalog.set(entry.name, entry.package);
      }
    }
    return catalog;
  } catch {
    return new Map();
  }
}

/**
 * The unknown-template suggestions with the command that reads a component,
 * hook or docs topic matching that name (exact, folded or last segment) in
 * them, the list keeping its length, in the place
 * foundation/suggest/other-command.mjs gives it. The suggestions stay as they
 * are when no such entry exists or the check fails. The hint's modules load
 * only on this path.
 * @param {string} name
 * @param {import('../../foundation/response/base').Suggestion[]} suggestions
 * @param {string} cwd
 * @param {(suggestion: import('../../foundation/response/base').Suggestion) => Array<string | undefined>} namesOf
 *   the names the template matcher ranked a suggestion by: its id and its
 *   human name
 * @returns {Promise<import('../../foundation/response/base').Suggestion[] | undefined>}
 */
export async function withOtherCommandHint(name, suggestions, cwd, namesOf) {
  try {
    const [{findOtherCommand, withOtherCommand}, {docsRoutesLazily}] =
      await Promise.all([
        import('../../foundation/suggest/other-command.mjs'),
        import('../docs/_entry-names-lazily.mjs'),
      ]);
    const hint = await findOtherCommand(name, {
      from: 'template',
      cwd,
      docsRoutes: docsRoutesLazily,
    });
    return withOtherCommand(suggestions, hint, name, {
      from: 'template',
      namesOf,
    });
  } catch {
    return suggestions;
  }
}
