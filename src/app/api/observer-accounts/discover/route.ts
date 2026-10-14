import { NextRequest, NextResponse } from "next/server";
import {
  discoverPagesFromAccount,
  discoverPagesFromAllAccounts,
} from "@/services/observerAccount.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const accountId = body?.accountId as string | undefined;

    if (accountId && accountId !== "all") {
      const result = await discoverPagesFromAccount(accountId);
      return NextResponse.json(result);
    } else {
      const result = await discoverPagesFromAllAccounts();
      return NextResponse.json(result);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, totalDiscovered: 0, newPagesCount: 0, pages: [], error: message }, { status: 500 });
  }
}
