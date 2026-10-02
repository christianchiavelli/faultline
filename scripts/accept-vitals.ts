/**
 * Accepts the Web Vitals a CI run measured as the new baseline: writes them
 * to `e2e/vitals/baseline.json`, which every later run is held against, and
 * into the README's table.
 *
 *   pnpm vitals:accept        the latest finished run on main
 *   pnpm vitals:accept <id>   that run
 *
 * The numbers come from the CI's runner, never from this machine: a baseline
 * is only worth what the machine that measures against it has in common with
 * the one that set it. Needs the GitHub CLI, signed in.
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { format as prettier, resolveConfig } from 'prettier';
import { readmeTable, type Baseline } from '../e2e/vitals/report.ts';

const BASELINE = new URL('../e2e/vitals/baseline.json', import.meta.url);
const README = new URL('../README.md', import.meta.url);
const TABLE = /(<!-- web-vitals -->\n)[\s\S]*?(\n<!-- \/web-vitals -->)/;

const gh = (...args: string[]) => execFileSync('gh', args, { encoding: 'utf8' }).trim();

const run =
  process.argv[2] ??
  gh(
    ...['run', 'list', '--workflow', 'ci.yml', '--branch', 'main', '--status', 'completed'],
    ...['--limit', '1', '--json', 'databaseId', '--jq', '.[0].databaseId'],
  );
const dir = await mkdtemp(join(tmpdir(), 'web-vitals-'));
try {
  gh('run', 'download', run, '--name', 'web-vitals', '--dir', dir);
  const measured = JSON.parse(await readFile(join(dir, 'web-vitals.json'), 'utf8')) as Baseline;

  const write = async (file: URL, text: string) =>
    writeFile(
      file,
      await prettier(text, { ...(await resolveConfig(file)), filepath: file.pathname }),
    );
  await write(BASELINE, JSON.stringify(measured));

  const readme = await readFile(README, 'utf8');
  if (!TABLE.test(readme)) throw new Error('README.md has no <!-- web-vitals --> table to write');
  await write(README, readme.replace(TABLE, `$1${readmeTable(measured)}$2`));

  console.log(`Accepted the Web Vitals of run ${run}, measured on ${measured.measured}.`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
