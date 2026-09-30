import { TestBed } from '@angular/core/testing';
import { Highlight, highlight } from './highlight';

const marked = (text: string, search: string) =>
  highlight(text, search)
    .map((part) => (part.hit ? `[${part.text}]` : part.text))
    .join('');

describe('highlight', () => {
  it('marks every word of the search, wherever it occurs and in any case', () => {
    expect(marked('2 km NNW of The Geysers, CA', 'geysers')).toBe('2 km NNW of The [Geysers], CA');
    expect(marked('Cobb, near Cobb Mountain', 'COBB')).toBe('[Cobb], near [Cobb] Mountain');
    expect(marked('12 km NW of Anchorage, Alaska', 'alaska anch')).toBe(
      '12 km NW of [Anch]orage, [Alaska]',
    );
  });

  it('finds a word typed without its accents, and marks the original, accents kept', () => {
    expect(marked('6 km SW of Pāhala, Hawaii', 'pahala')).toBe('6 km SW of [Pāhala], Hawaii');
    // The same name with its macron written as a separate mark.
    expect(marked('Pāhala', 'pah')).toBe('[Pāh]ala');
  });

  it('leaves text alone when the search is empty or finds nothing', () => {
    expect(highlight('Tonga', '  ')).toEqual([{ text: 'Tonga', hit: false }]);
    expect(highlight('Tonga', 'fiji')).toEqual([{ text: 'Tonga', hit: false }]);
  });
});

describe('Highlight', () => {
  it('marks the hits and adds nothing between the parts', () => {
    const fixture = TestBed.createComponent(Highlight);
    fixture.componentRef.setInput('text', '8 km S of Guánica, Puerto Rico');
    fixture.componentRef.setInput('search', 'guanica');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toBe('8 km S of Guánica, Puerto Rico');
    expect(element.querySelector('mark')?.textContent).toBe('Guánica');
  });
});
