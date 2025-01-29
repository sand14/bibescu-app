import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    googleMapsApiKey: global.process.env.GOOGLE_MAPS_API_KEY || "",
  });
}