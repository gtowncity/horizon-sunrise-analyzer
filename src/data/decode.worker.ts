import { decodeLzw } from "./lzw";

self.onmessage = (
  event: MessageEvent<{ id: number; buffer: ArrayBuffer; bytes: number }>,
) => {
  const { id, buffer, bytes } = event.data;
  try {
    const started = performance.now();
    const decoded = decodeLzw(buffer, bytes);
    self.postMessage(
      { id, decoded, cpuMs: performance.now() - started },
      { transfer: [decoded] },
    );
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
