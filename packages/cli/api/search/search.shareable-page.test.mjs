// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file `astryx search` returns the experimental guides for sharing a page as
 * one HTML file, and still leaves every other experimental doc out
 * (spec:AST-017 FR27).
 */

import {describe, expect, it} from 'vitest';
import {runCli} from '../../test-utils/run-cli.mjs';
import {SEARCHABLE_EXPERIMENTAL_GUIDES as GUIDES} from './_gather-docs.mjs';

/** @param {string} query */
async function docs(query) {
  const {status, stdout} = await runCli([
    'search',
    ...query.split(' '),
    '--type',
    'doc',
    '--json',
  ]);
  expect(status).toBe(0);
  return /** @type {Array<{name: string, command: string}>} */ (
    JSON.parse(stdout).data.results
  );
}

describe('search and the shareable-page guides', () => {
  it.each([...GUIDES])('%s is a docs route', async route => {
    const {status} = await runCli(['docs', route, '--index']);
    expect(status).toBe(0);
  });

  it.each(['share', 'single file', 'static html', 'artifact', 'snapshot'])(
    'a search for "%s" returns a shareable-page guide first',
    async query => {
      const [first] = await docs(query);
      expect(GUIDES.has(first.name)).toBe(true);
    },
  );

  it('a shareable-page hit opens the guide on its experimental route', async () => {
    const [first] = await docs('single file');
    expect(first.command).toMatch(
      /docs cli\/experimental\/(share-a-page|render-pages)/,
    );
  });

  it('every other experimental doc stays out', async () => {
    for (const query of ['icon set', 'theme editor', 'experimental', 'share']) {
      for (const result of await docs(query)) {
        if (GUIDES.has(result.name)) continue;
        expect(result.name).not.toMatch(/experimental/);
        expect(result.command).not.toMatch(/experimental/);
      }
    }
  });
});
