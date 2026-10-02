import { formatNumber } from '@angular/common';

/**
 * A number set for a reader in the page's language: "5.1" in English, "5,1"
 * in Portuguese, thousands grouped the way each groups them. `digits` is
 * Angular's `minInteger.minFraction-maxFraction`, as `DecimalPipe` takes it.
 * A negative value takes a true minus, a digit wide, instead of a hyphen.
 *
 * Angular's own locale data, not `Intl`, so the server and the browser set a
 * number alike, whatever version of ICU each was built with.
 */
export function formatDecimal(value: number, locale: string, digits?: string): string {
  return formatNumber(value, locale, digits).replace('-', '−');
}
