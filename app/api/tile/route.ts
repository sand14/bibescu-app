import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const z = searchParams.get("z");
    const x = searchParams.get("x");
    const y = searchParams.get("y");

    if (!z || !x || !y) {
        return new NextResponse("Missing z/x/y parameters", { status: 400 });
    }

    const zi = parseInt(z, 10);
    const xi = parseInt(x, 10);
    const yi = parseInt(y, 10);

    if (isNaN(zi) || isNaN(xi) || isNaN(yi) || zi < 0 || zi > 19) {
        return new NextResponse("Invalid tile parameters", { status: 400 });
    }

    const maxTile = Math.pow(2, zi) - 1;
    if (xi < 0 || xi > maxTile || yi < 0 || yi > maxTile) {
        return new NextResponse("Tile out of range", { status: 400 });
    }

    const tileUrl = `https://tile.openstreetmap.org/${zi}/${xi}/${yi}.png`;

    try {
        const tileResponse = await fetch(tileUrl, {
            headers: {
                "User-Agent": "bibescu-app/1.0 (journey route planner for rally navigation)",
                "Accept": "image/png",
            },
            next: { revalidate: 3600 },
        });

        if (!tileResponse.ok) {
            return new NextResponse(`Tile server error: ${tileResponse.status}`, {
                status: tileResponse.status,
            });
        }

        const tileBuffer = await tileResponse.arrayBuffer();

        return new NextResponse(tileBuffer, {
            status: 200,
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch {
        return new NextResponse("Failed to fetch tile", { status: 502 });
    }
}
