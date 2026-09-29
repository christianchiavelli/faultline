import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PageTitleStrategy } from './page-title';

@Component({ template: '' })
class Blank {}

describe('PageTitleStrategy', () => {
  it('puts the page before the product, and the product alone on the home page', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Blank },
          { path: 'missing', title: 'Page not found', component: Blank },
        ]),
        { provide: TitleStrategy, useClass: PageTitleStrategy },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const title = TestBed.inject(Title);

    await harness.navigateByUrl('/missing');
    expect(title.getTitle()).toBe('Page not found | Faultline');

    await harness.navigateByUrl('/');
    expect(title.getTitle()).toBe('Faultline');
  });
});
