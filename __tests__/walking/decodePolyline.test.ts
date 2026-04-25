import { describe, it, expect } from "vitest";
import { decodeGooglePolyline } from "../../lib/walking/decodePolyline";

describe("decodeGooglePolyline", () => {
  it("decodes a short known polyline", () => {
    // "_p~iF~ps|U_ulLnnqC_mqNvxq`@" encodes a zig-zag; spot-check first coordinate pair.
    const line = decodeGooglePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(line.type).toBe("LineString");
    expect(line.coordinates.length).toBeGreaterThan(1);
    const [lng, lat] = line.coordinates[0];
    expect(typeof lng).toBe("number");
    expect(typeof lat).toBe("number");
    expect(Math.abs(lng)).toBeLessThanOrEqual(180);
    expect(Math.abs(lat)).toBeLessThanOrEqual(90);
  });
});
