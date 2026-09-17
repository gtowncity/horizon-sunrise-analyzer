import { describe, expect, it, vi } from "vitest";
import { DecoderPool } from "../src/data/decoder-pool";

class TestWorker {
  onmessage: Worker["onmessage"] = null;
  onerror: Worker["onerror"] = null;
  onmessageerror: Worker["onmessageerror"] = null;
  terminate = vi.fn();
  messages: { id: number; bytes: number; buffer: ArrayBuffer }[] = [];
  postMessage(
    message: { id: number; bytes: number; buffer: ArrayBuffer },
    transfer: Transferable[],
  ) {
    this.messages.push(structuredClone(message, { transfer }));
  }
  reply(badSize = false) {
    const job = this.messages.shift()!;
    this.onmessage?.call(
      this as unknown as Worker,
      {
        data: {
          id: job.id,
          decoded: new ArrayBuffer(badSize ? 1 : job.bytes),
          cpuMs: 0.5,
        },
      } as MessageEvent,
    );
  }
}
const create = (workers: TestWorker[]) => () => {
  const worker = new TestWorker();
  workers.push(worker);
  return worker as unknown as Worker;
};

describe("bounded decoder worker lifecycle", () => {
  it("transfers ownership, limits active jobs and drains queued jobs", async () => {
    const workers: TestWorker[] = [];
    const pool = new DecoderPool(2, create(workers));
    const buffers = Array.from({ length: 5 }, () => new ArrayBuffer(20));
    const pending = buffers.map((buffer) => pool.decode(buffer, 65536));
    expect(buffers.slice(0, 2).map((b) => b.byteLength)).toEqual([0, 0]);
    expect(workers.map((w) => w.messages.length)).toEqual([1, 1]);
    for (let j = 0; j < 5; j++) workers.find((w) => w.messages.length)!.reply();
    expect((await Promise.all(pending)).map((b) => b.byteLength)).toEqual(
      Array(5).fill(65536),
    );
    expect(pool.workerJobs).toBe(5);
    expect(pool.cpuMs).toBe(2.5);
    pool.dispose();
    for (const worker of workers)
      expect(worker.terminate).toHaveBeenCalledOnce();
    await expect(pool.decode(new ArrayBuffer(0), 0)).rejects.toThrow("closed");
  });

  it.each(["dispose", "error", "messageerror"])(
    "rejects active and queued work on %s",
    async (cause) => {
      const workers: TestWorker[] = [];
      const pool = new DecoderPool(1, create(workers));
      const all = Promise.allSettled(
        Array.from({ length: 3 }, () => pool.decode(new ArrayBuffer(8), 65536)),
      );
      if (cause === "dispose") pool.dispose();
      else if (cause === "error")
        workers[0].onerror?.call(
          workers[0] as unknown as Worker,
          { message: "failed" } as ErrorEvent,
        );
      else
        workers[0].onmessageerror?.call(
          workers[0] as unknown as Worker,
          {} as MessageEvent,
        );
      expect((await all).map((r) => r.status)).toEqual([
        "rejected",
        "rejected",
        "rejected",
      ]);
      expect(workers[0].terminate).toHaveBeenCalledOnce();
    },
  );

  it("rejects incorrect worker output without returning a partial raster", async () => {
    const workers: TestWorker[] = [];
    const pool = new DecoderPool(1, create(workers));
    const pending = pool.decode(new ArrayBuffer(8), 65536);
    workers[0].reply(true);
    await expect(pending).rejects.toThrow("Invalid decoded");
    pool.dispose();
  });

  it("cleans up workers when pool construction fails", () => {
    const worker = new TestWorker();
    let calls = 0;
    expect(
      () =>
        new DecoderPool(2, () => {
          if (calls++) throw new Error("worker unavailable");
          return worker as unknown as Worker;
        }),
    ).toThrow("unavailable");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
