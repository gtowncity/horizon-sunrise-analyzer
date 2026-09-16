/** TEST ONLY: uncompressed native Float32 GeoTIFF with configurable tile sizes. */
export function tiledFixture(
  id: string,
  tileWidth = 128,
  tileHeight = 64,
  missing = false,
) {
  const [east, north] = id
    .split("_")
    .map(Number)
    .map((v) => v * 1000);
  const width = 1000,
    height = 1000,
    nx = Math.ceil(width / tileWidth),
    ny = Math.ceil(height / tileHeight),
    count = nx * ny;
  const pixelsPerTile = tileWidth * tileHeight;
  const tags: [number, number, number[] | string][] = [
    [256, 4, [width]],
    [257, 4, [height]],
    [258, 3, [32]],
    [259, 3, [1]],
    [262, 3, [1]],
    [277, 3, [1]],
    [284, 3, [1]],
    [322, 4, [tileWidth]],
    [323, 4, [tileHeight]],
    [324, 4, Array(count).fill(0)],
    [325, 4, Array(count).fill(pixelsPerTile * 4)],
    [339, 3, [3]],
    [33550, 12, [1, 1, 0]],
    [33922, 12, [0, 0, 0, east, north + 1000, 0]],
    [
      34735,
      3,
      [
        1, 1, 0, 4, 1024, 0, 1, 1, 1025, 0, 1, 1, 3072, 0, 1, 25832, 3076, 0, 1,
        9001,
      ],
    ],
    [42113, 2, "-9999\0"],
  ];
  const size = (type: number) =>
    type === 12 ? 8 : type === 4 ? 4 : type === 3 ? 2 : 1;
  let pos = 8 + 2 + tags.length * 12 + 4;
  const locations = tags.map(([, type, v]) => {
    if (v.length * size(type) <= 4) return 0;
    pos = Math.ceil(pos / 8) * 8;
    const p = pos;
    pos += v.length * size(type);
    return p;
  });
  pos = Math.ceil(pos / 8) * 8;
  tags.find((t) => t[0] === 324)![2] = Array.from(
    { length: count },
    (_, j) => pos + j * pixelsPerTile * 4,
  );
  const buffer = new ArrayBuffer(pos + count * pixelsPerTile * 4),
    view = new DataView(buffer);
  view.setUint16(0, 0x4949, true);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, tags.length, true);
  tags.forEach(([tag, type, v], j) => {
    const at = 10 + j * 12;
    view.setUint16(at, tag, true);
    view.setUint16(at + 2, type, true);
    view.setUint32(at + 4, v.length, true);
    const target = locations[j] || at + 8;
    if (locations[j]) view.setUint32(at + 8, target, true);
    for (let n = 0; n < v.length; n++) {
      const value = typeof v === "string" ? v.charCodeAt(n) : v[n],
        p = target + n * size(type);
      if (type === 12) view.setFloat64(p, value, true);
      else if (type === 4) view.setUint32(p, value, true);
      else if (type === 3) view.setUint16(p, value, true);
      else view.setUint8(p, value);
    }
  });
  const data = new Float32Array(buffer, pos);
  for (let by = 0; by < ny; by++)
    for (let bx = 0; bx < nx; bx++)
      for (let y = 0; y < tileHeight; y++)
        for (let x = 0; x < tileWidth; x++) {
          const col = bx * tileWidth + x,
            row = by * tileHeight + y,
            index = (by * nx + bx) * pixelsPerTile + y * tileWidth + x;
          data[index] =
            col >= width || row >= height || (missing && col === 1 && row === 0)
              ? -9999
              : 300 + col * 0.01 + row * 0.001;
        }
  return buffer;
}
