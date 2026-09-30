import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LogSearch } from './log-search';
import { DEFAULT_LOG_QUERY, type LogQuery } from './log-query';

async function render(query: Partial<LogQuery> = {}) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(LogSearch);
  fixture.componentRef.setInput('query', { ...DEFAULT_LOG_QUERY, ...query });
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const field = element.querySelector<HTMLInputElement>('input[type="search"]')!;
  const type = (value: string) => {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  return { fixture, element, field, navigate, type };
}

describe('LogSearch', () => {
  afterEach(() => vi.useRealTimers());

  it('sends the search once the reader pauses, as a step Back can undo', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { navigate, type } = await render({ magnitude: 'any' });

    type('gey');
    type('geysers ');
    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { mag: 'any', q: 'geysers' },
      replaceUrl: false,
    });
  });

  it('refines a search in place, without a step for every word', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { navigate, type } = await render({ search: 'the' });

    type('the geysers');
    vi.advanceTimersByTime(250);

    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { q: 'the geysers' },
      replaceUrl: true,
    });
  });

  it('sends at once on Enter, and carries the rest of the view for a page not yet hydrated', async () => {
    const { element, field, navigate } = await render({ region: 'alaska', unfolded: true });
    const form = element.querySelector('form')!;

    expect(form.getAttribute('method')).toBe('get');
    expect(
      [...form.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map((input) => [
        input.name,
        input.value,
      ]),
    ).toEqual([
      ['region', 'alaska'],
      ['rows', 'all'],
    ]);

    field.value = 'willow';
    form.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));

    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { region: 'alaska', q: 'willow', rows: 'all' },
      replaceUrl: false,
    });
  });

  it('offers a way to clear the search once there is one', async () => {
    const { element, field, navigate } = await render({ search: 'cobb' });
    const clear = element.querySelector<HTMLButtonElement>('button.clear')!;

    expect(element.querySelector('kbd')).toBeNull();
    clear.click();

    expect(field.value).toBe('');
    expect(navigate).toHaveBeenCalledWith([], { queryParams: {}, replaceUrl: true });
  });

  it('takes the focus on "/", unless the reader is typing elsewhere', async () => {
    const { field } = await render();
    const other = document.body.appendChild(document.createElement('textarea'));

    other.focus();
    other.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(document.activeElement).toBe(other);

    other.blur();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(document.activeElement).toBe(field);
    other.remove();
  });
});
