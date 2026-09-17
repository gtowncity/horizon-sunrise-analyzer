import { describe, expect, it } from "vitest";
import { fromArrayBuffer } from "geotiff";
import { NativeBlockReader } from "../src/data/native-block";

// Small independently generated TIFFs exercise byte order, numeric formats and
// padding. They are not restricted to the official source's usual Float32 LE.
function fixture(
  littleEndian: boolean,
  bits: 16 | 32 | 64,
  format: 1 | 3,
  strips = false,
) {
  const width = 17,
    height = 9,
    tw = strips ? 17 : 8,
    th = 4,
    count = strips ? 3 : 9;
  const tags: [number, number, number[]][] = [
    [256, 4, [width]],
    [257, 4, [height]],
    [258, 3, [bits]],
    [259, 3, [1]],
    [262, 3, [1]],
    [277, 3, [1]],
    [284, 3, [1]],
    ...(strips ? [] : [[322, 4, [tw]] as [number, number, number[]]]),
    [strips ? 278 : 323, 4, [th]],
    [strips ? 273 : 324, 4, Array(count).fill(0)],
    [strips ? 279 : 325, 4, Array(count).fill((tw * th * bits) / 8)],
    [339, 3, [format]],
  ];
  let pos = 8 + 2 + tags.length * 12 + 4;
  const offsets = tags.map(([, type, values]) => {
    const bytes = values.length * (type === 3 ? 2 : 4);
    if (bytes <= 4) return 0;
    const offset = pos;
    pos += bytes;
    return offset;
  });
  pos = Math.ceil(pos / 8) * 8;
  tags.find(([tag]) => tag === (strips ? 273 : 324))![2] = Array.from(
    { length: count },
    (_, j) => pos + (j * tw * th * bits) / 8,
  );
  const data = new ArrayBuffer(pos + (count * tw * th * bits) / 8),
    view = new DataView(data);
  view.setUint16(0, littleEndian ? 0x4949 : 0x4d4d);
  view.setUint16(2, 42, littleEndian);
  view.setUint32(4, 8, littleEndian);
  view.setUint16(8, tags.length, littleEndian);
  tags.forEach(([tag, type, values], j) => {
    const at = 10 + j * 12;
    view.setUint16(at, tag, littleEndian);
    view.setUint16(at + 2, type, littleEndian);
    view.setUint32(at + 4, values.length, littleEndian);
    if (offsets[j]) view.setUint32(at + 8, offsets[j], littleEndian);
    for (let n = 0; n < values.length; n++) {
      const p = (offsets[j] || at + 8) + n * (type === 3 ? 2 : 4);
      if (type === 3) view.setUint16(p, values[n], littleEndian);
      else view.setUint32(p, values[n], littleEndian);
    }
  });
  for (let block = 0; block < count; block++)
    for (let y = 0; y < th; y++)
      for (let x = 0; x < tw; x++) {
        const index = block * tw * th + y * tw + x;
        const value = format === 1 ? index : (index - 100) / 7;
        const p = pos + (index * bits) / 8;
        if (bits === 16) view.setUint16(p, value, littleEndian);
        else if (bits === 32) view.setFloat32(p, value, littleEndian);
        else view.setFloat64(p, value, littleEndian);
      }
  return data;
}

describe("exact native block access", () => {
  it("preserves padded final strips", async () => {
    const image = await (
      await fromArrayBuffer(fixture(true, 32, 3, true))
    ).getImage();
    const reader = new NativeBlockReader();
    for (let y = 0; y < 3; y++) {
      const expected = await image.readRasters({
        samples: [0],
        interleave: true,
        window: [0, y * 4, 17, Math.min(y * 4 + 4, 9)],
      });
      expect(Array.from(await reader.read(image, 0, y))).toEqual(
        Array.from(expected),
      );
    }
  });
  it.each([
    [true, 32, 3],
    [false, 32, 3],
    [true, 16, 1],
    [false, 16, 1],
    [true, 64, 3],
    [false, 64, 3],
  ] as const)(
    "matches all edge pixels: littleEndian=%s bits=%s format=%s",
    async (littleEndian, bits, format) => {
      const image = await (
        await fromArrayBuffer(fixture(littleEndian, bits, format))
      ).getImage();
      const reader = new NativeBlockReader();
      for (let y = 0; y < 3; y++)
        for (let x = 0; x < 3; x++) {
          const expected = await image.readRasters({
            samples: [0],
            interleave: true,
            window: [
              x * 8,
              y * 4,
              Math.min(x * 8 + 8, 17),
              Math.min(y * 4 + 4, 9),
            ],
          });
          expect(Array.from(await reader.read(image, x, y))).toEqual(
            Array.from(Float32Array.from(expected)),
          );
        }
    },
  );
});
