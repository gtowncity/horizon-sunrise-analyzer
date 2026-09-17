import type { GeoTIFFImage } from "geotiff";
import { decodeLzw } from "./lzw";

export interface BlockDecoder {
  decode(buffer: ArrayBufferLike, bytes: number): Promise<ArrayBufferLike>;
}

const hostLittleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/** Narrow fast path; all other TIFF encodings retain the library's reader. */
export class NativeBlockReader {
  private prepared = new WeakMap<GeoTIFFImage, Promise<number | undefined>>();
  constructor(
    private decoder: BlockDecoder = {
      decode: async (buffer, bytes) => decodeLzw(buffer, bytes),
    },
  ) {}

  private prepare(image: GeoTIFFImage) {
    let pending = this.prepared.get(image);
    if (!pending) {
      pending = (async () => {
        if (
          image.getSamplesPerPixel() !== 1 ||
          image.getSampleFormat() !== 3 ||
          image.getBitsPerSample() !== 32 ||
          image.littleEndian !== hostLittleEndian
        )
          return undefined;
        const directory = image.getFileDirectory();
        const compression = Number(
          (await directory.loadValue("Compression")) ?? 1,
        );
        const predictor = Number((await directory.loadValue("Predictor")) ?? 1);
        if (![1, 5].includes(compression) || predictor !== 1) return undefined;
        // Preload small block tables, not arbitrarily large imported directories.
        const blockCount =
          Math.ceil(image.getWidth() / image.getTileWidth()) *
          Math.ceil(image.getHeight() / image.getTileHeight());
        if (blockCount <= 65536)
          await Promise.all(
            (image.isTiled
              ? (["TileOffsets", "TileByteCounts"] as const)
              : (["StripOffsets", "StripByteCounts"] as const)
            ).map((tag) => directory.loadValue(tag)),
          );
        return compression;
      })();
      this.prepared.set(image, pending);
    }
    return pending;
  }

  async read(
    image: GeoTIFFImage,
    bx: number,
    by: number,
  ): Promise<Float32Array> {
    const tw = image.getTileWidth(),
      th = image.getTileHeight();
    const width = Math.min(tw, image.getWidth() - bx * tw);
    const height = Math.min(th, image.getHeight() - by * th);
    const compression = await this.prepare(image);
    const expected = tw * image.getBlockHeight(by) * 4;
    // Some writers pad the final strip. Keep the library path for that layout.
    if (
      compression === undefined ||
      expected > 150 * 1024 * 1024 ||
      (!image.isTiled && image.getBlockHeight(by) !== th)
    ) {
      const raster = await image.readRasters({
        samples: [0],
        interleave: true,
        window: [bx * tw, by * th, bx * tw + width, by * th + height],
      });
      return raster instanceof Float32Array
        ? raster
        : Float32Array.from(raster);
    }
    const block = await image.getTileOrStrip(bx, by, 0, {
      decode: async (buffer) =>
        compression === 5 ? this.decoder.decode(buffer, expected) : buffer,
    });
    if (block.data.byteLength < expected)
      throw new Error("Rasterblock hat eine unerwartete Größe");
    const values = new Float32Array(block.data, 0, expected / 4);
    if (width === tw && height * width === values.length) return values;
    // Edge tiles may contain padding outside the actual image dimensions.
    const clipped = new Float32Array(width * height);
    for (let row = 0; row < height; row++)
      clipped.set(values.subarray(row * tw, row * tw + width), row * width);
    return clipped;
  }
}
