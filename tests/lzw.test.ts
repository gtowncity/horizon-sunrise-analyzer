import { describe, expect, it } from "vitest";
import { getDecoder } from "geotiff";
import { decodeLzw } from "../src/data/lzw";

// Pack TIFF codewords (MSB first). Literal streams exercise every code width
// without relying on this implementation to create dictionary contents.
function pack(codes: number[]) {
  const bytes: number[] = [];
  let bits = 0,
    count = 0,
    width = 9,
    next = 258,
    previous = false;
  for (const code of codes) {
    bits = (bits << width) | code;
    count += width;
    while (count >= 8) {
      count -= 8;
      bytes.push((bits >>> count) & 255);
    }
    if (code === 256) {
      width = 9;
      next = 258;
      previous = false;
    } else if (code !== 257) {
      if (previous && next < 4096) {
        next++;
        if (width < 12 && next === (1 << width) - 1) width++;
      }
      previous = true;
    }
  }
  if (count) bytes.push((bits << (8 - count)) & 255);
  return new Uint8Array(bytes).buffer;
}

describe("bounded TIFF LZW decoder", () => {
  it.each([
    { codes: [256, 257], text: "" },
    { codes: [256, 65, 258, 259, 257], text: "AAAAAA" },
    { codes: [256, 65, 66, 258, 260, 257], text: "ABABABA" },
    { codes: [256, 256, 65, 256, 66, 257], text: "AB" },
  ])(
    "decodes clear codes and dictionary special cases: $text",
    async ({ codes, text }) => {
      const input = pack(codes),
        expected = new TextEncoder().encode(text);
      expect(new Uint8Array(decodeLzw(input, expected.length))).toEqual(
        expected,
      );
      const reference = await getDecoder(5, {
        tileWidth: expected.length,
        tileHeight: 1,
        predictor: 1,
        planarConfiguration: 1,
        bitsPerSample: [8],
      });
      expect(new Uint8Array(await reference.decode(input))).toEqual(expected);
    },
  );
  it.each([0, 3800])(
    "preserves random bytes across code widths, full tables and reset interval %s",
    async (resetEvery) => {
      let seed = 1729;
      const data = Array.from({ length: 12000 }, () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed >>> 24;
      });
      const codes = [256];
      for (let j = 0; j < data.length; j++) {
        if (j && resetEvery && j % resetEvery === 0) codes.push(256);
        codes.push(data[j]);
      }
      codes.push(257);
      const input = pack(codes),
        expected = new Uint8Array(data);
      expect(new Uint8Array(decodeLzw(input, data.length))).toEqual(expected);
      const reference = await getDecoder(5, {
        tileWidth: data.length,
        tileHeight: 1,
        predictor: 1,
        planarConfiguration: 1,
        bitsPerSample: [8],
      });
      expect(new Uint8Array(await reference.decode(input))).toEqual(expected);
    },
  );
  it("rejects truncation, invalid codes and output size mismatches", () => {
    expect(() => decodeLzw(new ArrayBuffer(0), 1)).toThrow("Truncated");
    expect(() => decodeLzw(pack([256, 259, 257]), 1)).toThrow("first");
    expect(() => decodeLzw(pack([256, 65, 300, 257]), 2)).toThrow("dictionary");
    expect(() => decodeLzw(pack([256, 65, 257]), 0)).toThrow("exceeds");
    expect(() => decodeLzw(pack([256, 65, 257]), 2)).toThrow("match");
    expect(() => decodeLzw(pack([256, 257]), Infinity)).toThrow("size");
  });
});
