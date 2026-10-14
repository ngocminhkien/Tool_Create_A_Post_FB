import { NextRequest, NextResponse } from "next/server";
import {
  getObserverAccounts,
  saveObserverAccount,
  deleteObserverAccount,
} from "@/services/db.service";
import {
  CreateObserverAccountRequest,
  UpdateObserverAccountRequest,
} from "@/types/observerAccount.types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = getObserverAccounts();
    return NextResponse.json({ success: true, accounts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateObserverAccountRequest & UpdateObserverAccountRequest & { id?: string };
    const { id, name, identifier, authMode, userToken, status } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Tên tài khoản không được để trống" }, { status: 400 });
    }

    if (!identifier || !identifier.trim()) {
      return NextResponse.json({ success: false, error: "Link FB hoặc UID không được để trống" }, { status: 400 });
    }

    const saved = saveObserverAccount({
      id: id || undefined,
      name: name.trim(),
      identifier: identifier.trim(),
      authMode: authMode || "public_profile",
      userToken: userToken?.trim() || "",
      status: status || "active",
      pagesDiscoveredCount: 0,
    });

    return NextResponse.json({ success: true, account: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Thiếu ID tài khoản" }, { status: 400 });
    }

    const deleted = deleteObserverAccount(id);
    return NextResponse.json({ success: deleted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
