import { NextResponse } from "next/server";
import type { SavedBuilding } from "@/lib/buildings";
import {
  ensureBuildingOrdersTable,
  ensureBuildingsTable,
  sql,
} from "@/lib/db";
import { rowToBuilding, type BuildingRow } from "@/lib/buildings-store";

type Params = {
  params: Promise<{ id: string }>;
};

type OrderBuildingRow = BuildingRow & {
  order_id: string;
  order_status: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
    }

    await ensureBuildingOrdersTable();
    await ensureBuildingsTable();

    const rows = await sql`
      select
        building_orders.id as order_id,
        building_orders.status as order_status,
        buildings.id,
        buildings.building_order_id,
        buildings.building_type,
        buildings.price_cents,
        buildings.company_name,
        buildings.domain,
        buildings.logo_url,
        buildings.position_x,
        buildings.position_y,
        buildings.position_z,
        buildings.click_count,
        buildings.status,
        buildings.created_at,
        buildings.updated_at
      from building_orders
      left join buildings
        on buildings.building_order_id = building_orders.id
      where building_orders.id = ${id}
      limit 1
    `;
    const row = (rows as OrderBuildingRow[])[0];

    if (!row) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const building: SavedBuilding | null = row.id ? rowToBuilding(row) : null;

    return NextResponse.json({
      orderId: row.order_id,
      status: row.order_status,
      building,
    });
  } catch (error) {
    console.error("Failed to load building order", error);
    return NextResponse.json(
      { error: "Could not load order right now." },
      { status: 500 },
    );
  }
}
