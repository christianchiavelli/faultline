import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Skeleton } from './skeleton';

@Component({
  imports: [Skeleton],
  template: `<p class="lede"><ui-skeleton /><ui-skeleton width="64%" /></p>`,
})
class Waiting {}

describe('Skeleton', () => {
  it('takes the line it stands in for, as much of it as the text will', async () => {
    const fixture = TestBed.createComponent(Waiting);
    await fixture.whenStable();
    const [whole, short] = fixture.nativeElement.querySelectorAll('ui-skeleton');

    expect(whole.style.width).toBe('100%');
    expect(short.style.width).toBe('64%');
  });

  it("stays out of a screen reader's way: the page says what it is waiting for", async () => {
    const fixture = TestBed.createComponent(Waiting);
    await fixture.whenStable();

    for (const line of fixture.nativeElement.querySelectorAll('ui-skeleton')) {
      expect(line.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
