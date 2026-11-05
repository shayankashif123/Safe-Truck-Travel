/**
 * The one place the app loads MapLibre.
 *
 * MapLibre v6 is ESM-only, and with a bundler its web worker URL must be set
 * before the first map is created. Importing the library only through this
 * module guarantees that order. The map component receives it via `mapLib`,
 * so react-map-gl never imports a second, unconfigured copy.
 */
import 'maplibre-gl/dist/maplibre-gl.css'

import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

maplibregl.setWorkerUrl(workerUrl)

export { maplibregl }

/** OpenFreeMap: free, no key, attribution added by MapLibre automatically. */
export const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
