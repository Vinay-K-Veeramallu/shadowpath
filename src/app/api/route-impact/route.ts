import { NextRequest, NextResponse } from "next/server";

interface RouteImpactPayload {
  weather: {
    temperature: number;
    heatIndex: number;
    relativeHumidity: number;
    cloudCoverPct: number;
    shortForecast: string;
  };
  route: {
    durationMin: number;
    selectedShadePct: number;
    baselineShadePct: number;
    sunExposureMinAvoided: number;
    heatLoadAvoided: number;
    reductionPct: number;
  };
  /** Trip frequency assumed for annualized framing — UI passes "trips per week". */
  tripsPerWeek?: number;
}

export interface ImpactTile {
  id: string;
  label: string;
  /** Headline value e.g. "-32%" or "$48/yr". */
  headline: string;
  /** Short follow-up sentence (max ~22 words). */
  description: string;
  /** Visual category for color/icon. */
  category: "personal" | "infrastructure" | "environment" | "longterm";
  icon: string;
  /** Optional confidence/qualifier badge like "modeled", "directional". */
  badge?: string;
}

interface ImpactResponse {
  source: "gemini" | "gemini-error" | "gemini-unavailable" | "fallback";
  headline: string;
  summary: string;
  tiles: ImpactTile[];
}

/**
 * Local heuristic fallback — used when LLM is unavailable or returns garbage.
 * The numbers are intentionally directional (relative comparison vs least-shaded route),
 * not absolute medical/engineering claims.
 */
function fallbackImpact(payload: RouteImpactPayload): ImpactResponse {
  const { route, weather } = payload;
  const tripsPerWeek = payload.tripsPerWeek ?? 5;
  const tripsPerYear = tripsPerWeek * 52;
  const annualSunMinAvoided = Math.max(0, route.sunExposureMinAvoided) * tripsPerYear;
  // Rough sunscreen math: ~0.25 g per arm/face/neck combined per 30 min sun, ~$0.05/g.
  const sunscreenSavingsUsd = Math.round((annualSunMinAvoided / 30) * 0.25 * 0.05);
  // Hydration: extra ~50 mL water per minute of direct sun above baseline; bottles ≈ 500 mL.
  const bottlesAvoided = Math.round((route.sunExposureMinAvoided * 50) / 500);

  const tiles: ImpactTile[] = [
    {
      id: "heat-strain",
      label: "Heat strain",
      headline: `-${route.reductionPct}%`,
      description: `Lower estimated body-heat load vs the least-shaded path (${weather.heatIndex.toFixed(0)}°F feels-like).`,
      category: "personal",
      icon: "🌡️",
      badge: "modeled",
    },
    {
      id: "uv-exposure",
      label: "Direct UV avoided",
      headline: `${Math.round(route.sunExposureMinAvoided)} min`,
      description: "Less direct sun on this trip can reduce same-day UV burden and cumulative skin aging.",
      category: "longterm",
      icon: "☀️",
    },
    {
      id: "sunscreen",
      label: "Sunscreen / yr",
      headline: `~$${sunscreenSavingsUsd}`,
      description: `Across ~${tripsPerWeek} trips/week, less direct sun can mean lower sunscreen reapplication needs.`,
      category: "personal",
      icon: "🧴",
      badge: "directional",
    },
    {
      id: "hydration",
      label: "Water saved",
      headline: `~${bottlesAvoided} bottles`,
      description: "Lower sweat-loss estimate over the trip — keep drinking water regardless.",
      category: "personal",
      icon: "💧",
      badge: "directional",
    },
    {
      id: "cooling-demand",
      label: "AC load on arrival",
      headline: `-${Math.min(60, Math.round(route.reductionPct * 0.55))}%`,
      description: "Cooler arrival means HVAC works less to bring you back to baseline indoors.",
      category: "infrastructure",
      icon: "❄️",
      badge: "modeled",
    },
    {
      id: "emissions",
      label: "Emissions pressure",
      headline: `-${Math.min(50, Math.round(route.reductionPct * 0.5))}%`,
      description: "Lower cooling demand reduces grid-tied CO₂e pressure during peak Phoenix hours.",
      category: "environment",
      icon: "🌱",
      badge: "directional",
    },
    {
      id: "heatstroke-risk",
      label: "Heat-illness risk",
      headline: weather.heatIndex >= 100 ? "meaningfully lower" : "modestly lower",
      description: "Shaded routing reduces dehydration + core-temp drift, two key heat-illness drivers.",
      category: "personal",
      icon: "🩺",
      badge: "qualitative",
    },
    {
      id: "productivity",
      label: "Cognitive load",
      headline: "lower",
      description: "Arriving cooler and less depleted can support better focus in your next class or meeting.",
      category: "longterm",
      icon: "🧠",
      badge: "qualitative",
    },
  ];

  return {
    source: "fallback",
    headline: `Choosing this path may avoid ~${Math.round(route.sunExposureMinAvoided)} min of direct sun.`,
    summary:
      "Estimates are directional comparisons vs the least-shaded option for the same trip — not medical or carbon-accounting claims.",
    tiles,
  };
}

function safeJsonParse<T>(raw: string): T | null {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

function sanitizeTiles(raw: unknown): ImpactTile[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t): ImpactTile | null => {
      if (!t || typeof t !== "object") return null;
      const obj = t as Record<string, unknown>;
      const id = typeof obj.id === "string" ? obj.id : "";
      const label = typeof obj.label === "string" ? obj.label : "";
      const headline = typeof obj.headline === "string" ? obj.headline : "";
      const description = typeof obj.description === "string" ? obj.description : "";
      const category = obj.category as ImpactTile["category"];
      const icon = typeof obj.icon === "string" ? obj.icon : "✨";
      const badge = typeof obj.badge === "string" ? obj.badge : undefined;
      if (!id || !label || !headline || !description) return null;
      const okCategory: ImpactTile["category"] =
        category === "personal" ||
        category === "infrastructure" ||
        category === "environment" ||
        category === "longterm"
          ? category
          : "personal";
      return { id, label, headline, description, category: okCategory, icon, badge };
    })
    .filter((t): t is ImpactTile => t !== null)
    .slice(0, 8);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RouteImpactPayload;
  if (!body?.weather || !body?.route) {
    return NextResponse.json({ error: "Missing weather/route payload." }, { status: 400 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const fb = fallbackImpact(body);
    return NextResponse.json({ ...fb, source: "gemini-unavailable" });
  }

  const tripsPerWeek = body.tripsPerWeek ?? 5;
  const prompt = [
    "You are generating an IMPACT DASHBOARD for a campus walking route picker (Phoenix, AZ — extreme heat).",
    "The user picked a shaded route over the least-shaded alternative. Quantify the cascading effects.",
    "",
    "Inputs:",
    `- Weather: ${Math.round(body.weather.temperature)}°F (feels ${Math.round(body.weather.heatIndex)}°F), ${Math.round(body.weather.relativeHumidity)}% RH, sky: ${body.weather.shortForecast} (${Math.round(body.weather.cloudCoverPct)}% cloud cover)`,
    `- Route: ${Math.round(body.route.durationMin)} min walk, selected shade ${Math.round(body.route.selectedShadePct)}%, baseline ${Math.round(body.route.baselineShadePct)}%, ${Math.round(body.route.sunExposureMinAvoided)} fewer minutes of direct sun, ${body.route.reductionPct}% lower modeled body-heat load.`,
    `- Assume ${tripsPerWeek} trips/week (≈${tripsPerWeek * 52}/yr) for any annualized values.`,
    "",
    "Return STRICT JSON only — no prose outside the JSON. Schema:",
    `{
      "headline": "one short sentence (max 16 words) summarizing the trip's standout impact",
      "summary": "one disclaimer-flavored sentence (max 24 words) noting these are directional estimates",
      "tiles": [
        {
          "id": "kebab-case-id",
          "label": "<= 4 words",
          "headline": "headline value e.g. -32% or ~$48/yr or 12 min",
          "description": "<= 22 words, careful language (may/can/help)",
          "category": "personal" | "infrastructure" | "environment" | "longterm",
          "icon": "single emoji",
          "badge": "modeled" | "directional" | "qualitative"
        }
      ]
    }`,
    "",
    "Rules:",
    "- Produce 6-8 tiles spanning ALL FOUR categories.",
    "- Personal: heat strain, hydration/water, sunscreen, UV/skin damage, heat-illness risk.",
    "- Infrastructure: HVAC/AC load on arrival, building cooling demand, peak-hour grid stress.",
    "- Environment: CO2e pressure, urban heat island contribution, water/electricity usage.",
    "- Longterm: cognitive performance, cumulative skin damage, sleep quality after heat exposure.",
    "- Numbers may be approximate but plausible. Use $ for currency, ~ to signal estimate.",
    "- Never claim medical certainty. Use 'may', 'can', 'lower', 'reduced'.",
    "- If the picked route has 0% shade gain, use modest/zero values and say so honestly.",
    "- Cloud cover above 50% means direct-sun benefits are smaller — reflect that.",
  ].join("\n");

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 1400,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const fb = fallbackImpact(body);
      return NextResponse.json({ ...fb, source: "gemini-error" });
    }

    const data = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
    const parsed = safeJsonParse<{ headline?: string; summary?: string; tiles?: unknown }>(text);

    if (!parsed) {
      const fb = fallbackImpact(body);
      return NextResponse.json({ ...fb, source: "gemini-error" });
    }

    const tiles = sanitizeTiles(parsed.tiles);
    if (tiles.length === 0) {
      const fb = fallbackImpact(body);
      return NextResponse.json({ ...fb, source: "gemini-error" });
    }

    const response: ImpactResponse = {
      source: "gemini",
      headline:
        typeof parsed.headline === "string" && parsed.headline.trim()
          ? parsed.headline.trim()
          : fallbackImpact(body).headline,
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : fallbackImpact(body).summary,
      tiles,
    };
    return NextResponse.json(response);
  } catch {
    const fb = fallbackImpact(body);
    return NextResponse.json({ ...fb, source: "gemini-error" });
  }
}
