import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LogFilters } from './log-filters';
import { DEFAULT_LOG_QUERY, type LogQuery } from './log-query';

async function render(query: Partial<LogQuery> = {}) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(LogFilters);
  fixture.componentRef.setInput('query', { ...DEFAULT_LOG_QUERY, ...query });
  fixture.componentRef.setInput('facets', []);
  fixture.componentRef.setInput('shown', 12);
  await fixture.whenStable();
  return { element: fixture.nativeElement as HTMLElement, navigate };
}

describe('LogFilters', () => {
  it('counts the filters away from their default on its button, the search aside', async () => {
    const { element } = await render({ magnitude: 'any', region: 'alaska', search: 'willow' });

    expect(element.querySelector('button')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Filters 2 on',
    );
  });

  it('has no count while the view is the default one', async () => {
    const { element } = await render();

    expect(element.querySelector('.badge')).toBeNull();
  });

  it('sorts from its menu, keeping the rest of the view', async () => {
    const { element, navigate } = await render({ region: 'alaska', order: 'newest' });
    const menu = element.querySelector('select')!;

    expect(menu.value).toBe('newest');
    menu.value = 'deepest';
    menu.dispatchEvent(new Event('change'));

    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { region: 'alaska', sort: 'deepest' },
    });
  });
});
