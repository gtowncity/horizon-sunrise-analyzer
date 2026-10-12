import { expect, test } from "vitest";
import { readBoundedArchive } from "../src/features/horizon360/bounded-download";
test("bounded transfer rejects oversized Content-Length before reading payload",async()=>{
  let cancelled=false;const body=new ReadableStream({cancel(){cancelled=true;}});
  await expect(readBoundedArchive(new Response(body,{headers:{"content-length":"100"}}),10)).rejects.toThrow("ARCHIVE_BUDGET");expect(cancelled).toBe(true);
});
test("unknown-length stream is cancelled at the byte bound, charged even when unsuccessful",async()=>{
  let cancelled=false,charged=0;
  const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(8));c.enqueue(new Uint8Array(8));},cancel(){cancelled=true;}});
  await expect(readBoundedArchive(new Response(body),10,n=>charged+=n)).rejects.toThrow("ARCHIVE_BUDGET");expect(cancelled).toBe(true);expect(charged).toBe(16);
});
test("exactly bounded stream returns complete bytes with no fallback",async()=>{
  const body=new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2]));c.enqueue(new Uint8Array([3]));c.close();}});
  expect(await readBoundedArchive(new Response(body),3)).toEqual(new Uint8Array([1,2,3]));
});
