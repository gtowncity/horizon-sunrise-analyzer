import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { destination } from "../../core/geo";
import type { Position } from "../../core/types";
import type { HorizonResult } from "./types";
import { selectedBlocker } from "./export";
maplibregl.setWorkerUrl(mapWorkerUrl);
export function HorizonMap({
  observer,
  distance,
  result,
  selected,
  onPoint,
}: {
  observer: Position;
  distance: number;
  result?: HorizonResult;
  selected: number;
  onPoint: (p: Position) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    instance = useRef<maplibregl.Map | null>(null),
    refresh = useRef(() => {}),
    latest = useRef({ observer, distance, result, selected, onPoint });
  latest.current = { observer, distance, result, selected, onPoint };
  useEffect(() => {
    if (!container.current) return;
    const p = latest.current.observer;
    const map = new maplibregl.Map({
      container: container.current,
      center: [p.lon, p.lat],
      zoom: 12,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
    });
    instance.current = map;
    map.addControl(new maplibregl.NavigationControl());
    const marker = new maplibregl.Marker({ draggable: true })
      .setLngLat([p.lon, p.lat])
      .addTo(map);
    const blocker = new maplibregl.Marker({ color: "#d97706" });
    marker.on("dragend", () => {
      const x = marker.getLngLat();
      latest.current.onPoint({ lat: x.lat, lon: x.lng });
    });
    map.on("click", (e) =>
      latest.current.onPoint({ lat: e.lngLat.lat, lon: e.lngLat.lng }),
    );
    let ready = false;
    refresh.current = () => {
      if (!ready) return;
      const {
        observer: o,
        distance: r,
        selected: a,
        result: res,
      } = latest.current;
      marker.setLngLat([o.lon, o.lat]);
      const end = destination(o, a, r),
        circle = Array.from({ length: 73 }, (_, j) => {
          const t = destination(o, j * 5, r);
          return [t.lon, t.lat];
        });
      const features: GeoJSON.Feature<GeoJSON.LineString>[] = [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: circle },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [o.lon, o.lat],
              [end.lon, end.lat],
            ],
          },
        },
      ];
      const gap = (az: number) =>
        Math.min(Math.abs(az - a), 360 - Math.abs(az - a));
      const d = res?.directions.reduce((best, current) =>
        gap(current.azimuth) < gap(best.azimuth) ? current : best,
      );
      const b = d ? selectedBlocker(d) : null;
      if (b) blocker.setLngLat([b.lon, b.lat]).addTo(map);
      else blocker.remove();
      const data: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
        type: "FeatureCollection",
        features,
      };
      const src = map.getSource("horizon") as
        maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(data);
      else {
        map.addSource("horizon", { type: "geojson", data });
        map.addLayer({
          id: "horizon-lines",
          type: "line",
          source: "horizon",
          paint: { "line-color": "#087f8c", "line-width": 2 },
        });
      }
    };
    map.on("load", () => {
      ready = true;
      refresh.current();
    });
    return () => {
      map.remove();
      instance.current = null;
    };
  }, []);
  useEffect(() => refresh.current(), [observer, distance, result, selected]);
  useEffect(() => {
    instance.current?.jumpTo({ center: [observer.lon, observer.lat] });
  }, [observer.lat, observer.lon]);
  return (
    <div
      ref={container}
      className="h360-map"
      aria-label="OSM-Karte: Beobachter, Untersuchungsradius, ausgewählte Richtung und Rasterblocker"
    />
  );
}
