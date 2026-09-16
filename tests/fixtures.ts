import { writeArrayBuffer } from "geotiff";
/** TEST ONLY. An analytical plane in a 1 km PixelIsArea grid. */
export function fixtureTIFF(id: string, resolution = 1, modelHeight = 300) {
  const [east, north] = id
      .split("_")
      .map(Number)
      .map((x) => x * 1000),
    width = Math.round(1000 / resolution);
  const values = new Float32Array(width * width);
  for (let row = 0; row < width; row++)
    for (let col = 0; col < width; col++)
      values[row * width + col] =
        modelHeight +
        (col + 0.5) * resolution * 0.001 +
        (width - row - 0.5) * resolution * 0.002;
  const metadata = {
    width,
    height: width,
    ModelPixelScale: [resolution, resolution, 0],
    ModelTiepoint: [0, 0, 0, east, north + 1000, 0],
    GTModelTypeGeoKey: 1,
    GTRasterTypeGeoKey: 1,
    ProjectedCSTypeGeoKey: 25832,
    ProjLinearUnitsGeoKey: 9001,
    GeogAngularUnitsGeoKey: 9102,
    GDAL_NODATA: "-9999",
  };
  return writeArrayBuffer(values, metadata);
}
