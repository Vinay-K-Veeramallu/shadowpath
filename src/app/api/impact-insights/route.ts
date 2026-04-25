import { NextRequest, NextResponse } from "next/server";

interface ImpactRequestPayload {
  weather: {
    temperature: number;
    heatIndex: number;
    relativeHumidity: number;
  };
  impact: {
    reducedSunExposurePct: number;
    selectedShadePct: number;
    baselineShadePct: number;
  };
}

function extractInsights(text: string): string[] {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  try {
    const parsed = JSON.parse(trimmed) as { insights?: unknown };
    if (Array.isArray(parsed.insights)) {
      return parsed.insights
        .filter((i): i is string => typeof i === "string")
        .map((i) => i.trim())
        .filter(Boolean)
        .slice(0, 3);
    }
  } catch {
    // Fall back to line parsing below.
  }

  return trimmed
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

export async function POST(request: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ insights: [], source: "gemini-unavailable" });
  }

  const body = (await request.json()) as ImpactRequestPayload;
  const { weather, impact } = body;
  if (!weather || !impact) {
    return NextResponse.json({ error: "Missing weather/impact payload." }, { status: 400 });
  }

  const prompt = [
    "You are generating concise health-impact guidance for a walking route UI.",
    `Inputs: temperature ${Math.round(weather.temperature)}F, feels-like ${Math.round(weather.heatIndex)}F, humidity ${Math.round(weather.relativeHumidity)}%, selected shade ${Math.round(impact.selectedShadePct)}%, least-shaded option ${Math.round(impact.baselineShadePct)}%, direct-sun reduction ${Math.round(impact.reducedSunExposurePct)}%.`,
    "Return STRICT JSON only in this format: {\"insights\":[\"...\",\"...\",\"...\"]}",
    "Rules:",
    "- Exactly 3 short bullet-style sentences (max 18 words each).",
    "- Use careful language: may/can/help; no guarantees and no diagnosis.",
    "- Cover heat strain/dehydration, UV/sunburn, and cumulative long-term skin risk.",
    "- Plain English, actionable, non-alarmist.",
  ].join("\n");

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 220,
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    return NextResponse.json({ insights: [], source: "gemini-error" });
  }

  const data = (await geminiRes.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
  const insights = extractInsights(text);

  return NextResponse.json({ insights, source: "gemini" });
}
