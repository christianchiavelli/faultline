/**
 * The browser's `EventSource`, which jsdom lacks, with the spec answering for
 * the server. Every one opened is kept in `opened`, newest last. For specs
 * only: `vi.stubGlobal('EventSource', FakeEventSource)`.
 */
export class FakeEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static readonly opened: FakeEventSource[] = [];

  readyState: number = FakeEventSource.CONNECTING;

  constructor(readonly url: string) {
    super();
    FakeEventSource.opened.push(this);
  }

  static reset(): void {
    FakeEventSource.opened.length = 0;
  }

  close(): void {
    this.readyState = FakeEventSource.CLOSED;
  }

  /** A message from the server, under the name the stream gives it. */
  send(event: string, data: unknown): void {
    this.readyState = FakeEventSource.OPEN;
    this.dispatchEvent(new MessageEvent(event, { data: JSON.stringify(data) }));
  }

  /** The connection lost: for good when `closed`, as after a refusal, or else for the browser to retry. */
  fail({ closed }: { closed: boolean }): void {
    this.readyState = closed ? FakeEventSource.CLOSED : FakeEventSource.CONNECTING;
    this.dispatchEvent(new Event('error'));
  }
}
