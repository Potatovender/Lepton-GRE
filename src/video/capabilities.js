import { normalizeVideoOptions, VideoExportError } from "./options.js";

function candidateConfigs(options) {
  const base = { width: options.width, height: options.height, bitrate: options.bitrate,
    framerate: options.fps, hardwareAcceleration: "no-preference", latencyMode: "quality", alpha: "discard" };
  const codecs = options.format === "mp4"
    ? ["avc1.42001f", "avc1.420028", "avc1.420033", "avc1.42003e", "avc1.640028", "avc1.640033", "avc1.64003e"]
    : ["vp09.00.41.08", "vp09.00.51.08", "vp8"];
  return codecs.map((codec) => ({ ...base, codec, ...(options.format === "mp4" ? { avc: { format: "avc" } } : {}) }));
}

/** Always check the actual dimensions/rate/bitrate; browser detection is not a capability check. */
export async function probeVideoSupport(input, { VideoEncoder = globalThis.VideoEncoder,
  VideoFrame = globalThis.VideoFrame, signal } = {}) {
  const options = normalizeVideoOptions(input);
  signal?.throwIfAborted();
  if (typeof VideoEncoder?.isConfigSupported !== "function" || typeof VideoFrame !== "function") {
    return Object.freeze({ supported: false, format: options.format,
      reason: "This browser does not provide WebCodecs video encoding here. Try a current browser on HTTPS or localhost." });
  }
  const failures = [];
  for (const config of candidateConfigs(options)) {
    signal?.throwIfAborted();
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      signal?.throwIfAborted();
      if (support.supported) {
        const normalized = { ...support.config };
        if (normalized.avc) normalized.avc = Object.freeze({ ...normalized.avc });
        return Object.freeze({ supported: true, format: options.format,
          codec: config.codec.startsWith("avc1") ? "avc" : config.codec.startsWith("vp09") ? "vp9" : "vp8",
          config: Object.freeze(normalized) });
      }
    } catch (error) {
      signal?.throwIfAborted();
      failures.push(`${config.codec}: ${error.message}`);
    }
  }
  return Object.freeze({ supported: false, format: options.format,
    reason: `No supported ${options.format.toUpperCase()} encoder was found for ${options.width} x ${options.height} at ${options.fps} FPS. Try a different format, resolution, or frame rate.`,
    details: Object.freeze(failures) });
}

export async function requireVideoSupport(options, platform) {
  const result = await probeVideoSupport(options, platform);
  if (!result.supported) throw new VideoExportError("UNSUPPORTED_CODEC", result.reason);
  return result;
}
