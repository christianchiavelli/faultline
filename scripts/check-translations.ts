/**
 * Checks the Portuguese translation against the messages the app has now, as
 * `ng extract-i18n` has just written them to `src/locale/messages.xlf`:
 *
 * - every message has a unit in `messages.pt-BR.xlf`, with a target that is
 *   not empty: the build would fail on it otherwise, later and less clearly
 * - no unit there is for a message the app no longer has, which happens each
 *   time an English text changes, since a message's id is its text
 *
 *   pnpm i18n
 *
 * A message's id is the hash of its text and meaning, so a unit of the same id
 * holds the same English: the check is on ids alone.
 */
import { readFile } from 'node:fs/promises';

const LOCALE = new URL('../src/locale/', import.meta.url);
const UNIT = /<trans-unit id="([^"]+)"[^>]*>([\s\S]*?)<\/trans-unit>/g;

async function units(file: string): Promise<Map<string, string>> {
  const xliff = await readFile(new URL(file, LOCALE), 'utf8');
  return new Map([...xliff.matchAll(UNIT)].map(([, id, body]) => [id!, body!]));
}

const source = await units('messages.xlf');
const portuguese = await units('messages.pt-BR.xlf');

const untranslated = [...source.keys()].filter((id) => {
  const target = /<target[^>]*>([\s\S]*?)<\/target>/.exec(portuguese.get(id) ?? '');
  return !target?.[1]?.trim();
});
const stale = [...portuguese.keys()].filter((id) => !source.has(id));

const english = (id: string) =>
  /<source>([\s\S]*?)<\/source>/.exec(source.get(id) ?? '')?.[1]?.trim() ?? '';

for (const id of untranslated) console.error(`To translate, ${id}: ${english(id)}`);
for (const id of stale)
  console.error(`No longer in the app, ${id}: remove it from messages.pt-BR.xlf`);

if (untranslated.length || stale.length) {
  process.exitCode = 1;
} else {
  console.log(`All ${source.size} messages translated into Portuguese.`);
}
