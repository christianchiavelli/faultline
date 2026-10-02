/**
 * Accepts the Web Vitals that CI runs measured as the new baseline: each
 * metric's median across the runs goes into `e2e/vitals/baseline.json`,
 * which every later run is held against, and into the README's table.
 *
 *   pnpm vitals:accept              the latest finished run on main
 *   pnpm vitals:accept <id> <id>…   the median of those runs
 *
 * The numbers come from the CI's runners, never from this machine: a baseline
 * is only worth what the machine measuring against it has in common with the
 * ones that set it. GitHub's runners are not all alike, so a baseline taken
 * from several runs leans on none of them. Needs the GitHub CLI, signed in.
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { format as prettier, resolveConfig } from 'prettier';
import { mergeBaselines, readmeTable, type Baseline } from '../e2e/vitals/report.ts';

const BASELINE = new URL('../e2e/vitals/baseline.json', import.meta.url);
const README = new URL('../README.md', import.meta.url);
const TABLE = /(<!-- web-vitals -->\n)[\s\S]*?(\n<!-- \/web-vitals -->)/;

const gh = (...args: string[]) => execFileSync('gh', args, { encoding: 'utf8' }).trim();

const runs = process.argv.slice(2);
if (!runs.length) {
  runs.push(
    gh(
      ...['run', 'list', '--workflow', 'ci.yml', '--branch', 'main', '--status', 'completed'],
      ...['--limit', '1', '--json', 'databaseId', '--jq', '.[0].databaseId'],
    ),
  );
}
const repository = gh('repo', 'view', '--json', 'url', '--jq', '.url');

const dir = await mkdtemp(join(tmpdir(), 'web-vitals-'));
try {
  const measurements: Baseline[] = [];
  for (const run of runs) {
    gh('run', 'download', run, '--name', 'web-vitals', '--dir', join(dir, run));
    measurements.push(JSON.parse(await readFile(join(dir, run, 'web-vitals.json'), 'utf8')));
  }
  const baseline = mergeBaselines(
    measurements,
    runs.map((run) => `${repository}/actions/runs/${run}`),
  );

  const write = async (file: URL, text: string) =>
    writeFile(
      file,
      await prettier(text, { ...(await resolveConfig(file)), filepath: file.pathname }),
    );
  await write(BASELINE, JSON.stringify(baseline, null, 2));

  const readme = await readFile(README, 'utf8');
  if (!TABLE.test(readme)) throw new Error('README.md has no <!-- web-vitals --> table to write');
  await write(README, readme.replace(TABLE, `$1${readmeTable(baseline)}$2`));

  console.log(`Accepted the Web Vitals of ${runs.length} run(s): ${runs.join(', ')}.`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
