import { NextResponse } from "next/server";

function toInt(v: string): number | null {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function GET(
  _req: Request,
  { params }: { params: { z: string; x: string; y: string } }
) {
  const z = toInt(params.z);
  const x = toInt(params.x);
  const y = toInt(params.y.replace(".png", ""));

  if (z === null || x === null || y === null || z < 0 || z > 19 || x < 0 || y < 0) {
    return NextResponse.json({ error: "Invalid tile coordinates" }, { status: 400 });
  }

  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  const upstream = await fetch(url, {
    // OSM policy asks for identifying User-Agent for heavy use;
    // for this prototype proxy we still include one.
    headers: { "User-Agent": "ShadowPath/0.1 (dev tile proxy)" },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!upstream.ok) {
    return new NextResponse("Tile not found", { status: upstream.status });
  }

  const bytes = await upstream.arrayBuffer();
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}

