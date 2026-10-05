/** The app, served from the production build against the stub. */
export const APP_PORT = 4100;

/** The same build pointed at an address where nothing listens, for the outage path. */
export const OUTAGE_PORT = 4101;

/** Stand-in for earthquake.usgs.gov. */
export const STUB_PORT = 4310;

/**
 * Where nothing listens, for the USGS of the outage path: each call is refused
 * at once, as by a host that is down. Not a well-known port such as 9, which
 * `fetch` refuses to dial at all, so no connection would ever be tried.
 */
export const DEAD_PORT = 4311;
