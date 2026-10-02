import { TestBed } from '@angular/core/testing';
import {
  Router,
  convertToParamMap,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { aQuake } from '@shared/testing/quake-fixture';
import { handedOver, quakeLinkState } from './quake-link';

/** What the resolver makes of a navigation to `id` carrying `state`, or of none at all. */
function resolve(id: string, state?: Record<string, unknown>) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: Router,
        useValue: { currentNavigation: () => (state ? { extras: { state } } : null) },
      },
    ],
  });
  const route = { paramMap: convertToParamMap({ id }) } as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() => handedOver(route, {} as RouterStateSnapshot));
}

describe('handedOver', () => {
  const quake = aQuake({ id: 'us1lata' });

  it('hands the page the summary its link knew', () => {
    expect(resolve('us1lata', { ...quakeLinkState(quake) })).toEqual(quake);
  });

  it('hands over nothing for a page loaded from its address, or rendered on the server', () => {
    expect(resolve('us1lata')).toBeNull();
  });

  it('hands over nothing a link knew of another event', () => {
    expect(resolve('us1ruteng', { ...quakeLinkState(quake) })).toBeNull();
  });

  it('hands over nothing a history entry from another version left in another shape', () => {
    expect(resolve('us1lata', { quake: { id: 'us1lata', magnitude: 5.1 } })).toBeNull();
  });
});
