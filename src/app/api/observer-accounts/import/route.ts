import { NextRequest, NextResponse } from "next/server";
import { importDiscoveredPages } from "@/services/observerAccount.service";
import { ImportDiscoveredPagesRequest } from "@/types/observerAccount.types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ImportDiscoveredPagesRequest;
    const result = await importDiscoveredPages(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, importedCount: 0, skippedCount: 0, importedPages: [], error: message }, { status: 500 });
  }
}
