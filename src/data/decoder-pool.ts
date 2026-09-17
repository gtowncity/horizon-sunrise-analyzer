import { decodeLzw } from "./lzw";
import type { BlockDecoder } from "./native-block";

type Job = {
  id: number;
  buffer: ArrayBuffer;
  bytes: number;
  resolve: (value: ArrayBuffer) => void;
  reject: (error: Error) => void;
};
type Slot = { worker: Worker; job?: Job };

/** Bounded pool. Small strips stay inline to avoid worker message overhead. */
export class DecoderPool implements BlockDecoder {
  private slots: Slot[] = [];
  private queue: Job[] = [];
  private nextId = 0;
  private stopped?: Error;
  cpuMs = 0;
  jobs = 0;
  workerJobs = 0;

  constructor(
    size = 0,
    createWorker = () =>
      new Worker(new URL("./decode.worker.ts", import.meta.url), {
        type: "module",
      }),
  ) {
    if (!Number.isInteger(size) || size < 0 || size > 4)
      throw new Error("Invalid decoder pool size");
    try {
      for (let j = 0; j < size; j++) {
        const slot: Slot = { worker: createWorker() };
        this.slots.push(slot);
        slot.worker.onmessage = (
          event: MessageEvent<{
            id: number;
            decoded?: ArrayBuffer;
            cpuMs?: number;
            error?: string;
          }>,
        ) => {
          const job = slot.job;
          if (!job || job.id !== event.data.id) {
            this.stop(new Error("Unexpected decoder reply"));
            return;
          }
          slot.job = undefined;
          if (event.data.error) {
            job.reject(new Error(event.data.error));
          } else if (
            !(event.data.decoded instanceof ArrayBuffer) ||
            event.data.decoded.byteLength !== job.bytes
          ) {
            job.reject(new Error("Invalid decoded raster block"));
          } else {
            this.cpuMs += event.data.cpuMs ?? 0;
            job.resolve(event.data.decoded);
          }
          this.drain();
        };
        slot.worker.onerror = (event) =>
          this.stop(new Error(event.message || "Decoder worker failed"));
        slot.worker.onmessageerror = () =>
          this.stop(new Error("Decoder message could not be read"));
      }
    } catch (error) {
      this.stop(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async decode(buffer: ArrayBufferLike, bytes: number): Promise<ArrayBuffer> {
    if (this.stopped) throw this.stopped;
    this.jobs++;
    if (!this.slots.length || bytes < 32 * 1024) {
      const start = performance.now();
      const output = decodeLzw(buffer, bytes);
      this.cpuMs += performance.now() - start;
      return output;
    }
    if (this.queue.length >= 16)
      throw new Error("Decoder queue limit exceeded");
    if (!(buffer instanceof ArrayBuffer))
      throw new Error("Expected transferable raster data");
    this.workerJobs++;
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, buffer, bytes, resolve, reject });
      this.drain();
    });
  }

  private drain() {
    if (this.stopped) return;
    for (const slot of this.slots) {
      if (slot.job || !this.queue.length) continue;
      const job = this.queue.shift()!;
      slot.job = job;
      try {
        slot.worker.postMessage(
          { id: job.id, buffer: job.buffer, bytes: job.bytes },
          [job.buffer],
        );
      } catch (error) {
        this.stop(error instanceof Error ? error : new Error(String(error)));
        return;
      }
    }
  }

  private stop(error: Error) {
    if (this.stopped) return;
    this.stopped = error;
    for (const slot of this.slots) {
      slot.worker.terminate();
      slot.job?.reject(error);
      slot.job = undefined;
    }
    for (const job of this.queue.splice(0)) job.reject(error);
    this.slots = [];
  }

  dispose() {
    this.stop(new Error("Decoder pool closed"));
  }
}
