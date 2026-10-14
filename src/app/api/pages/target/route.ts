import { NextRequest, NextResponse } from "next/server";
import {
  listTargetPages,
  saveTargetPage,
  deleteTargetPage,
  setDefaultTargetPage,
  verifyPageAccessToken,
} from "@/services/pageManager.service";
import { TargetPagesApiResponse } from "@/types/sourcePage.types";

/**
 * GET /api/pages/target
 * Fetches all registered Target Pages.
 */
export async function GET(): Promise<NextResponse<TargetPagesApiResponse>> {
  try {
    const pages = listTargetPages();
    return NextResponse.json({
      success: true,
      pages,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi khi lấy danh sách Target Pages",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pages/target
 * Handles creation, updating, verifying tokens, and setting default target page.
 */
export async function POST(req: NextRequest): Promise<NextResponse<TargetPagesApiResponse>> {
  try {
    const body = await req.json();
    const action = body.action;

    // Action 1: Verify token with Graph API
    if (action === "verify") {
      const validation = await verifyPageAccessToken(body.pageId || "", body.accessToken || "");
      return NextResponse.json({
        success: validation.valid,
        validation,
        error: validation.valid ? undefined : validation.error,
      });
    }

    // Action 2: Set as default publishing target page
    if (action === "set_default") {
      if (!body.id) {
        return NextResponse.json(
          { success: false, error: "Thiếu ID của Fanpage đích để đặt làm mặc định." },
          { status: 400 }
        );
      }
      const page = setDefaultTargetPage(body.id);
      if (!page) {
        return NextResponse.json(
          { success: false, error: "Không tìm thấy Fanpage đích tương ứng." },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        page,
      });
    }

    // Default action: Create or Update Target Page
    const { pageId, pageName, accessToken, avatarUrl, isDefault, id } = body;

    if (!pageId || !pageId.trim()) {
      return NextResponse.json(
        { success: false, error: "Facebook Page ID không được để trống." },
        { status: 400 }
      );
    }

    if (!accessToken || !accessToken.trim()) {
      return NextResponse.json(
        { success: false, error: "Page Access Token không được để trống." },
        { status: 400 }
      );
    }

    // Auto verify token to get high-res avatar and confirmed page name if not provided
    let finalName = pageName?.trim();
    let finalAvatar = avatarUrl?.trim();
    if (!finalName || !finalAvatar) {
      const verifyResult = await verifyPageAccessToken(pageId.trim(), accessToken.trim());
      if (verifyResult.valid) {
        if (!finalName && verifyResult.pageName) finalName = verifyResult.pageName;
        if (!finalAvatar && verifyResult.avatarUrl) finalAvatar = verifyResult.avatarUrl;
      }
    }

    const saved = await saveTargetPage({
      id,
      pageId: pageId.trim(),
      pageName: finalName || "Facebook Fanpage",
      accessToken: accessToken.trim(),
      avatarUrl: finalAvatar,
      isDefault: Boolean(isDefault),
    });

    return NextResponse.json({
      success: true,
      page: saved,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi lưu Fanpage đích",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pages/target
 * Deletes a target page by id.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse<TargetPagesApiResponse>> {
  try {
    let id = req.nextUrl.searchParams.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {
        // query param is primary
      }
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Thiếu ID của Fanpage đích cần xóa." },
        { status: 400 }
      );
    }

    const deleted = deleteTargetPage(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy Fanpage đích để xóa." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      pages: listTargetPages(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi xóa Fanpage đích",
      },
      { status: 500 }
    );
  }
}
