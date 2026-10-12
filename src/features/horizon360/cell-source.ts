import { NativeBlockReader } from "../../data/native-block";
import { openTile, type officialZip } from "../../data/provider";
import type { TileCache } from "../../data/cache";
import type { Model, TileRecord } from "../../core/types";
import type { CellSource, CellStream, RasterCell } from "./raster-sectors";

/** Original pixels, never bilinear heights masquerading as independent cell values. */
export class NativeCellSource implements CellSource {
  records = new Map<string, TileRecord>();
  metrics = { blocksDecoded: 0, peakBlockBytes: 0, sourceOpens: 0 };
  private reader = new NativeBlockReader();
  constructor(
    private cache: TileCache,
    private load: typeof officialZip,
  ) {}
  stream(model: Model, x: number, y: number, radius: number): CellStream {
    const errors: string[] = [];
    let complete = false;
    const { cache, load, reader, records, metrics } = this;
    async function* cells(): AsyncGenerator<RasterCell> {
      const res = model === "dgm1" ? 1 : 0.2;
      // Explicit projected disk. Cells touching its closed boundary are included.
      const minX = x - radius - res,
        maxX = x + radius + res,
        minY = y - radius - res,
        maxY = y + radius + res;
      for (
        let tx = Math.floor(minX / 1000);
        tx <= Math.floor(maxX / 1000);
        tx++
      )
        for (
          let ty = Math.floor(minY / 1000);
          ty <= Math.floor(maxY / 1000);
          ty++
        ) {
          const id = `${tx}_${ty}`,
            key = model + ":" + id;
          let tile;
          try {
            const entry =
              (await cache.getSource?.(key)) ??
              (await cache.get(key)) ??
              (await load(model, id));
            tile = await openTile(entry);
            records.set(key, tile.record);
            metrics.sourceOpens++;
          } catch (e) {
            errors.push(e instanceof Error ? e.message : "CELL_SOURCE_ERROR");
            return;
          }
          const tw = tile.image.getTileWidth(),
            th = tile.image.getTileHeight();
          const left = Math.max(0, Math.floor((minX - tile.ox) / res)),
            right = Math.min(tile.width, Math.ceil((maxX - tile.ox) / res));
          const top = Math.max(0, Math.floor((tile.oy - maxY) / res)),
            bottom = Math.min(tile.height, Math.ceil((tile.oy - minY) / res));
          if (left >= right || top >= bottom) continue;
          for (
            let by = Math.floor(top / th);
            by <= Math.floor((bottom - 1) / th);
            by++
          )
            for (
              let bx = Math.floor(left / tw);
              bx <= Math.floor((right - 1) / tw);
              bx++
            ) {
              let data: Float32Array;
              try {
                data = await reader.read(tile.image, bx, by);
              } catch (e) {
                errors.push(
                  e instanceof Error ? e.message : "CELL_BLOCK_ERROR",
                );
                return;
              }
              metrics.blocksDecoded++;
              metrics.peakBlockBytes = Math.max(
                metrics.peakBlockBytes,
                data.byteLength,
              );
              const width = Math.min(tw, tile.width - bx * tw);
              for (
                let row = Math.max(top, by * th);
                row < Math.min(bottom, (by + 1) * th);
                row++
              )
                for (
                  let col = Math.max(left, bx * tw);
                  col < Math.min(right, (bx + 1) * tw);
                  col++
                ) {
                  const cx = tile.ox + (col + 0.5) * res,
                    cy = tile.oy - (row + 0.5) * res;
                  // Each native value can contribute to bilinear interpolation up to
                  // one whole pixel spacing on either side of its center. Using only
                  // the PixelIsArea half-width would fail to enclose that support.
                  const dx = Math.max(0, Math.abs(cx - x) - res),
                    dy = Math.max(0, Math.abs(cy - y) - res);
                  if (Math.hypot(dx, dy) > radius) continue;
                  const h = data[(row - by * th) * width + col - bx * tw];
                  yield {
                    x: cx,
                    y: cy,
                    size: 2 * res,
                    pixelResolution: res,
                    height: !Number.isFinite(h) || h === tile.nodata ? null : h,
                    tile: id,
                  };
                }
            }
        }
      complete = true;
    }
    return { cells: cells(), complete: () => complete, errors };
  }
}
