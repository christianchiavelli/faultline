import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Dialog } from './dialog';
import { polyfillDialog } from './testing/dialog-polyfill';

@Component({
  imports: [Dialog],
  template: `
    <ui-dialog
      [(open)]="open"
      heading="Export events"
      eyebrow="USGS catalogue"
      lede="A file for a spreadsheet."
    >
      <p>Body</p>
      <button uiDialogFooter type="button">Download</button>
    </ui-dialog>
  `,
})
class Host {
  readonly open = signal(false);
}

@Component({
  imports: [Dialog],
  template: `<ui-dialog heading="Filters" [sheet]="true"><p>Body</p></ui-dialog>`,
})
class Sheet {}

function render() {
  polyfillDialog();
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    dialog: element.querySelector('dialog')!,
  };
}

/** A pointer going down on one element and the click it ends in reaching another. */
function press(down: Element, click: Element) {
  down.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  click.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('Dialog', () => {
  it('opens as a modal when its model says so, named by its heading', async () => {
    const { fixture, host, dialog } = render();
    expect(dialog.open).toBe(false);

    host.open.set(true);
    await fixture.whenStable();

    expect(dialog.open).toBe(true);
    const heading = dialog.querySelector('h2')!;
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(heading.textContent).toBe('Export events');
    expect(dialog.querySelector('.foot')?.textContent).toContain('Download');
  });

  it('is a centred dialog unless asked to be a sheet', () => {
    expect(render().dialog.classList).not.toContain('dialog--sheet');

    TestBed.resetTestingModule();
    const sheet = TestBed.createComponent(Sheet);
    sheet.detectChanges();

    expect((sheet.nativeElement as HTMLElement).querySelector('dialog')?.classList).toContain(
      'dialog--sheet',
    );
  });

  it('is described by its lede, which is read out with its name', () => {
    const { dialog } = render();

    const lede = dialog.querySelector('.lede')!;
    expect(dialog.getAttribute('aria-describedby')).toBe(lede.id);
    expect(lede.textContent).toBe('A file for a spreadsheet.');
  });

  it('closes from its close button and tells the model', async () => {
    const { fixture, host, dialog } = render();
    host.open.set(true);
    await fixture.whenStable();

    dialog.querySelector<HTMLButtonElement>('button.close')!.click();
    await fixture.whenStable();

    expect(host.open()).toBe(false);
    expect(dialog.open).toBe(false);
  });

  it('keeps the model in step when the browser closes it, as Escape does', async () => {
    const { fixture, host, dialog } = render();
    host.open.set(true);
    await fixture.whenStable();

    dialog.close();
    await fixture.whenStable();

    expect(host.open()).toBe(false);
  });

  it('closes on a press on the backdrop, where the browser does not', async () => {
    const { fixture, host, dialog } = render();
    host.open.set(true);
    await fixture.whenStable();

    press(dialog.querySelector('p')!, dialog.querySelector('p')!);
    expect(host.open()).toBe(true);

    press(dialog, dialog);
    expect(host.open()).toBe(false);
  });

  it('stays open when a selection is dragged out onto the backdrop', async () => {
    const { fixture, host, dialog } = render();
    host.open.set(true);
    await fixture.whenStable();

    // The click lands on the nearest element holding both ends: the dialog.
    press(dialog.querySelector('p')!, dialog);

    expect(host.open()).toBe(true);
  });
});
