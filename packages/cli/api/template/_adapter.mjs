// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file The `template` subject's adapter for icon mapping (AST-084 FR9),
 * which reads the project's icon sets through the `Project` seam, for the
 * not-found hint that names another lookup command, and for the links and doc
 * tokens in a template's description.
 *
 * @position api/template — adapter read by the template dispatcher
 */

import {Project} from '../../foundation/config/project.mjs';
import {linkOwnedTexts} from '../docs/_adapter.mjs';
import {NO_ICON_SETS} from '../../foundation/discovery/template-icons.mjs';

/**
 * A template response with each description's links and doc tokens rendered,
 * the way `astryx docs` renders a doc's text: JSON readers get the bare
 * `astryx` command, never token syntax. The list renders every entry's.
 * @template {{type: string, package?: string, data: any}} R
 * @param {R} response
 * @param {string} cwd
 * @returns {Promise<R>}
 */
export async function linkTemplateDescriptions(response, cwd) {
  const entries = Array.isArray(response.data)
    ? response.data
    : [{...response.data, package: response.package}];
  const owned = entries.filter(
    (/** @type {any} */ entry) =>
      typeof entry?.description === 'string' &&
      entry.description.includes('{@'),
  );
  if (owned.length === 0) return response;
  const texts = await linkOwnedTexts(
    owned.map((/** @type {any} */ entry) => ({
      text: entry.description,
      package: entry.package,
    })),
    cwd,
  );
  const shown = new Map(
    owned.map((/** @type {any} */ entry, /** @type {number} */ i) => [
      entry,
      texts[i],
    ]),
  );
  if (Array.isArray(response.data)) {
    return {
      ...response,
      data: response.data.map((/** @type {any} */ entry) =>
        shown.has(entry) ? {...entry, description: shown.get(entry)} : entry,
      ),
    };
  }
  return {
    ...response,
    data: {...response.data, description: shown.get(entries[0])},
  };
}

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
