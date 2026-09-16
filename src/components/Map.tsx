import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type * as GeoJSON from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Analysis, Inputs, Position } from "../core/types";
import { destination } from "../core/geo";
maplibregl.setWorkerUrl(mapWorkerUrl);
export function MapView({
  inputs,
  result,
  onPoint,
  select,
}: {
  inputs: Inputs;
  result?: Analysis;
  onPoint: (p: Position, kind: "observer" | "target") => void;
  select: "observer" | "target";
}) {
  const div = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  const latest = useRef({ inputs, result, onPoint, select });
  latest.current = { inputs, result, onPoint, select };
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    if (!div.current) return;
    const m = new maplibregl.Map({
      container: div.current,
      center: [inputs.observer.lon, inputs.observer.lat],
      zoom: 10,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
          },
        },
        layers: [
          {
            id: "base",
            type: "raster",
            source: "osm",
            paint: { "raster-saturation": -0.7, "raster-opacity": 0.85 },
          },
        ],
      },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }));
    const observer = new maplibregl.Marker({
      color: "#0b7285",
      draggable: true,
    })
      .setLngLat([inputs.observer.lon, inputs.observer.lat])
      .addTo(m);
    const end = destination(inputs.observer, inputs.azimuth, inputs.distance);
    const target = new maplibregl.Marker({ color: "#64748b", draggable: true })
      .setLngLat([end.lon, end.lat])
      .addTo(m);
    const blocker = new maplibregl.Marker({ color: "#d97706" });
    const move = (marker: maplibregl.Marker, kind: "observer" | "target") => {
      const p = marker.getLngLat();
      latest.current.onPoint({ lat: p.lat, lon: p.lng }, kind);
    };
    observer.on("dragend", () => move(observer, "observer"));
    target.on("dragend", () => move(target, "target"));
    m.on("click", (e) =>
      latest.current.onPoint(
        { lat: e.lngLat.lat, lon: e.lngLat.lng },
        latest.current.select,
      ),
    );
    let ready = false;
    refresh.current = () => {
      if (!ready) return;
      const { inputs: i, result: r } = latest.current,
        endpoint = destination(i.observer, i.azimuth, i.distance);
      observer.setLngLat([i.observer.lon, i.observer.lat]);
      target.setLngLat([endpoint.lon, endpoint.lat]);
      const coordinates = Array.from({ length: 65 }, (_, j) => {
        const p = destination(i.observer, i.azimuth, (i.distance * j) / 64);
        return [p.lon, p.lat];
      });
      const features: GeoJSON.Feature<GeoJSON.LineString>[] = [
        {
          type: "Feature",
          properties: { kind: "sight" },
          geometry: { type: "LineString", coordinates },
        },
      ];
      if (r) {
        const b =
          r.inputs.model === "dom20"
            ? (r.profile.surfaceBlocker ?? r.profile.blocker)
            : r.profile.blocker;
        blocker.setLngLat([b.lon, b.lat]).addTo(m);
        features.push({
          type: "Feature",
          properties: { kind: "contact" },
          geometry: {
            type: "LineString",
            coordinates: [
              [i.observer.lon, i.observer.lat],
              [b.lon, b.lat],
            ],
          },
        });
        if (r.horizon.length)
          for (const h of [r.horizon[0], r.horizon.at(-1)!]) {
            const p = destination(i.observer, h.azimuth, i.distance);
            features.push({
              type: "Feature",
              properties: { kind: "fan" },
              geometry: {
                type: "LineString",
                coordinates: [
                  [i.observer.lon, i.observer.lat],
                  [p.lon, p.lat],
                ],
              },
            });
          }
      } else blocker.remove();
      const source = m.getSource("analysis") as
        maplibregl.GeoJSONSource | undefined;
      const data: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
        type: "FeatureCollection",
        features,
      };
      if (source) source.setData(data);
      else {
        m.addSource("analysis", { type: "geojson", data });
        m.addLayer({
          id: "analysis-lines",
          type: "line",
          source: "analysis",
          paint: {
            "line-color": [
              "match",
              ["get", "kind"],
              "contact",
              "#d97706",
              "fan",
              "#8897a8",
              "#087f8c",
            ],
            "line-width": ["match", ["get", "kind"], "fan", 1, 3],
          },
        });
      }
    };
    m.on("load", () => {
      ready = true;
      refresh.current();
    });
    return () => {
      m.remove();
      map.current = null;
    };
    // Initial map instance owns its listeners; latest.current supplies updated state.
  }, []);
  useEffect(() => {
    refresh.current();
    if (map.current) {
      const c = map.current.getCenter();
      if (
        Math.abs(c.lat - inputs.observer.lat) > 0.1 ||
        Math.abs(c.lng - inputs.observer.lon) > 0.1
      )
        map.current.easeTo({
          center: [inputs.observer.lon, inputs.observer.lat],
        });
    }
  }, [inputs, result]);
  return (
    <div className="map-shell">
      <div
        ref={div}
        className="map"
        aria-label="Karte: Beobachter und Zielpunkt setzen"
      />
      <div className="map-key">
        <span>● Beobachter</span>
        <span>● Ziel</span>
        <span>● Horizontpunkt</span>
      </div>
      <button
        className="map-reset"
        onClick={() =>
          map.current?.fitBounds(
            [
              [
                Math.min(
                  inputs.observer.lon,
                  destination(inputs.observer, inputs.azimuth, inputs.distance)
                    .lon,
                ),
                Math.min(
                  inputs.observer.lat,
                  destination(inputs.observer, inputs.azimuth, inputs.distance)
                    .lat,
                ),
              ],
              [
                Math.max(
                  inputs.observer.lon,
                  destination(inputs.observer, inputs.azimuth, inputs.distance)
                    .lon,
                ),
                Math.max(
                  inputs.observer.lat,
                  destination(inputs.observer, inputs.azimuth, inputs.distance)
                    .lat,
                ),
              ],
            ],
            { padding: 60, maxZoom: 14 },
          )
        }
      >
        Sichtlinie einpassen
      </button>
    </div>
  );
}
