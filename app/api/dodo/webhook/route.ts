import { NextResponse } from "next/server";
import {
  getDodoCheckoutId,
  getDodoOrderId,
  getDodoPaymentId,
  isDodoPaymentSucceeded,
  verifyDodoWebhook,
} from "@/lib/dodo";
import { isBuildingType, type BuildingType } from "@/lib/buildings";
import { createPaidBuilding } from "@/lib/buildings-store";
import { ensureBuildingOrdersTable, sql } from "@/lib/db";
import { isDodoPaymentsEnabled } from "@/lib/payment-config";

type BuildingOrderRow = {
  id: string;
  building_type: string;
  price_cents: number;
  company_name: string;
  domain: string;
  logo_url: string | null;
  status: string;
};

export async function POST(request: Request) {
  if (!isDodoPaymentsEnabled()) {
    return NextResponse.json(
      { error: "Payments are currently disabled." },
      { status: 503, headers: { "Retry-After": "3600" } },
    );
  }

  const payload = await request.text();

  try {
    await ensureBuildingOrdersTable();
    const event = verifyDodoWebhook(payload, request.headers);

    if (!isDodoPaymentSucceeded(event)) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const orderId = getDodoOrderId(event);
    const dodoPaymentId = getDodoPaymentId(event);
    const dodoCheckoutId = getDodoCheckoutId(event);

    if (!orderId || !dodoPaymentId) {
      console.error("Dodo webhook missing building order or payment id", event);
      return NextResponse.json(
        { error: "Webhook payload missing required payment metadata." },
        { status: 400 },
      );
    }

    const orderRows = await sql`
      select
        id,
        building_type,
        price_cents,
        company_name,
        domain,
        logo_url,
        status
      from building_orders
      where id = ${orderId}
      limit 1
    `;
    const order = (orderRows as BuildingOrderRow[])[0];

    if (!order || !isBuildingType(order.building_type)) {
      console.error("Dodo webhook referenced an unknown building order", { orderId });
      return NextResponse.json({ error: "Unknown building order." }, { status: 404 });
    }

    await sql`
      update building_orders
      set status = 'paid',
          dodo_payment_id = ${dodoPaymentId},
          dodo_checkout_id = coalesce(dodo_checkout_id, ${dodoCheckoutId}),
          paid_at = coalesce(paid_at, now()),
          updated_at = now()
      where id = ${orderId}
    `;

    const building = await createPaidBuilding({
      orderId,
      dodoPaymentId,
      dodoCheckoutId,
      buildingType: order.building_type as BuildingType,
      priceCents: order.price_cents as 200 | 500 | 700 | 1000,
      companyName: order.company_name,
      domain: order.domain,
      ...(order.logo_url ? { logoUrl: order.logo_url } : {}),
    });

    return NextResponse.json({ received: true, buildingId: building.id });
  } catch (error) {
    console.error("Failed to process Dodo webhook", error);
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }
}
