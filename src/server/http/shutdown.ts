import type { Server } from 'node:http';

export interface ShutdownOptions {
  /** How long what is in flight has to finish, once the server stops taking connections. */
  readonly graceMs?: number;
  readonly exit?: (code: number) => void;
}

/**
 * What a deploy's SIGTERM sets off: the server stops taking connections,
 * every live stream ends (each browser opens its own again, wherever the
 * address leads by then), and what is in flight, a render or an export, has
 * ten seconds to finish before the rest is cut.
 */
export function gracefulShutdown(
  server: Pick<Server, 'close' | 'closeIdleConnections' | 'closeAllConnections'>,
  streams: { close(): void },
  { graceMs = 10_000, exit = (code) => process.exit(code) }: ShutdownOptions = {},
): (signal: NodeJS.Signals) => void {
  return (signal) => {
    console.log(`[server] ${signal}: finishing what is in flight`);
    server.close(() => exit(0));
    streams.close();
    server.closeIdleConnections();
    setTimeout(() => {
      console.warn(`[server] still busy after ${graceMs / 1000} s: cutting the rest`);
      server.closeAllConnections();
    }, graceMs).unref();
  };
}
