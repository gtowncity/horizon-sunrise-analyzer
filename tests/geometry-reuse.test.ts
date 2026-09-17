import { expect, it } from "vitest";
import proj4 from "proj4";
import {
  destination,
  destinationAlong,
  toUTM,
  fromUTM,
  UTM32,
} from "../src/core/geo";

it("reused geodesic coefficients preserve every returned coordinate exactly", () => {
  for (const lat of [47, 48.25, 51])
    for (const azimuth of [0, 0.01, 87.3, 90, 180, 270, 359.99, 360]) {
      const p = { lat, lon: 11.75 },
        locate = destinationAlong(p, azimuth);
      for (const distance of [
        0, 0.2, 1, 1.75, 128.25, 2091.5, 10000, 59999, 80000,
      ])
        expect(locate(distance)).toEqual(destination(p, azimuth, distance));
    }
});

it("prepared projection preserves the previous forward and inverse operations exactly", () => {
  for (const lat of [47, 48.25, 51])
    for (const lon of [8.5, 11.75, 14.1]) {
      const xy = proj4("EPSG:4326", UTM32, [lon, lat]);
      expect(toUTM({ lat, lon })).toEqual(xy);
      const expected = proj4(UTM32, "EPSG:4326", xy);
      expect(fromUTM(xy[0], xy[1])).toEqual({
        lat: expected[1],
        lon: expected[0],
      });
    }
});
