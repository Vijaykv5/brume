import { NextResponse } from "next/server";
import { createDodoCheckout } from "@/lib/dodo";
import { validateBuildingSubmission } from "@/lib/buildings";
import { ensureBuildingOrdersTable, sql } from "@/lib/db";

type DodoCheckoutError = {
  errors?: Record<string, string>;
  error?: string;
};

export async function POST(request: Request) {
  try {
    await ensureBuildingOrdersTable();
    const body = await request.json();
    const parsed = validateBuildingSubmission(body);

    if (!parsed.ok) {
      return NextResponse.json({ errors: parsed.errors } satisfies DodoCheckoutError, {
        status: 400,
      });
    }

    const orderId = crypto.randomUUID();
    const origin = new URL(request.url).origin;
    const returnUrl = `${origin}/?checkout=success&order=${orderId}`;
    const cancelUrl = `${origin}/`;

    await sql`
      insert into building_orders (
        id,
        building_type,
        price_cents,
        company_name,
        domain,
        logo_url
      ) values (
        ${orderId},
        ${parsed.data.buildingType},
        ${parsed.option.priceCents},
        ${parsed.data.companyName},
        ${parsed.data.domain},
        ${parsed.data.logoUrl ?? null}
      )
    `;

    try {
      const checkout = await createDodoCheckout({
        orderId,
        buildingType: parsed.data.buildingType,
        companyName: parsed.data.companyName,
        domain: parsed.data.domain,
        priceCents: parsed.option.priceCents,
        returnUrl,
        cancelUrl,
      });

      await sql`
        update building_orders
        set status = 'checkout_created',
            dodo_checkout_id = ${checkout.checkoutId},
            checkout_url = ${checkout.checkoutUrl},
            updated_at = now()
        where id = ${orderId}
      `;

      return NextResponse.json({
        orderId,
        checkoutUrl: checkout.checkoutUrl,
      });
    } catch (error) {
      await sql`
        update building_orders
        set status = 'failed',
            updated_at = now()
        where id = ${orderId}
      `;

      throw error;
    }
  } catch (error) {
    console.error("Failed to start Dodo checkout", error);
    return NextResponse.json(
      { error: "Could not start checkout right now." } satisfies DodoCheckoutError,
      { status: 500 },
    );
  }
}
