import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { ATTACHMENT, asBaseline, readBaseline, summary, type PageResult } from './report';

/**
 * Gathers each page's result into one report: a table at the end of the run,
 * the same in the run's summary on GitHub, and `vitals-report/web-vitals.json`,
 * the measurement as a baseline, for `pnpm vitals:accept` to take.
 */
export default class WebVitalsReporter implements Reporter {
  readonly #pages: PageResult[] = [];

  onTestEnd(_test: TestCase, result: TestResult): void {
    const attachment = result.attachments.find(({ name }) => name === ATTACHMENT);
    if (attachment?.body) this.#pages.push(JSON.parse(attachment.body.toString('utf8')));
  }

  async onEnd(): Promise<void> {
    if (!this.#pages.length) return;
    const report = summary(this.#pages, readBaseline());
    console.log(`\n${report}`);

    await mkdir('vitals-report', { recursive: true });
    await writeFile(
      'vitals-report/web-vitals.json',
      `${JSON.stringify(asBaseline(this.#pages), null, 2)}\n`,
    );
    const github = process.env['GITHUB_STEP_SUMMARY'];
    if (github) await appendFile(github, report);
  }
}
