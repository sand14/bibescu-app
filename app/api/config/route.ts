// app/api/config/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  });
}