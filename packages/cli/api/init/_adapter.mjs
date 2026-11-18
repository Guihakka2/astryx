// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file Environment adapter for init: for `init --user`, the home folder, the
 * settings file, the per-user state, and the search path (spec AST-081 FR7,
 * FR8); for the getting-started steps, the project's install command
 * (architecture:cli-surface INV21).
 *
 * @input  the home folder, the settings file, the search path
 * @output the computer-level agent text written or removed, with the setting
 *   and the links recorded
 * @position packages/cli/api/init — imported by the user and run leaves
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  COMPUTER_COMMAND,
  COMPUTER_INSTALL_STEP,
  astryxOnSearchPath,
  computerAgentCommand,
  displayHomePath,
  removeComputerAgentText,
  writeComputerAgentText,
} from '../../foundation/agent-docs/computer-agent-text.mjs';
import {
  computerAgentTextSettings,
  recordComputerAgentTextSettings,
} from '../../foundation/env/user-settings.mjs';
import {recordAgentTextWritten} from '../../foundation/release/global-state.mjs';
import {cliVersion} from '../../foundation/release/run-context.mjs';
import {installStepFor} from '../../foundation/discovery/template-needs.mjs';
import {writeFailed} from '../error.mjs';
export {STARTER_THEME} from '../../foundation/discovery/theme-discovery.mjs';

export {COMPUTER_COMMAND, COMPUTER_INSTALL_STEP, displayHomePath};

// What the run leaf reads before it writes agent docs: the state of the files
// it is about to write.
export {
  inspectAgentDocs,
  resolveAgentPaths,
} from '../../foundation/agent-docs/agent-docs.mjs';

/**
 * Write or refresh the computer-level agent text, or remove it, and record
 * the setting and the links Astryx made; after a write, record the release
 * that wrote it.
 * @param {{remove: boolean}} options
 * @returns {{home: string, command: string, files: import('./init.type.mjs').InitUserFile[], cliOnSearchPath: boolean}}
 */
export function applyComputerAgentText({remove}) {
  const home = os.homedir();
  const command = computerAgentCommand();
  const recorded = computerAgentTextSettings().links;
  /** @type {import('./init.type.mjs').InitUserFile[]} */
  let files;
  try {
    if (remove) {
      files = removeComputerAgentText({home, links: recorded});
      recordComputerAgentTextSettings({install: false, links: []});
    } else {
      const written = writeComputerAgentText({home, command});
      files = written.rows;
      recordComputerAgentTextSettings({
        install: true,
        links: [...new Set([...recorded, ...written.links])],
      });
      recordAgentTextWritten(cliVersion());
    }
  } catch (err) {
    throw computerTextFailed(err, home, remove);
  }
  return {home, command, files, cliOnSearchPath: astryxOnSearchPath()};
}

/**
 * The nearest existing folder above `at`: where a refused recursive write
 * stopped, since the error names the path it was asked for.
 * @param {string} at
 * @returns {string}
 */
function nearestFolder(at) {
  let dir = path.dirname(at);
  while (!fs.existsSync(dir)) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

/**
 * The error for a computer-level agent text write or removal the file system
 * refused, as a read-only `~/.agents/skills`: the path, the errno, what had
 * already changed, and the step that fixes that errno. Any other error
 * passes through unchanged.
 * @param {unknown} err
 * @param {string} home
 * @param {boolean} remove
 * @returns {unknown}
 */
function computerTextFailed(err, home, remove) {
  const {code, path: at, removed} = /** @type {{code?: unknown, path?: unknown, removed?: string[]}} */ (
    err ?? {}
  );
  if (typeof code !== 'string' || typeof at !== 'string') return err;
  const again = remove ? 'astryx init --user --remove-agents' : 'astryx init --user';
  /** @type {Record<string, string>} */
  const nextFor = {
    EACCES: `Give yourself write access to ${displayHomePath(nearestFolder(at), home)}, then run \`${again}\` again.`,
    EPERM: `Give yourself write access to ${displayHomePath(nearestFolder(at), home)}, then run \`${again}\` again.`,
    EROFS: `That folder is on a read-only file system; run \`${again}\` where your home folder can be written.`,
    ENOTDIR: `A file stands where a folder belongs on that path (such as ~/.agents being a file); move it aside, then run \`${again}\` again.`,
  };
  const next = nextFor[code];
  if (!next) return err;
  const done = (removed ?? []).map(file => displayHomePath(file, home));
  return writeFailed(at, home, err, [], {
    shown: `the computer-level agent text at ${displayHomePath(at, home)}`,
    what: remove ? 'remove' : 'write',
    outcome: remove
      ? done.length > 0
        ? `Already removed: ${done.join(', ')}.`
        : 'Nothing was removed.'
      : 'Nothing was written.',
    next,
  });
}

/**
 * The install step to print for `packages` in the project at `cwd`: the
 * install guidance its integrations give, else its package manager's command,
 * or `npm install` with a note when its lockfiles disagree.
 * @param {string[]} packages
 * @param {string} cwd
 * @returns {{line: string, note: string | null}}
 */
export function projectInstallStep(packages, cwd) {
  return installStepFor(packages, cwd);
}
