import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { arrival } from './arrival';

@Component({ template: '' })
class Page {
  readonly content = signal<string | null>(null);
  readonly arriving = arrival(this.content);
}

async function render(content: string | null) {
  const fixture = TestBed.createComponent(Page);
  fixture.componentInstance.content.set(content);
  await fixture.whenStable();
  const page = fixture.componentInstance;
  return {
    page,
    async set(next: string | null) {
      page.content.set(next);
      await fixture.whenStable();
    },
  };
}

describe('arrival', () => {
  it('leaves alone what was there at the first render, as the server drew it', async () => {
    const { page } = await render('drawn on the server');

    expect(page.arriving()).toBe('');
  });

  it('brings in what the browser had to wait for', async () => {
    const { page, set } = await render(null);
    await set('fetched');

    expect(page.arriving()).toBe('arrival');
  });

  it('brings in what comes back after it went, though it was there at first', async () => {
    const { page, set } = await render('drawn on the server');
    await set(null);
    await set('fetched again');

    expect(page.arriving()).toBe('arrival');
  });
});
