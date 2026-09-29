import {
  HttpClient,
  type HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { transferApiErrors } from './transfer-errors';

const KEY = makeStateKey<unknown>('api-error:/api/quakes/zz404');
const PROBLEM = { type: 'about:blank', title: 'No such event', status: 404 };

function setUp(platform: 'server' | 'browser') {
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: platform },
      provideHttpClient(withInterceptors([transferApiErrors])),
      provideHttpClientTesting(),
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    network: TestBed.inject(HttpTestingController),
    state: TestBed.inject(TransferState),
  };
}

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error as HttpErrorResponse,
  );

describe('transferApiErrors', () => {
  it('records a failed API call on the server, for the browser to hydrate from', async () => {
    const { http, network, state } = setUp('server');

    const error = failure(firstValueFrom(http.get('/api/quakes/zz404')));
    network.expectOne('/api/quakes/zz404').flush(PROBLEM, { status: 404, statusText: 'Not Found' });

    expect((await error)?.status).toBe(404);
    expect(state.get(KEY, null)).toEqual({ status: 404, statusText: 'Not Found', body: PROBLEM });
  });

  it('answers the first browser request from the record, and every later one from the network', async () => {
    const { http, network, state } = setUp('browser');
    state.set(KEY, { status: 404, statusText: 'Not Found', body: PROBLEM });

    const hydrated = await failure(firstValueFrom(http.get('/api/quakes/zz404')));
    network.expectNone('/api/quakes/zz404');
    expect(hydrated?.status).toBe(404);
    expect(hydrated?.error).toEqual(PROBLEM);

    const retried = failure(firstValueFrom(http.get('/api/quakes/zz404')));
    network.expectOne('/api/quakes/zz404').flush(PROBLEM, { status: 404, statusText: '' });
    expect((await retried)?.status).toBe(404);
  });

  it('leaves requests outside the API alone', async () => {
    const { http, network, state } = setUp('server');

    const error = failure(firstValueFrom(http.get('/maps/earth.svg')));
    network.expectOne('/maps/earth.svg').flush('', { status: 404, statusText: 'Not Found' });

    await error;
    expect(state.isEmpty).toBe(true);
  });
});
