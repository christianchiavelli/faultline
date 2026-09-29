import { Service, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';

const PRODUCT = 'Faultline';

/**
 * One format for every tab: the page, then the product, and the product alone
 * on the home page. The page comes first so it survives when a crowded tab
 * strip cuts the end off.
 */
export function pageTitle(page?: string | null): string {
  return page ? `${page} | ${PRODUCT}` : PRODUCT;
}

/**
 * Formats the active route's `title`. A page whose title depends on its data,
 * such as an event, sets it through `pageTitle()` once the data has loaded.
 */
@Service({ autoProvided: false })
export class PageTitleStrategy extends TitleStrategy {
  readonly #title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.#title.setTitle(pageTitle(this.buildTitle(snapshot)));
  }
}
