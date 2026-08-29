import { NextResponse } from "next/server";
import {
  getGoogleAnalyticsSummary,
  GoogleAnalyticsDataError,
} from "@/lib/google-analytics-data";

export async function GET(request: Request) {
  try {
    const summary = await getGoogleAnalyticsSummary(new URL(request.url).hostname);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to load Google Analytics summary", error);
    if (error instanceof GoogleAnalyticsDataError) {
      return NextResponse.json(
        {
          error: "Could not load analytics right now.",
          code: error.code,
          detail: error.message,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Could not load analytics right now." },
      { status: 500 },
    );
  }
}
