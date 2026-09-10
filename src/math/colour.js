// Both colour models share IDs and reference handling; only their channels differ.
export function colourChannelKeys(entry) {
  return entry?.model === "hsv" ? ["hue", "saturation", "value"] : ["red", "green", "blue"];
}

// Hue is in degrees. Return RGB in Lepton's existing 0..255 channel units.
export function hsvToRgb(hue, saturation, value) {
  if (![hue, saturation, value].every(Number.isFinite)) return [0, 0, 0];
  const h = ((hue % 360) + 360) % 360 / 60;
  const s = Math.max(0, Math.min(1, saturation));
  const v = Math.max(0, Math.min(1, value));
  const component = (offset) => {
    const k = (h + offset) % 6;
    return 255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return [component(5), component(3), component(1)];
}

export const HSV_GLSL = `
    vec3 leptonHsvToRgb(vec3 hsv) {
      float h = mod(hsv.x, 360.0) / 60.0;
      float s = clamp(hsv.y, 0.0, 1.0);
      float v = clamp(hsv.z, 0.0, 1.0);
      vec3 k = mod(vec3(h) + vec3(5.0, 3.0, 1.0), 6.0);
      return v * (1.0 - s * clamp(min(k, 4.0 - k), 0.0, 1.0));
    }
`;
