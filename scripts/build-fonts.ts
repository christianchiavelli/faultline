/**
 * Self-hosts the two typefaces and writes everything the browser needs to
 * paint text before they arrive, into the head of `src/index.html`:
 *
 * - `public/fonts/*.woff2`, content-hashed, so the server can cache them for a
 *   year like the rest of the fingerprinted build output
 * - the @font-face rules, inline: in the stylesheet, which loads after the
 *   first paint, the fallbacks below would arrive after the text they are for
 * - metric-matched fallbacks: local typefaces stretched by Capsize to the
 *   ascent, descent and average width of Archivo and Martian Mono, so the swap
 *   moves nothing
 * - the preload links, for the Latin files only
 *
 *   pnpm fonts
 *
 * Fontsource is the source of the files, pinned in devDependencies; nothing of
 * it ships except the woff2 copied here. Chromium measures how narrow each
 * font gets at the stretches the app sets, which Capsize does not.
 */
import { createFontStack } from '@capsizecss/core';
import { entireMetricsCollection as metrics } from '@capsizecss/metrics/entireMetricsCollection';
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';

const ROOT = new URL('../', import.meta.url);
const PUBLIC_FONTS = new URL('public/fonts/', ROOT);
const INDEX_HTML = new URL('src/index.html', ROOT);

type Metrics = Parameters<typeof createFontStack>[0][number];

interface Family {
  readonly name: string;
  readonly fontsource: string;
  readonly weight: string;
  readonly stretch: string;
}

const FAMILIES: readonly Family[] = [
  { name: 'Archivo', fontsource: 'archivo', weight: '100 900', stretch: '62% 125%' },
  { name: 'Martian Mono', fontsource: 'martian-mono', weight: '100 800', stretch: '75% 112.5%' },
];

/** Latin is preloaded; Latin Extended loads on demand, for names such as Pāhala. */
const SUBSETS = ['latin', 'latin-ext'] as const;

const { archivo, arial, roboto, martianMono, courierNew } = metrics;

/**
 * A web font's metrics at a weight, and at a stretch that keeps `width` of
 * its normal width. Capsize measured each whole hundred of weight at normal
 * width; a variable font moves smoothly between them.
 */
function at(font: typeof archivo, weight: number, width = 1): Metrics {
  const average = (w: number) => (font.variants[w] ?? font).subsets.latin.xWidthAvg;
  const below = Math.floor(weight / 100) * 100;
  const xWidthAvg =
    width * (average(below) + ((average(below + 100) - average(below)) * (weight - below)) / 100);
  // Capsize reads the width of the subset asked for, Latin, before the face's own.
  return { ...font, xWidthAvg, subsets: { ...font.subsets, latin: { xWidthAvg } } };
}

interface Face {
  /** The weights it stands in for: the app never synthesises bold (`font-synthesis: none`). */
  readonly weight?: string;
  /** The stretches it stands in for, normal when left out. */
  readonly stretch?: string;
  /** The web font's metrics where the face is matched. */
  readonly font: Metrics;
  /** The local typeface drawn instead, and the names a browser may know it by. */
  readonly local: Metrics;
  readonly names: readonly string[];
}

const ARIAL = ['Arial', 'ArialMT', 'Liberation Sans', 'LiberationSans'];
const ARIAL_BOLD = ['Arial Bold', 'Arial-BoldMT', 'Liberation Sans Bold', 'LiberationSans-Bold'];
const ROBOTO = ['Roboto', 'Roboto-Regular'];
const ROBOTO_BOLD = ['Roboto Bold', 'Roboto-Bold'];
// Liberation Mono is drawn to Courier New's widths, and Droid Sans Mono, Android's, has its advance.
const COURIER = [
  ...['Courier New', 'CourierNewPSMT', 'Liberation Mono', 'LiberationMono'],
  ...['Droid Sans Mono', 'DroidSansMono'],
];

/**
 * The fallbacks, a family for each kind of system, each face reshaped to the
 * web font where it stands in. Arial is on Windows and Apple's systems, and
 * Liberation Sans, drawn to Arial's widths, on Linux; Android has neither, and
 * Roboto instead. A family whose local fonts are all missing is skipped for
 * the next one in `--font-sans`. Bold is matched twice: at 600, the weight
 * of buttons and labels, and at 680, the headings', where a line that wraps
 * differently moves the most. The condensed labels are matched at 620, the
 * wordmark expanded at 760, and Martian Mono at the two stretches it is set in.
 */
function fallbacks(widthAt: (family: string, weight: number, stretch: number) => number) {
  const labels = widthAt('Archivo', 620, 72);
  const wordmark = widthAt('Archivo', 760, 118);
  const sans = (local: Metrics, bold: Metrics, names: string[], boldNames: string[]) => [
    { weight: '100 549', font: at(archivo, 400), local, names },
    { weight: '550 639', font: at(archivo, 600), local: bold, names: boldNames },
    { weight: '640 1000', font: at(archivo, 680), local: bold, names: boldNames },
    // Every condensed label is semibold.
    { stretch: '50% 90%', font: at(archivo, 620, labels), local: bold, names: boldNames },
    { stretch: '110% 200%', font: at(archivo, 760, wordmark), local: bold, names: boldNames },
  ];
  const mono = (stretch: string | undefined, width: number): Face => ({
    ...(stretch ? { stretch } : {}),
    font: at(martianMono, 400, width),
    local: courierNew,
    names: COURIER,
  });
  return {
    'Archivo Fallback': sans(arial, arial.variants[700], ARIAL, ARIAL_BOLD),
    'Archivo Fallback Roboto': sans(roboto, roboto.variants[700], ROBOTO, ROBOTO_BOLD),
    // Monospaced at every weight, so one face for each width.
    'Martian Mono Fallback': [
      mono(undefined, 1),
      mono('84% 95%', widthAt('Martian Mono', 400, 87.5)),
      mono('50% 83%', widthAt('Martian Mono', 400, 80)),
    ],
  } satisfies Record<string, readonly Face[]>;
}

function fallbackFace(family: string, { weight, stretch, font, local, names }: Face): string {
  const { fontFaces } = createFontStack([font, local], { fontFaceFormat: 'styleObject' });
  const { ascentOverride, descentOverride, lineGapOverride, sizeAdjust } =
    fontFaces[0]!['@font-face'];
  const properties = {
    'font-family': `'${family}'`,
    src: names.map((name) => `local('${name}')`).join(', '),
    'font-weight': weight,
    'font-stretch': stretch,
    'ascent-override': ascentOverride,
    'descent-override': descentOverride,
    // Capsize leaves it out where neither font has a gap between lines.
    'line-gap-override': lineGapOverride,
    'size-adjust': sizeAdjust,
  };
  const declarations = Object.entries(properties).filter(([, value]) => value !== undefined);
  return `@font-face {\n${declarations.map(([name, value]) => `  ${name}: ${value};`).join('\n')}\n}`;
}

/**
 * How much of its normal width each web font has at a stretch, as Chromium
 * lays out a line in it. A width axis names a width rather than measuring
 * one: Archivo at 72% keeps about 76% of its normal width.
 */
async function measureWidths(
  files: ReadonlyMap<string, Buffer>,
): Promise<(family: string, weight: number, stretch: number) => number> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const faces = FAMILIES.map(
      ({ name, weight, stretch }) =>
        `@font-face { font-family: '${name}'; font-weight: ${weight}; font-stretch: ${stretch};` +
        ` src: url(data:font/woff2;base64,${files.get(name)!.toString('base64')}); }`,
    );
    await page.setContent(
      `<style>${faces.join('\n')} span { font-size: 100px; white-space: nowrap; }</style><span></span>`,
    );
    await page.evaluate(
      (names) => Promise.all(names.map((name) => document.fonts.load(`100px '${name}'`))),
      FAMILIES.map(({ name }) => name),
    );
    const widths = new Map<string, number>();
    for (const { name } of FAMILIES) {
      for (const weight of [400, 620, 760]) {
        for (const stretch of [72, 80, 87.5, 100, 118]) {
          const width = await page.evaluate(
            ({ name, weight, stretch }) => {
              const span = document.querySelector('span')!;
              Object.assign(span.style, {
                fontFamily: `'${name}'`,
                fontWeight: String(weight),
                fontStretch: `${stretch}%`,
              });
              span.textContent = 'Magnitude 5.8 Mww, 165 km SSE of Vilyuchinsk · REVIEWED';
              return span.getBoundingClientRect().width;
            },
            { name, weight, stretch },
          );
          widths.set(`${name} ${weight} ${stretch}`, width);
        }
      }
    }
    return (family, weight, stretch) =>
      widths.get(`${family} ${weight} ${stretch}`)! / widths.get(`${family} ${weight} 100`)!;
  } finally {
    await browser.close();
  }
}

function unicodeRange(css: string, file: string): string {
  const block = css.split('@font-face').find((rule) => rule.includes(file));
  const range = block?.match(/unicode-range:\s*([^;]+);/)?.[1];
  if (!range) throw new Error(`No unicode-range for ${file}`);
  return range.trim();
}

async function copyHashed(source: URL, stem: string): Promise<{ name: string; bytes: Buffer }> {
  const bytes = await readFile(source);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8).toUpperCase();
  const name = `${stem}-${hash}.woff2`;
  await writeFile(new URL(name, PUBLIC_FONTS), bytes);
  return { name, bytes };
}

await mkdir(PUBLIC_FONTS, { recursive: true });
for (const stale of await readdir(PUBLIC_FONTS)) {
  if (stale.endsWith('.woff2')) await rm(new URL(stale, PUBLIC_FONTS));
}

const faces: string[] = [];
const preloads: string[] = [];
const latin = new Map<string, Buffer>();

for (const family of FAMILIES) {
  const packageRoot = new URL(`node_modules/@fontsource-variable/${family.fontsource}/`, ROOT);
  const css = await readFile(new URL('standard.css', packageRoot), 'utf8');

  for (const subset of SUBSETS) {
    const file = `${family.fontsource}-${subset}-standard-normal.woff2`;
    const { name, bytes } = await copyHashed(
      new URL(`files/${file}`, packageRoot),
      `${family.fontsource}-${subset}`,
    );
    faces.push(`@font-face {
  font-family: '${family.name}';
  font-style: normal;
  font-display: swap;
  font-weight: ${family.weight};
  font-stretch: ${family.stretch};
  src: url('/fonts/${name}') format('woff2');
  unicode-range: ${unicodeRange(css, file)};
}`);
    if (subset === 'latin') {
      latin.set(family.name, bytes);
      preloads.push(
        `<link rel="preload" href="/fonts/${name}" as="font" type="font/woff2" crossorigin />`,
      );
    }
  }
}

const reshaped = Object.entries(fallbacks(await measureWidths(latin))).flatMap(([family, list]) =>
  list.map((face) => fallbackFace(family, face)),
);

const style = [
  '<style>',
  '/* Generated by scripts/build-fonts.ts (pnpm fonts). Do not edit by hand. */',
  ...faces,
  '/* Local fonts reshaped to the metrics of the ones above, so the swap moves no text. */',
  ...reshaped,
  '</style>',
].join('\n');

const html = await readFile(INDEX_HTML, 'utf8');
const block = /( *<!-- fonts:start -->\n)[\s\S]*?( *<!-- fonts:end -->)/;
if (!block.test(html)) throw new Error('src/index.html has no <!-- fonts:start/end --> markers');
const written = html.replace(block, `$1${[...preloads, style].join('\n')}\n$2`);
await writeFile(
  INDEX_HTML,
  await format(written, { ...(await resolveConfig(INDEX_HTML)), filepath: INDEX_HTML.pathname }),
);

console.log(
  `Wrote ${faces.length} faces, ${reshaped.length} fallbacks, ${preloads.length} preloads`,
);
