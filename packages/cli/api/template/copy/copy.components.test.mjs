// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file The template.copy receipt's `components` and the template.show
 * response's `componentsToRead`: the components the source uses that
 * `astryx component` answers in the project, in source order, each once. The
 * text names them in one `component` call: after the copy line, and on stderr
 * for a printed template.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {requireNatively} from '../../../test-utils/native-require.mjs';
import {REPO_ROOT} from '../../../test-utils/repo-root.mjs';

const require = requireNatively(import.meta.url);
/** @type {typeof import('../template.mjs')} */
const {template} = require('../template.mjs');
/** @type {typeof import('../../component/component.mjs')} */
const {component} = require('../../component/component.mjs');
/** @type {typeof import('../../../foundation/discovery/template-adapter.mjs')} */
const {
  catalogComponentsInSource,
  componentsInSource,
} = require('../../../foundation/discovery/template-adapter.mjs');
/** @type {typeof import('../../../test-utils/run-cli.mjs')} */
const {runCli} = require('../../../test-utils/run-cli.mjs');

const SLOW = 60_000;
const READ_LINE =
  /^Read the components it uses in one call: `(.+) component (.+)`$/m;

/** A source that renders Core, integration, chart-library and local tags. */
const MIXED_SOURCE = `import {Card} from '@astryxdesign/core/Card';
import {Badge as StatusBadge} from '@astryxdesign/core/Badge';
import {AcmeBadge} from '@acme/widgets/AcmeBadge';
import {Tooltip, XAxis} from 'recharts';
import {Widget} from './Widget';

function LocalHelper() {
  return <Tooltip><XAxis /></Tooltip>;
}

export default function Page() {
  return (
    <Card>
      <AcmeBadge />
      <StatusBadge />
      <LocalHelper />
      <Widget />
      <Card />
    </Card>
  );
}
`;

/** A source that renders nothing `astryx component` answers. */
const EMPTY_SOURCE = `import {Tooltip} from 'recharts';

export default function Page() {
  return <Tooltip />;
}
`;

/** @type {string} */
let tmpDir;
/** @type {string} */
let originalCwd;

/**
 * A consumer project with an `@acme/widgets` integration that ships one
 * component (`AcmeBadge`) and the given templates.
 * @param {Record<string, string>} templates id to page source
 */
function makeConsumer(templates) {
  const dir = fs.mkdtempSync(
    path.join(REPO_ROOT, '.astryx-template-components-'),
  );
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({name: 'consumer'}),
  );
  fs.writeFileSync(
    path.join(dir, 'astryx.config.mjs'),
    "export default {integrations: ['@acme/widgets']};\n",
  );
  const pkgDir = path.join(dir, 'node_modules', '@acme', 'widgets');
  fs.mkdirSync(path.join(pkgDir, 'src'), {recursive: true});
  fs.mkdirSync(path.join(pkgDir, 'templates'), {recursive: true});
  fs.writeFileSync(
    path.join(pkgDir, 'package.json'),
    JSON.stringify({
      name: '@acme/widgets',
      version: '1.0.0',
      exports: {'./AcmeBadge': './src/AcmeBadge.tsx'},
    }),
  );
  fs.writeFileSync(
    path.join(pkgDir, 'astryx.integration.mjs'),
    "export default {components: './src', templates: './templates'};\n",
  );
  fs.writeFileSync(
    path.join(pkgDir, 'src', 'AcmeBadge.tsx'),
    'export function AcmeBadge() { return null; }\n',
  );
  fs.writeFileSync(
    path.join(pkgDir, 'src', 'AcmeBadge.doc.mjs'),
    `export default ${JSON.stringify({
      type: 'component',
      name: 'AcmeBadge',
      displayName: 'Acme Badge',
      import: '@acme/widgets/AcmeBadge',
      usage: {description: 'A small status label.'},
      props: [],
    })};\n`,
  );
  for (const [id, source] of Object.entries(templates)) {
    fs.writeFileSync(
      path.join(pkgDir, 'templates', `${id}.doc.mjs`),
      `export default {type: 'page', name: '${id} name', description: '${id} desc'};\n`,
    );
    fs.writeFileSync(path.join(pkgDir, 'templates', `${id}.tsx`), source);
  }
  return dir;
}

beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = makeConsumer({
    'acme-mixed': MIXED_SOURCE,
    'acme-empty': EMPTY_SOURCE,
  });
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, {recursive: true, force: true});
});

describe('catalogComponentsInSource', () => {
  const catalog = new Map([
    ['Card', '@astryxdesign/core'],
    ['Badge', '@astryxdesign/core'],
    ['AcmeBadge', '@acme/widgets'],
    ['Tooltip', '@astryxdesign/core'],
    ['Widget', '@astryxdesign/core'],
  ]);

  it('keeps catalog names in source order, each once, and drops tags from other modules', () => {
    expect(catalogComponentsInSource(MIXED_SOURCE, catalog)).toEqual([
      'Card',
      'AcmeBadge',
      'Badge',
    ]);
  });

  it('drops a name the catalog does not hold', () => {
    expect(
      catalogComponentsInSource(
        MIXED_SOURCE,
        new Map([['Card', '@astryxdesign/core']]),
      ),
    ).toEqual(['Card']);
  });

  it('is empty without a catalog or without a catalog tag', () => {
    expect(catalogComponentsInSource(MIXED_SOURCE, new Map())).toEqual([]);
    expect(catalogComponentsInSource(EMPTY_SOURCE, catalog)).toEqual([]);
  });
});

describe('template.copy components', () => {
  it(
    'names the Core and integration components the file uses',
    async () => {
      const res = await template('acme-mixed', {
        targetPath: './out',
        cwd: tmpDir,
      });
      expect(res.type).toBe('template.copy');
      expect(res.data.components).toEqual(['Card', 'AcmeBadge', 'Badge']);
    },
    SLOW,
  );

  it(
    'is empty when the file uses no component the project answers',
    async () => {
      const res = await template('acme-empty', {
        targetPath: './out',
        cwd: tmpDir,
      });
      expect(res.data.components).toEqual([]);
    },
    SLOW,
  );

  it(
    'names only components `astryx component` answers for a Core template',
    async () => {
      const res = await template('dashboard', {
        targetPath: './out',
        cwd: tmpDir,
        package: '@astryxdesign/core',
      });
      const {components} = res.data;
      const written = fs.readFileSync(
        path.join(tmpDir, 'out', 'page.tsx'),
        'utf-8',
      );
      expect(components.length).toBeGreaterThan(0);
      expect(new Set(components).size).toBe(components.length);
      expect(componentsInSource(written)).toEqual(
        expect.arrayContaining(components),
      );
      // The chart library's parts are not Astryx components.
      for (const chartPart of ['XAxis', 'YAxis', 'Tooltip', 'LineChart']) {
        expect(components).not.toContain(chartPart);
      }
      const batch = await component(components, {cwd: tmpDir});
      expect(batch.data.results.map(r => r.status)).toEqual(
        components.map(() => 'found'),
      );
    },
    SLOW,
  );
});

describe('template.show componentsToRead', () => {
  it(
    'names the same components and leaves `components` as it was',
    async () => {
      const res = await template('acme-mixed', {cwd: tmpDir});
      expect(res.type).toBe('template.show');
      expect(res.data.componentsToRead).toEqual(['Card', 'AcmeBadge', 'Badge']);
      expect(res.data.components).toEqual(componentsInSource(res.data.source));
    },
    SLOW,
  );
});

describe('template text names the components in one call', () => {
  it(
    'prints the line right after the copy line',
    async () => {
      const out = await runCli(['template', 'acme-mixed', './a'], tmpDir);
      expect(out.status).toBe(0);
      const lines = out.stdout.split('\n').filter(Boolean);
      const copied = lines.findIndex(l => l.startsWith('Copied template to '));
      expect(copied).toBeGreaterThanOrEqual(0);
      const match = lines[copied + 1].match(READ_LINE);
      expect(match?.[2]).toBe('Card AcmeBadge Badge');
      expect(lines[copied + 1]).toMatch(/^[\x20-\x7e]+$/);
    },
    SLOW,
  );

  it(
    'prints the line to stderr for a printed template, and keeps stdout to the source',
    async () => {
      const out = await runCli(['template', 'acme-mixed'], tmpDir);
      expect(out.status).toBe(0);
      expect(out.stderr.match(READ_LINE)?.[2]).toBe('Card AcmeBadge Badge');
      expect(out.stdout).not.toMatch(READ_LINE);
    },
    SLOW,
  );

  it(
    'prints nothing when the list is empty',
    async () => {
      const copied = await runCli(['template', 'acme-empty', './b'], tmpDir);
      expect(copied.status).toBe(0);
      expect(copied.stdout).not.toContain('Read the components');
      const shown = await runCli(['template', 'acme-empty'], tmpDir);
      expect(shown.stderr).not.toContain('Read the components');
    },
    SLOW,
  );

  it(
    'carries the field in --json and no text line',
    async () => {
      const out = await runCli(
        ['template', 'acme-mixed', './c', '--json'],
        tmpDir,
      );
      expect(out.status).toBe(0);
      const {data} = JSON.parse(out.stdout);
      expect(data.components).toEqual(['Card', 'AcmeBadge', 'Badge']);
      expect(out.stderr).not.toContain('Read the components');
    },
    SLOW,
  );
});
