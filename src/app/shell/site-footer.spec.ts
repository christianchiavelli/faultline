import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SiteFooter } from './site-footer';

describe('SiteFooter', () => {
  const note = (locale: string) => {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: locale }] });
    const fixture = TestBed.createComponent(SiteFooter);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  };

  it('says why the place names stay English on a page in another language', () => {
    expect(note('pt-BR')).toContain('Place names are the USGS catalogue');
  });

  it('says nothing of the kind on an English page', () => {
    expect(note('en-GB')).not.toContain('Place names are the USGS catalogue');
  });
});
