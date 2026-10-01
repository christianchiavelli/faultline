import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Popover } from './popover';
import { isOpen, polyfillPopover } from './testing/popover-polyfill';

@Component({
  imports: [Popover],
  template: `
    <ui-popover #menu label="Theme: Paper" heading="Theme">
      <span uiPopoverTrigger>◐</span>
      <button type="button" class="choice" (click)="menu.close()">Film</button>
    </ui-popover>
    <ui-popover label="Units" heading="Units"><span uiPopoverTrigger>km</span></ui-popover>
  `,
})
class Host {}

function render() {
  polyfillPopover();
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Popover', () => {
  it('opens its panel from a button named by its label, the panel named by its heading', () => {
    const element = render();
    const trigger = element.querySelector('button.trigger')!;
    const panel = element.querySelector('[popover]')!;

    expect(trigger.getAttribute('popovertarget')).toBe(panel.id);
    expect(trigger.getAttribute('aria-label')).toBe('Theme: Paper');
    expect(trigger.textContent).toContain('◐');
    expect(panel.getAttribute('role')).toBe('group');
    expect(element.querySelector(`#${panel.getAttribute('aria-labelledby')}`)?.textContent).toBe(
      'Theme',
    );
  });

  it('hangs each panel from its own button', () => {
    const anchors = [...render().querySelectorAll<HTMLElement>('ui-popover')].map((host) =>
      host.style.getPropertyValue('--anchor'),
    );

    expect(anchors).toHaveLength(2);
    expect(new Set(anchors).size).toBe(2);
    expect(anchors.every((name) => name.startsWith('--ui-popover-'))).toBe(true);
  });

  it('closes behind a choice made inside it', () => {
    const panel = render().querySelector<HTMLElement>('[popover]')!;
    panel.showPopover();

    panel.querySelector<HTMLButtonElement>('.choice')!.click();

    expect(isOpen(panel)).toBe(false);
  });
});
