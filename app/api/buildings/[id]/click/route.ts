import { NextResponse } from "next/server";
import { bumpBuildingsCacheVersion, clearCachedBuildings } from "@/lib/buildings-cache";
import { ensureBuildingsTable, sql } from "@/lib/db";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: Params) {
  try {
    await ensureBuildingsTable();
    const { id } = await params;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid building id." }, { status: 400 });
    }

    const rows = await sql`
      update buildings
      set click_count = click_count + 1,
          updated_at = now()
      where id = ${id}
        and status = 'active'
      returning click_count
    `;
    const row = (rows as Array<{ click_count: number }>)[0];

    if (!row) {
      return NextResponse.json({ error: "Building not found." }, { status: 404 });
    }

    await clearCachedBuildings();
    await bumpBuildingsCacheVersion();

    return NextResponse.json({ clickCount: Number(row.click_count) });
  } catch (error) {
    console.error("Failed to track building click", error);
    return NextResponse.json(
      { error: "Could not track this click right now." },
      { status: 500 },
    );
  }
}
