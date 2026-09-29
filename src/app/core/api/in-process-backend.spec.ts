import { FetchBackend, HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { InProcessApiBackend } from './in-process-backend';

describe('InProcessApiBackend', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [InProcessApiBackend] });
  });

  it('answers /api requests in-process, surfacing problems as HTTP errors', async () => {
    const network = vi.spyOn(FetchBackend.prototype, 'handle');
    const backend = TestBed.inject(InProcessApiBackend);

    const error: unknown = await firstValueFrom(
      backend.handle(new HttpRequest('GET', '/api/nothing-here')),
    ).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(404);
    expect((error as HttpErrorResponse).error).toMatchObject({ title: 'No such endpoint' });
    expect(network).not.toHaveBeenCalled();
  });

  it('leaves every other request to fetch', async () => {
    const response = new HttpResponse({ status: 200, body: 'from the network' });
    vi.spyOn(FetchBackend.prototype, 'handle').mockReturnValue(of(response));
    const backend = TestBed.inject(InProcessApiBackend);

    expect(
      await firstValueFrom(backend.handle(new HttpRequest('GET', 'https://example.org/data'))),
    ).toBe(response);
  });
});
