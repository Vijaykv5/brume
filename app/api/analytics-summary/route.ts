import { NextResponse } from "next/server";
import { getGoogleAnalyticsSummary } from "@/lib/google-analytics-data";

export async function GET() {
  try {
    const summary = await getGoogleAnalyticsSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to load Google Analytics summary", error);
    return NextResponse.json(
      { error: "Could not load analytics right now." },
      { status: 500 },
    );
  }
}
