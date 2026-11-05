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
| T3 | Driver rest breaks (Hours of Service). | Not modelled. ETAs use the routing API's continuous driving time. | Out of scope for the brief; listed as a known limitation. |
| T4 | Time zones. | Departure is entered in browser local time and sent as UTC. The backend and weather queries use UTC only. | Removes a whole class of off-by-hours bugs. |
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
| W1 | Open-Meteo's free tier counts **one call per location** (verified via the `X-RateLimit-Cost` header; limit 600/min, 10,000/day). | All weather is fetched on one shared **0.25° grid** (~17 × 14 mi). Checkpoints and heatmap cells read the same grid cell; each cell is requested once per trip in batched POSTs of up to 100 locations. | Overlapping routes share cells (31 calls saved on Dallas → Denver), and the map and checkpoints can never disagree. |
| W2 | ETAs along the route. | Use TomTom's own distance/time profile (`extendedRouteRepresentation=distance,travelTime`), not an average speed. | ETAs reflect slow urban stretches and fast highways. |
| W3 | Place search. | TomTom **Places Suggest** for autocomplete (filtered to US and Canada), then **Places Details** for coordinates of the chosen place. | Handles partial words ("denv" → Denver, CO); the Geocoding API does not. |
| W4 | Caching. | Routes 10 min (keyed by departure minute, since traffic depends on it). Forecasts 30 min, fetched per cell for a **fixed 10-day window from the current hour**: Open-Meteo charges per location, not per hour of data, so one fetch serves any departure in the next 7 days. Suggestions 1 day, place coordinates 30 days. Keys are hashed and versioned. | Changing load, spacing or departure never spends weather quota again. A repeated trip takes ~0.5 s instead of ~12 s. |
| W6 | Request limits. | Departure from 5 min ago (treated as now) to 7 days ahead. Load 0–100,000 lb. Per-client throttling: 20 trip plans/min, 120 place lookups/min. | Keeps every ETA inside the 16-day forecast and protects free quotas on the public deployment. |
| W7 | Route geometry in the response. | Simplified to 25 m tolerance (radial pass + Douglas-Peucker): ~800 points per route instead of ~10,000. Encoded polylines were measured and rejected: 10× smaller from TomTom but only ~1 s faster, within its normal variance. | Small responses without visible change on the map. |
| W5 | API key safety. | The key lives only in `backend/.env`. Provider errors never include URLs, and `httpx` request logging is silenced, because TomTom's routing key travels in the query string. | A key must not leak through logs or error messages. |

## Heatmap

| # | Question | Decision | Reason |
|---|---|---|---|
| H1 | What is hour 0 on the 0–48 h slider? | The **departure time**. | Weather for "now" is irrelevant to a trip leaving later. |
| H2 | What does the heatmap show? | The same combined, load-adjusted risk level as the checkpoints. | Map and checkpoints can never disagree. |
| H3 | How wide is the corridor? | Every grid cell whose center is within **20 miles** of any route, plus every cell the route passes through. The grid uses 0.25° and coarsens to 0.5° or 1° if that would exceed **400 cells**. | 400 is two thirds of Open-Meteo's 600 locations/minute, so a second new trip in the same minute still succeeds. Dallas → Denver uses 339 cells at 0.25°. |
