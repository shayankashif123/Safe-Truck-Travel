# Design decisions

The brief leaves several points open. Each decision below is deliberate, and
the code and tests follow it. Where a choice was a judgement call, the reason
is given so it can be challenged.

## Risk classification

| # | Question | Decision | Reason |
|---|---|---|---|
| R1 | Threshold edges overlap (rain 0.25 is in two bands) or leave gaps (wind 34.5). | A value takes the **highest band whose lower bound it meets**. Explicit `<`, `>`, `≥` in the brief are followed exactly. | Respects every explicit symbol; only the ambiguous hyphen ranges are interpreted. |
| R2 | Sustained wind or gusts? | Classify on **sustained wind** at 10 m. Gusts are shown, not scored. | Gusts would push almost every route to High and flatten the ranking. |
| R3 | What counts as rain and snow? | Rain = liquid precipitation only. Snow = snowfall **depth** rate. | Total precipitation would count snow twice. |
| R4 | API units differ from the brief. | Request mph and inches from the API. Any conversion lives in one tested module. | One place to be right. |
| R5 | Load rule edges. | `>` is strict: exactly 30,000 lb does not trigger the 45–54 mph rule. Load rules only **raise** the wind level and are matched against the unadjusted wind level, so they never chain (40 mph + 50,000 lb is Severe, not No Travel). The checkpoint level is the worst of (load-adjusted wind, rain, snow). | Literal reading of the brief. |

Resulting bands (lower bound inclusive):

| Level | Wind (mph) | Rain (in/hr) | Snow (in/hr) |
|---|---|---|---|
| Low | < 25 | < 0.10 | < 0.5 |
| Moderate | ≥ 25 | ≥ 0.10 | ≥ 0.5 |
| High | ≥ 35 | ≥ 0.25 | ≥ 1.0 |
| Severe | ≥ 45 | ≥ 0.50 | ≥ 2.0 |
| No Travel | ≥ 55 | > 1.00 | > 3.0 |

## Checkpoints and time

| # | Question | Decision | Reason |
|---|---|---|---|
| T1 | "Every 10 / 25 / 50 miles" | User selects the spacing (default 25). Origin and destination are always checkpoints. | The slash reads as a choice; it also shows the detail/speed trade-off. |
| T2 | ETA falls between forecast hours. | **Wind:** nearest hour (Open-Meteo wind is an instantaneous reading). **Rain/snow:** the hour bucket containing the ETA (Open-Meteo precipitation is the total for the hour *ending* at each timestamp, so ETA 14:20 reads the 15:00 value). | Matches what each provider value actually measures. |
| T3 | Driver rest (US hours of service). | The driver is chosen in the form: **Solo** (default) or **Team**. A solo driver follows the FMCSA property-carrier limits ([summary](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations)): a **30-min break after 8 h** of driving and a **10-h rest after 11 h**, each taken as late as allowed. Every checkpoint ETA adds the stops made before it, and the stops are shown on the map and the heatmap timeline. A team swaps drivers, so the truck keeps moving. Assumptions: the driver starts rested with full weekly hours; only driving counts as on-duty time, so the 14-h window never binds (8 + 0.5 + 3 = 11.5 h, checked by a test); the 60/70-h weekly limit is not modelled. | Without rest, ETAs are wrong exactly where it matters: Dallas → Denver is 12.8 h of driving, but a solo driver arrives ~23 h after departure, so the last stretch is driven ~10 h later, in different weather. Solo is the default because it never shows an ETA earlier than reality. |
| T3a | Rest and "shortest travel time". | Travel time in the ranking is **door to door** (driving + required stops). Stops only grow with driving time, so they never change which route is faster; they change *when* each checkpoint is reached and therefore its weather. | The time a driver cares about is arrival; a test proves the ordering property. |
| T4 | Time zones. | All computation is in UTC. For display, the API returns the IANA zone of the origin, the destination, every checkpoint and every stop (looked up offline with `timezonefinder`: no quota, ~3 µs per point). Every time is shown in **local time at its place, with the zone named** ("Sat 2:40 PM MST"): arrival in the destination's zone, a checkpoint ETA in the checkpoint's, the slider in the origin's. The departure is typed in the **origin's** zone; the form stores it as an instant, so picking an origin in another zone changes only how it is shown. Before an origin is chosen, the viewer's zone is used and named. | A route can cross zones (Dallas CST → Denver MST), and the viewer may be anywhere: an unlabelled time in the viewer's zone would be off by up to 13 hours for someone outside the US. |
| T5 | Trip runs beyond the forecast window. | Past departures and departures too far ahead are rejected. A checkpoint without forecast data is **No data**, never Low. | Treating missing data as safe is the worst possible error here. |

## Route ranking

| # | Question | Decision | Reason |
|---|---|---|---|
| K1 | Turning checkpoints into "miles". | Each stretch between two consecutive checkpoints takes the **worse** of its two endpoint levels; its length counts toward that level. A stretch touching a checkpoint without forecast data counts as **no-data miles**, reported but not ranked. | Every mile is counted exactly once and errs on the safe side. |
| K2 | No Travel is missing from the ranking. | Sort key: No Travel miles, Severe miles, High miles, average risk, duration (all ascending). | No Travel is worse than Severe. |
| K3 | "Average risk" is undefined. | Scores Low 0, Moderate 1, High 2, Severe 3, No Travel 4; **distance-weighted** mean. | A short final stretch must not weigh as much as a full one. |
| K3a | Known property: any average favours a longer route with the **same** risky miles (extra Low miles lower the mean). Seen live: Dallas → Denver, both routes had 50 Moderate miles; the 127-mile-longer route won on average risk (0.054 vs 0.062). | Kept the brief's rule as written. Alternatives considered: total risk exposure (score × miles), and ignoring average-risk gaps below 0.1. Both fix this case but redefine a criterion the brief names explicitly. The UI makes the trade-off visible instead: miles per level, extra distance and extra time are shown next to each route. | The recommendation stays faithful to the specified rules, and the driver still sees that the exposure is identical. |
| K4 | "Balance risk and time" vs strict priority list. | The priority list is applied **strictly**. The UI shows the time cost of the safer choice. | The explicit rule wins over the general wording; the trade-off stays visible. |
| K5 | Every route has No Travel miles. | Still recommend the least-bad route, with a clear warning to delay departure. | The driver needs a comparison, not an empty screen. |
| K6 | Routing API returns fewer than 3 routes. | Show what was returned with a note. No synthetic routes. | Honest and correct. |
| K7 | Car or truck routing. | TomTom `travelMode=truck`, `vehicleCommercial=true`, 2 alternatives. `vehicleWeight` is **not** sent: TomTom expects the whole vehicle's weight and we only know the load, so the load is applied by our risk rules only. | Truck speeds and road restrictions give realistic ETAs without inventing an empty-truck weight. |
| K8 | Near-equal values (12.0000001 vs 12.0 Severe miles). | Miles are compared at 0.1 mi, average risk at 0.01, duration at 1 s. | Floating-point noise must not decide a recommendation. |
| K9 | Routes tied on every criterion. | Keep the routing provider's order. | The provider lists its preferred route first. |

## Providers, weather data and caching

| # | Question | Decision | Reason |
|---|---|---|---|
| W1 | Open-Meteo's free tier counts **one call per location** (verified via the `X-RateLimit-Cost` header; limits 600/min, 5,000/h, 10,000/day). | Weather is fetched on fixed grids, one location per cell, in batched POSTs of up to 100. **Checkpoints use a 1/16° grid** (~4 × 3.5 mi): finer than the smallest spacing, so neighbouring checkpoints read their own forecasts, and close to the 2.5–3 km models Open-Meteo serves in the US ([models](https://open-meteo.com/en/docs/gfs-api)). The **heatmap uses 1/4°** cells. A trip may use at most **450 locations** (¾ of the per-minute limit); when it needs more, the heatmap coarsens first (½°, 1°), then the checkpoints, and the UI says so. | Measured on 4 real trips at 10-mile spacing: a single shared 1/4° grid gave ~1 in 3 checkpoints the same forecast as their neighbour (88 of 260 on Dallas → Denver); 1/16° gives 0–2. Both 25- and 10-mile spacing keep the 1/4° heatmap on Dallas → Denver (292 and 424 locations, see H3). Grid sizes are binary fractions, so cell maths is exact. |
| W2 | ETAs along the route. | Use TomTom's own distance/time profile (`extendedRouteRepresentation=distance,travelTime`), not an average speed. | ETAs reflect slow urban stretches and fast highways. |
| W3 | Place search. | TomTom **Places Suggest** for autocomplete (filtered to US and Canada), then **Places Details** for coordinates of the chosen place. | Handles partial words ("denv" → Denver, CO); the Geocoding API does not. |
| W4 | Caching. | Routes 10 min (keyed by departure minute, since traffic depends on it). Forecasts 30 min, fetched per cell for a **fixed 13-day window from the current hour**: Open-Meteo counts one call per location for up to two weeks of data ([pricing](https://open-meteo.com/en/pricing)), so one fetch serves any departure in the next 7 days plus a coast-to-coast solo trip with rests (~5 days). Suggestions 1 day, place coordinates 30 days. Keys are hashed and versioned. | Changing load, spacing or departure never spends weather quota again. A repeated trip takes ~0.5 s instead of ~12 s. |
| W6 | Request limits. | Departure from 5 min ago (treated as now) to 7 days ahead. Load 0–100,000 lb. Per-client throttling: 20 trip plans/min, 120 place lookups/min. | Keeps every ETA inside the 16-day forecast and protects free quotas on the public deployment. |
| W7 | Route geometry in the response. | Simplified to 25 m tolerance (radial pass + Douglas-Peucker): ~800 points per route instead of ~10,000. Encoded polylines were measured and rejected: 10× smaller from TomTom but only ~1 s faster, within its normal variance. | Small responses without visible change on the map. |
| W5 | API key safety. | The key lives only in `backend/.env`. Provider errors never include URLs, and `httpx` request logging is silenced, because TomTom's routing key travels in the query string. | A key must not leak through logs or error messages. |

## Map

| # | Question | Decision | Reason |
|---|---|---|---|
| M1 | Map library and basemap. | MapLibre GL v6 (WebGL2) via react-map-gl v8, with OpenFreeMap's Positron style: free, no key, no request limits, commercial use allowed; attribution is added by MapLibre. | GPU rendering keeps hundreds of checkpoints and the heatmap smooth; a muted basemap lets the risk colours carry the meaning. |
| M2 | "Show all routes and checkpoints" without clutter. | Every route and every checkpoint is drawn. The selected route is teal with full-size checkpoints; the others are grey with smaller, faded checkpoints. Selection syncs both ways between map and panel. | Satisfies the brief literally while keeping one route in focus. |
| M3 | Selection performance. | Route and checkpoint data are uploaded once per plan; selecting a route only changes layer filters (a GPU restyle, no data upload, no map re-render). | The same technique powers the heatmap slider. |
| M4 | Readability. | Route lines are drawn beneath the basemap's place labels; checkpoints and route callouts sit above. Route callouts are placed at the point farthest from other routes. | City names stay legible and callouts of nearby routes do not overlap. |
| M5 | Resilience. | The map bundle is lazy-loaded (the form is usable first) and wrapped in an error boundary: a failed download offers Reload, a rendering failure (e.g. no WebGL2) explains itself. The panel keeps working either way. | A map problem must never block route comparison. |

## Heatmap

| # | Question | Decision | Reason |
|---|---|---|---|
| H1 | What is hour 0 on the 0–48 h slider? | The **departure time**. | Weather for "now" is irrelevant to a trip leaving later. |
| H2 | What does the heatmap show? | The same combined, load-adjusted risk calculation as the checkpoints, on the coarser corridor grid. A checkpoint shows the forecast for its own ~4-mile cell, so it can differ slightly from the 17-mile heatmap cell around it. | Checkpoints decide the recommendation and get the precise forecast; the heatmap gives the regional picture over time. |
| H4 | Making the 0–48 h slider instant. | Cell geometry is uploaded once per plan; each frame's levels are applied with `setFeatureState`, which only rewrites the cells' colour attributes on the GPU. No network request and no map re-render per step. A first design read the frame through a data-driven `global-state` expression and was **measured at ~250 ms per step** (MapLibre re-tiles the source when such inputs change), so it was replaced. | Profiled in Edge on the production build: ~13 ms of JavaScript per frame, 0 API requests while scrubbing; the rest is one ordinary map repaint (same cost as a 1-pixel pan). |
| H5 | Linking the timeline to the decision. | The panel shows the time at the slider position, a looping play control, the legend, and a truck marker on the selected route at that hour with the risk of the cell it is in. Low cells are a faint wash and higher levels progressively stronger, so hotspots stand out. | Answers "where will my truck be, and what will the weather be there?", not just "what is the weather". |
| H3 | How wide is the corridor? | Every 1/4° cell whose center is within **12 miles** of any route, plus every cell the route passes through: a band 2–3 cells (~35–50 mi) wide. ½° or 1° only when the trip's location budget (W1) requires it. | Measured on real trips, a 20-mile radius cost ~70% more locations (Dallas → Denver 339 vs 197 corridor cells) and made switching the same trip from 25- to 10-mile spacing exceed Open-Meteo's per-minute limit (613 locations). At 12 miles: 292 at 25-mile spacing, 424 at 10, 471 for both in one minute, and two different ~800-mile trips fit in one minute (Dallas → Denver + Chicago → Atlanta = 550). |
