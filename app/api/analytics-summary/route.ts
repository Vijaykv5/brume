import { NextResponse } from "next/server";
import {
  getSiteAnalyticsSummary,
  trackSiteVisit,
} from "@/lib/site-analytics";

export async function GET() {
  try {
    const summary = await getSiteAnalyticsSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to load site analytics summary", error);
    return NextResponse.json(
      { error: "Could not load analytics right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      visitorId?: unknown;
      countView?: unknown;
    };
    const result = await trackSiteVisit({
      visitorId: body.visitorId,
      countView: body.countView,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: "Could not track this visit.",
          ...result.summary,
        },
        { status: result.status },
      );
    }

    return NextResponse.json(result.summary);
  } catch (error) {
    console.error("Failed to track site analytics", error);
    return NextResponse.json(
      { error: "Could not update analytics right now." },
      { status: 500 },
    );
  }
}
