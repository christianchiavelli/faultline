# Upstream API reference

Notes gathered by probing the live USGS services on 29 September 2026. This file is the source of truth for the contracts our BFF wraps, because the two services answer the same questions in different ways, and the code only makes sense next to those differences.

## Two upstreams, two contracts

| Concern | Summary feeds `/earthquakes/feed/v1.0/summary/*.geojson` | FDSN event service `/fdsnws/event/1/query` |
| --- | --- | --- |
| What it is | Static files, regenerated every minute | A search over the whole catalogue |
| Scope | Fixed windows: past hour, day, week, month | Any time range, area or magnitude |
| One event | A summary, about 0.7 kB | The full record with every product, 35 kB |
| Location quality | Azimuthal gap, stations and RMS, but no location error | Horizontal and vertical error, depth type |
| Caching headers | `max-age=60`, `Last-Modified`, no `ETag` | `max-age=60`, `Last-Modified` |
| An unknown event | simply absent | 404, as plain text |
| A deleted event | simply absent | 409, as plain text |
| A search that fails | n/a | 400 past 20,000 matches |

The live page reads the day feed, which holds everything it draws. The event page reads the FDSN service, because only there does an event carry the error of its location and how its depth was found.

## Field-level hazards

Figures from the day feed of 29 September: 203 events, 145 kB as served, 19 kB gzipped. The week was 1,855 events and 1.3 MB, which is why the BFF sends the browser only the fields the page draws.

- `magType` named six different scales in one day: `ml` 111, `md` 69, `mb` 17, `mww` 3, `mb_lg` 2, `mw` 1. The week had eight. They come lowercase; the codes seismologists write (`ML`, `Mww`, `mb_Lg`) and what each measures live in `src/shared/domain/magnitude.ts`.
- `status` split 106 `automatic` to 97 `reviewed`. The FDSN service also knows `deleted`. Anything not explicitly `reviewed` is treated as automatic, because claiming a review that did not happen is the worse mistake.
- Depth is the third coordinate, in kilometres, and it can be negative: 7 events sat above sea level, the highest at −3.4 km. They are shallow events under high ground, located relative to the sea.
- Ten events sat at exactly 10 km. That is the depth analysts assign when the data cannot constrain one, but the feed cannot tell a fixed depth from a measured one; only the FDSN `origin` product can, in `depth-type`.
- `place` is written to follow a magnitude, as in the feed's own `title` (`M 5.6 - southern Mid-Atlantic Ridge`), so some places start lowercase. Standing alone as a heading or a table cell, they get a capital.
- `type` mixes kinds of event: 4 explosions among 199 earthquakes that day; the week added mining explosions and quarry blasts. They are counted and labelled, and never become the largest earthquake of the day.
- `ids`, `sources` and `types` are comma-wrapped strings (`,ci41340631,`). 15 events carried more than one id, one per network that reported them; `id` is the preferred one.
- `time` and `updated` are milliseconds since the epoch, UTC. `tz` is always `null`, and `felt` was `null` for 189 of the 203.

## Origin products are strings, and not every network sends them all

Every product property is a string, numbers included:

```
us6000tyc3, M5.6 mww, reviewed
  "horizontal-error": "9.3"      "vertical-error": "1.756"
  "azimuthal-gap": "27"          "num-stations-used": "131"
  "depth-type": "operator assigned"
```

What an origin contains depends on the network that computed it. Automatic solutions from `ak`, `ci`, `hv` and `nc` all carried `depth-type: "from location"` and the four uncertainty fields; one from `nn`, the Nevada network, had no `depth-type` and no `horizontal-error` at all. The mapper reads every field as optional, and an empty number as a missing one.

An event can carry origins from more than one network. The one with the highest `preferredWeight` is the USGS's preferred solution, and it is the one the BFF reads.

## Absence is signalled three ways

| Request | HTTP | Body |
| --- | --- | --- |
| `eventid=zz99999999` (never existed) | 404 | `Error 404: Not Found`, as text |
| `eventid=aka2026thwdfh` (deleted since) | 409 | `The requested event has been deleted.`, as text |
| a search with no match, `format=geojson` | 200 | a `FeatureCollection` with `count: 0` and no `features` |
| the same search, in the default QuakeML format | 204 | empty |

The BFF maps 404 and 204 to a 404 for the app and 409 to a 410, so a deleted event reads differently from one that never existed, and both reach crawlers with the right status.

## Searches stop at 20,000 events

A search that matches more is refused outright rather than truncated:

```
GET /fdsnws/event/1/query?format=geojson&starttime=2026-01-01&minmagnitude=0
 -> 400  101002 matching events exceeds search limit of 20000.
         Modify the search to match fewer events.

GET /fdsnws/event/1/count?format=geojson&starttime=2026-01-01&minmagnitude=0
 -> 200  {"count":101002,"maxAllowed":20000,"error":"..."}
```

`/count` answers the same question without running the search, so any historical query should count first. A search wide enough never gets its 400 at all: our probe of every event since 2000 got a 504 from the gateway instead.

## Caching and etiquette

Both services send `Cache-Control: public, max-age=60`, and the feed's `Last-Modified` moves once a minute. The BFF fetches each feed at most once a minute, however many people are reading, and answers with its own `ETag`, derived from the feed's generation time.

The feed also sends `Access-Control-Allow-Origin: *`, so a browser could read it directly. The BFF is not there for CORS: it is there to validate, trim and cache, and to keep the number of calls to the USGS independent of traffic.

We found no published rate limit. The BFF identifies itself with a `User-Agent` and paces the event lookups its cache cannot answer: ten at once, then two a second, for the whole process.

## Endpoints we consume

```
GET earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_{hour,day,week}.geojson
 -> { type: "FeatureCollection",
      metadata { generated, count, api, ... },
      features[]: { id,
                    properties { mag, magType, place, time, updated, status, type, net, ... },
                    geometry { coordinates: [longitude, latitude, depthKm] } } }

GET earthquake.usgs.gov/fdsnws/event/1/query?eventid={id}&format=geojson
 -> Feature { id,
              properties { ...the same, products { origin[], moment-tensor[], losspager[], ... } },
              geometry }
```
