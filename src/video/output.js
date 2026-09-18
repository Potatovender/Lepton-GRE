import { VideoExportError } from "./options.js";

const PAGE_SIZE = 64 * 1024;

/** Positioned writes preserve MP4/WebM header rewrites; concatenating chunks corrupts these files. */
export function createOutputStorage(target, mimeType, { WritableStream = globalThis.WritableStream,
  Blob = globalThis.Blob } = {}) {
  let writer = target.writable?.getWriter();
  let size = 0;
  let aborted = false;
  let sealed = false;
  const pages = new Map();
  const stream = new WritableStream({
    async write(chunk) {
      if (aborted) throw new VideoExportError("OUTPUT_CLOSED", "The export destination has been closed.");
      const { position, data } = chunk;
      const end = position + data?.byteLength;
      if (chunk.type !== "write" || !Number.isSafeInteger(position) || position < 0
          || !(data instanceof Uint8Array) || !Number.isSafeInteger(end)) {
        throw new VideoExportError("INVALID_WRITE", "The video muxer returned an invalid output write.");
      }
      if (end > target.maxBytes) {
        throw new VideoExportError("OUTPUT_BUDGET", "The encoded video exceeded the output-size budget. Lower the bitrate or duration, or export directly to a file.");
      }
      if (writer) {
        await writer.write({ type: "write", position, data });
      } else {
        for (let offset = 0; offset < data.length;) {
          const address = position + offset;
          const pageIndex = Math.floor(address / PAGE_SIZE);
          const pageOffset = address % PAGE_SIZE;
          let page = pages.get(pageIndex);
          if (!page) {
            page = new Uint8Array(Math.min(PAGE_SIZE, target.maxBytes - pageIndex * PAGE_SIZE));
            pages.set(pageIndex, page);
          }
          const count = Math.min(page.length - pageOffset, data.length - offset);
          page.set(data.subarray(offset, offset + count), pageOffset);
          offset += count;
        }
      }
      size = Math.max(size, end);
    },
    // Mediabunny also closes its stream on cancel. Only complete() may commit a user's file.
    close() { sealed = true; },
    abort() { aborted = true; pages.clear(); },
  }, { highWaterMark: 1 });
  return {
    stream,
    get size() { return size; },
    async complete() {
      if (!sealed || aborted) throw new VideoExportError("OUTPUT_INCOMPLETE", "The video container has not been finalized.");
      if (writer) {
        await writer.close();
        writer.releaseLock();
        writer = null;
        return null;
      }
      let data;
      if (target.kind === "arraybuffer") {
        const result = new Uint8Array(size);
        for (const [index, page] of pages) result.set(page.subarray(0, Math.min(page.length, size - index * PAGE_SIZE)), index * PAGE_SIZE);
        data = result.buffer;
      } else {
        const parts = [];
        for (let position = 0; position < size; position += PAGE_SIZE) {
          const length = Math.min(PAGE_SIZE, size - position);
          const page = pages.get(position / PAGE_SIZE);
          parts.push(page ? page.subarray(0, length) : new Uint8Array(length));
        }
        data = new Blob(parts, { type: mimeType });
      }
      pages.clear();
      return data;
    },
    async abort(reason) {
      aborted = true;
      pages.clear();
      if (writer) {
        try { await writer.abort(reason); } finally { writer.releaseLock(); writer = null; }
      }
    },
  };
}
