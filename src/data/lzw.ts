/** TIFF 6.0 MSB-first LZW, with early code-width changes. No numeric conversion. */
export function decodeLzw(
  input: ArrayBufferLike,
  expectedBytes: number,
): ArrayBuffer {
  if (
    !Number.isSafeInteger(expectedBytes) ||
    expectedBytes < 0 ||
    expectedBytes > 150 * 1024 * 1024
  )
    throw new Error("Invalid LZW output size");
  const source = new Uint8Array(input);
  const output = new Uint8Array(expectedBytes);
  const prefix = new Uint16Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4096);
  let byte = 0,
    accumulator = 0,
    available = 0,
    width = 9;
  let next = 258,
    previous = -1,
    first = 0,
    written = 0;
  const read = () => {
    while (available < width) {
      if (byte >= source.length) throw new Error("Truncated LZW stream");
      accumulator = (accumulator << 8) | source[byte++];
      available += 8;
    }
    available -= width;
    return (accumulator >>> available) & ((1 << width) - 1);
  };
  while (true) {
    const code = read();
    if (code === 257) break;
    if (code === 256) {
      next = 258;
      width = 9;
      previous = -1;
      continue;
    }
    if (previous < 0) {
      if (code > 255) throw new Error("Invalid first LZW code");
      if (written >= output.length)
        throw new Error("LZW output exceeds raster size");
      output[written++] = code;
      previous = code;
      first = code;
      continue;
    }
    let current = code,
      length = 0;
    if (current === next && next < 4096) {
      stack[length++] = first;
      current = previous;
    } else if (current >= next) {
      throw new Error("Invalid LZW dictionary code");
    }
    while (current >= 258) {
      if (current >= next || length >= stack.length - 1)
        throw new Error("Invalid LZW dictionary chain");
      stack[length++] = suffix[current];
      current = prefix[current];
    }
    if (current > 255) throw new Error("Invalid LZW dictionary root");
    first = current;
    stack[length++] = first;
    if (written + length > output.length)
      throw new Error("LZW output exceeds raster size");
    while (length) output[written++] = stack[--length];
    if (next < 4096) {
      prefix[next] = previous;
      suffix[next] = first;
      next++;
      if (width < 12 && next === (1 << width) - 1) width++;
    }
    previous = code;
  }
  if (written !== expectedBytes)
    throw new Error("LZW output does not match raster size");
  return output.buffer;
}
