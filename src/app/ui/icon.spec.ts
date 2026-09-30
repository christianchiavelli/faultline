import { TestBed } from '@angular/core/testing';
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import { Icon } from './icon';

function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(Icon);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture.nativeElement.querySelector('svg') as SVGSVGElement;
}

describe('Icon', () => {
  it('draws the Font Awesome path in its own coordinate box', () => {
    const svg = render({ name: 'download' });
    const [width, height, , , path] = faDownload.icon;

    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${width} ${height}`);
    expect(svg.querySelector('path')?.getAttribute('d')).toBe(path);
  });

  it('stays out of the accessibility tree next to a word that already says it', () => {
    const svg = render({ name: 'download' });

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
  });

  it('is announced as an image when it stands alone with a label', () => {
    const svg = render({ name: 'xmark', label: 'Close' });

    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Close');
    expect(svg.getAttribute('aria-hidden')).toBeNull();
  });
});
