import { NextResponse } from "next/server";
import type { SavedBuilding } from "@/lib/buildings";
import { getCachedBuildings, setCachedBuildings } from "@/lib/buildings-cache";
import { loadActiveBuildings } from "@/lib/buildings-store";

function normalizeSavedBuilding(building: SavedBuilding): SavedBuilding {
  return {
    ...building,
    clickCount: Number(building.clickCount ?? 0),
  };
}

export async function GET() {
  try {
    const cachedBuildings = await getCachedBuildings();

    if (cachedBuildings) {
      const buildings = cachedBuildings.map(normalizeSavedBuilding);
      return NextResponse.json(
        { buildings },
        { headers: { "x-buildings-source": "redis" } },
      );
    }

    const buildings = await loadActiveBuildings();
    await setCachedBuildings(buildings);

    return NextResponse.json(
      { buildings },
      { headers: { "x-buildings-source": "postgres" } },
    );
  } catch (error) {
    console.error("Failed to load buildings", error);
    return NextResponse.json(
      { error: "Could not load buildings right now." },
      { status: 500 },
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Buildings are created after a successful Dodo payment." },
    {
      status: 405,
      headers: { Allow: "GET" },
    },
  );
}
