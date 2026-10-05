# Upstream API reference

Notes gathered by probing the live USGS services on 29 September 2026. This file is the source of truth for the contracts our BFF wraps, because the two services answer the same questions in different ways, and the code only makes sense next to those differences.

## Two upstreams, two contracts

| Concern | Summary feeds `/earthquakes/feed/v1.0/summary/*.geojson` | FDSN event service `/fdsnws/event/1/query` and `/count` |
| --- | --- | --- |
| What it is | Static files, regenerated every minute | A search over the whole catalogue |
| Scope | Fixed windows: past hour, day, week, month | Any time range, area or magnitude |
| One event | A summary, about 0.7 kB | The full record with every product, 35 kB |
| Location quality | Azimuthal gap, stations and RMS, but no location error | Horizontal and vertical error, depth type |
| Caching headers | `max-age=60`, `Last-Modified`, no `ETag` | `max-age=60`, `Last-Modified` |
| An unknown event | simply absent | 404, as plain text |
| A deleted event | simply absent | 409, as plain text |
| A search too large | n/a | 400 past 20,000 matches, unless paged |

The live page reads the day feed, which holds everything it draws. The event page reads the FDSN service, because only there does an event carry the error of its location and how its depth was found. The export reads it too: `/count` for the number the dialog shows as a search is narrowed, and `/query` as CSV, oldest first and 20,000 events at a time, for the file.

## Field-level hazards

Figures from the day feed of 29 September: 203 events, 145 kB as served, 19 kB gzipped. The week was 1,855 events and 1.3 MB, which is why the BFF sends the browser only the fields the page draws.

- `magType` named six different scales in one day: `ml` 111, `md` 69, `mb` 17, `mww` 3, `mb_lg` 2, `mw` 1. The week had eight. They come lowercase; the codes seismologists write (`ML`, `Mww`, `mb_Lg`) and what each measures live in `src/shared/domain/magnitude.ts`.
- `status` split 106 `automatic` to 97 `reviewed`. The FDSN service also knows `deleted`. Anything not explicitly `reviewed` is treated as automatic, because claiming a review that did not happen is the worse mistake.
- Depth is the third coordinate, in kilometres, and it can be negative: 7 events sat above sea level, the highest at −3.4 km. They are shallow events under high ground, located relative to the sea.
- Ten events sat at exactly 10 km. That is the depth analysts assign when the data cannot constrain one, but the feed cannot tell a fixed depth from a measured one; only the FDSN `origin` product can, in `depth-type`.
- `place` is written to follow a magnitude, as in the feed's own `title` (`M 5.6 - southern Mid-Atlantic Ridge`), so some places start lowercase. Standing alone as a heading or a table cell, they get a capital.
- `place` puts its region after the last comma, and not always as a name. Of the 223 events in the day feed on 30 September, 95 ended in `CA`, the Californian networks' code for California, and one in `B.C., MX`, theirs for Mexico after a Baja California locality; every other network spelled its region out, Mexico included. Two had no comma at all: far from any named place, the USGS gives only a Flinn–Engdahl seismic region, `Balleny Islands region`. The log's region facet reads all three through `src/shared/domain/place.ts`.
- `type` mixes kinds of event: 4 explosions among 199 earthquakes that day; the week added mining explosions and quarry blasts. They are counted and labelled, and never become the largest earthquake of the day.
- `ids`, `sources` and `types` are comma-wrapped strings (`,ci41340631,`). 15 events carried more than one id, one per network that reported them; `id` is the preferred one.
- An `id` is its network's code, then that network's own code for the event: all 212 events of the day feed on 30 September started with their `net`, always two letters. The live page reads the network off the id rather than carry the field.
- Size says which network located an event. That same day, every event below M2.5 came from a US regional network (`nc` 57, `ak` 41, `ci` 38, `av` 10 and six more), and every one from M4.5 up from `us`, the global network.
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
| the same search, `format=csv` | 200 | the header row alone |

The BFF maps 404 and 204 to a 404 for the app and 409 to a 410, so a deleted event reads differently from one that never existed, and both reach crawlers with the right status.

## The 20,000 limit is per request, not per search

Without `limit`, a search that matches more than 20,000 events is refused outright rather than truncated:

```
GET /fdsnws/event/1/query?format=geojson&starttime=2026-01-01&minmagnitude=0
 -> 400  101002 matching events exceeds search limit of 20000.
         Modify the search to match fewer events.

GET /fdsnws/event/1/count?format=geojson&starttime=2026-01-01&minmagnitude=0
 -> 200  {"count":101002,"maxAllowed":20000,"error":"..."}
```

With `limit`, the same kind of search is answered a page at a time, and `offset` walks past the 20,000th event. `offset` counts from 1.

```
GET /query?starttime=2026-07-01&endtime=2026-09-29T19:00:00          (34,348 matches)
    &limit=10                  -> 200, 10 events
    &limit=10&offset=20001     -> 200, 10 events
    &limit=20001               -> 400  Valid values are 0 <= limit <= 20000
```

A page carries no total, since `metadata.count` is absent, so the total comes from `/count`, which answers without running the search. Offsets drift when events land in the window or leave it while a search is being paged, as automatic solutions do, so a long export should page by time instead: `orderby=time-asc` with a fixed `endtime`, each page starting at the time of the last event of the one before, and the duplicates at the seam dropped by id.

Counting is not free on wide searches: M4.5 and up since 2000 took ten seconds to count, and every event since 2000 got a 504 from the gateway instead of an answer. That 504, like a count or a page that runs out of time here, is not retried: the same search runs out of time again, and every try costs the USGS the whole of it. Every other call is retried twice, and each try, retries included, spends a call from the budget in `budget.ts`.

## How much the catalogue holds

The whole world, counted on 29 September 2026:

| Search                    | Events  | Count took |
| ------------------------- | ------- | ---------- |
| Last 7 days               | 1,927   | 0.6 s      |
| Last 30 days              | 10,628  | 1.3 s      |
| Last 30 days, M2.5 and up | 1,974   | 1.8 s      |
| Since 1 July, 90 days     | 34,348  | 1.8 s      |
| Last year, M2.5 and up    | 28,640  | 2.8 s      |
| Last year, M4.5 and up    | 7,695   | 1.6 s      |
| Since 1900, M7 and up     | 1,618   | 0.6 s      |
| Since 1900, M6 and up     | 14,526  | 1.2 s      |
| Since 1900, M5 and up     | 107,347 | 4.4 s      |
| Since 2000, M4.5 and up   | 187,394 | 9.9 s      |

So one request holds about eight weeks of every magnitude, about eight months of M2.5 and up, and the whole instrumental record of M6 and up.

## Search parameters the WADL leaves out

`application.wadl` lists 35 parameters for `/query`. These work as well and are missing from it: `format`, `orderby`, `reviewstatus`, `alertlevel`, `producttype`, `maxradiuskm`, `includedeleted` and `jsonerror`. On one day, 28 September:

| Filter                                | Events   |
| ------------------------------------- | -------- |
| none                                  | 326      |
| `reviewstatus=reviewed` / `automatic` | 245 / 81 |
| `eventtype=earthquake` / `explosion`  | 317 / 7  |
| `producttype=moment-tensor`           | 8        |
| `producttype=shakemap`                | 5        |
| `includedeleted=true`                 | 328      |

`jsonerror=true` returns errors as GeoJSON, with the message in `metadata.error`, instead of plain text.

`mindepth` and `maxdepth` are both inclusive. Over the week of 23 to 30 September, `maxdepth=10` counted 1,308 events and `maxdepth=9.999` 1,202, and `mindepth=10&maxdepth=10` found the 106 in between, every one at exactly 10 km, the depth analysts fix. So an event at exactly 70 km would fall in both the shallow and the intermediate export, where the log counts it once, as intermediate; none sat there that week.

## Formats

`csv`, `geojson`, `text` (the pipe-separated FDSN text), `quakeml` or `xml`, `kml` and `kmlraw` all answer; `cap` is a 400. The default is QuakeML.

The CSV has 22 columns and, unlike the summary feed, carries the location and magnitude errors:

```
time,latitude,longitude,depth,mag,magType,nst,gap,dmin,rms,net,id,updated,place,type,
horizontalError,depthError,magError,magNst,status,locationSource,magSource
```

It has no `depth-type`, so a fixed depth still cannot be told from a measured one. Neither format sends a `Content-Disposition`, so a link straight to the service opens the file in the tab instead of downloading it.

Thirty days of every magnitude, 10,628 events, came to 2.1 MB as CSV (815 kB gzipped) and 7.6 MB as GeoJSON (1.2 MB gzipped), both in about two and a half seconds: roughly 200 bytes an event as CSV and 720 as GeoJSON.

`orderby` takes `time`, the default and newest first, `time-asc`, `magnitude` and `magnitude-asc`. Magnitudes go below zero: the smallest of 28 September was −1.14.

## Places and times

- A rectangle is `minlatitude`, `maxlatitude`, `minlongitude` and `maxlongitude`. `minlongitude` must be less than `maxlongitude`, so a box across the antimeridian, where Fiji and Tonga sit, is written with longitudes past 180: `minlongitude=170&maxlongitude=190` returned 94 events, exactly the 20 of `170` to `180` plus the 74 of `-180` to `-170`.
- A circle is `latitude`, `longitude` and `maxradiuskm`, up to 20,001.6 km, half the planet; or `maxradius` in degrees, up to 180.
- Times are UTC unless they carry an offset, and an offset such as `-03:00` is honoured. Without dates, a search covers the last 30 days.
- Dates are parsed leniently: `starttime=yesterday` is accepted and means UTC midnight yesterday. The BFF has to validate dates itself, or a typo becomes a different search instead of an error.

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
