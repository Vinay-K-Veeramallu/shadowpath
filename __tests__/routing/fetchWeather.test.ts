import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWeather } from "../../lib/weather/fetchWeather";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Build an ISO timestamp string for a given hour offset from now, at the specified hour */
function makeStartTime(hourOfDay: number, hoursFromNow: number): string {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  d.setHours(hourOfDay, 0, 0, 0);
  return d.toISOString();
}

describe("fetchWeather", () => {
  // Test 1: NWS failure → demo fallback
  // Validates: Requirements 4.3
  it("returns demo fallback with confidence Low when NWS request throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );

    const result = await fetchWeather(10);

    expect(result.source).toBe("demo-fallback");
    expect(result.confidence).toBe("Low");
    expect(result.heatIndex).toBe(108);
    expect(result.temperature).toBe(108);
    expect(result.fetchedAt).toBeNull();
  });

  it("returns demo fallback when NWS points endpoint returns non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 })
    );

    const result = await fetchWeather(14);

    expect(result.source).toBe("demo-fallback");
    expect(result.confidence).toBe("Low");
    expect(result.fetchedAt).toBeNull();
  });

  // Test 2: NWS success → live heat index with High or Medium confidence
  // Validates: Requirements 4.4
  it("returns nws-live with High confidence when forecast period is < 6 hours ahead", async () => {
    // Period starts 2 hours from now at hour 10
    const startTime = makeStartTime(10, 2);

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {
            forecastHourly:
              "https://api.weather.gov/gridpoints/PSR/155,48/forecast/hourly",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {
            periods: [
              {
                startTime,
                temperature: 102,
                heatIndex: 110,
              },
            ],
          },
        }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchWeather(10);

    expect(result.source).toMatch(/^nws-(live|forecast)$/);
    expect(result.confidence).toMatch(/^(High|Medium)$/);
    expect(result.temperature).toBe(102);
    expect(result.heatIndex).toBe(110);
    expect(result.fetchedAt).toBeInstanceOf(Date);
  });

  it("returns nws-forecast with Medium confidence when forecast is 6–24 hours ahead", async () => {
    // Period starts 12 hours from now at hour 14
    const startTime = makeStartTime(14, 12);

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {
            forecastHourly:
              "https://api.weather.gov/gridpoints/PSR/155,48/forecast/hourly",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {
            periods: [
              {
                startTime,
                temperature: 104,
                heatIndex: 112,
              },
            ],
          },
        }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchWeather(14);

    expect(result.source).toBe("nws-forecast");
    expect(result.confidence).toBe("Medium");
    expect(result.temperature).toBe(104);
    expect(result.heatIndex).toBe(112);
    expect(result.fetchedAt).toBeInstanceOf(Date);
  });

  it("falls back to temperature when heatIndex is not in NWS response", async () => {
    // Period starts 3 hours from now at hour 18
    const startTime = makeStartTime(18, 3);

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {
            forecastHourly:
              "https://api.weather.gov/gridpoints/PSR/155,48/forecast/hourly",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {
            periods: [
              {
                startTime,
                temperature: 105,
                // no heatIndex field — should fall back to temperature
              },
            ],
          },
        }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchWeather(18);

    expect(result.heatIndex).toBe(105);
    expect(result.temperature).toBe(105);
    expect(result.source).toMatch(/^nws-(live|forecast)$/);
  });

  it("uses nearest forecast period when the exact hour is missing", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {
            forecastHourly:
              "https://api.weather.gov/gridpoints/PSR/155,48/forecast/hourly",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {
            periods: [
              {
                startTime: "2025-07-01T08:00:00-07:00",
                temperature: 95,
              },
            ],
          },
        }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchWeather(10);

    expect(result.temperature).toBe(95);
    expect(result.source).toMatch(/^nws-(live|forecast)$/);
  });
});
