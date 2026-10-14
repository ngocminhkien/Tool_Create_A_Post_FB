import { NextRequest, NextResponse } from "next/server";
import {
  listSourcePages,
  saveSourcePage,
  deleteSourcePage,
  parseFacebookUrl,
} from "@/services/pageManager.service";
import { SourcePagesApiResponse } from "@/types/sourcePage.types";

/**
 * GET /api/pages/source
 * Fetches all monitored Source Pages.
 */
export async function GET(): Promise<NextResponse<SourcePagesApiResponse>> {
  try {
    const pages = listSourcePages();
    return NextResponse.json({
      success: true,
      pages,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi khi lấy danh sách Source Pages",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pages/source
 * Handles creation, updating, and URL validation for Source Pages.
 */
export async function POST(req: NextRequest): Promise<NextResponse<SourcePagesApiResponse>> {
  try {
    const body = await req.json();
    const action = body.action;

    // Action 1: Validate public Facebook Page URL
    if (action === "validate_url") {
      const parsed = parseFacebookUrl(body.url || "");
      return NextResponse.json({
        success: parsed.isValid,
        parsedUrl: parsed,
        error: parsed.isValid ? undefined : parsed.error,
      });
    }

    // Default action: Create or Update Source Page
    const { name, url, pageId, inputMode, accessToken, avatarUrl, scanPostLimit, id } = body;

    const mode = inputMode === "graph_api" ? "graph_api" : "url_scrape";

    if (mode === "url_scrape") {
      if (!url || !url.trim()) {
        return NextResponse.json(
          { success: false, error: "Đường link Fanpage Facebook không được để trống." },
          { status: 400 }
        );
      }
      const parsed = parseFacebookUrl(url.trim());
      if (!parsed.isValid) {
        return NextResponse.json(
          { success: false, error: parsed.error || "URL Fanpage Facebook không hợp lệ." },
          { status: 400 }
        );
      }
    } else {
      if (!pageId && !url) {
        return NextResponse.json(
          { success: false, error: "Chế độ Graph API yêu cầu nhập Page ID hoặc Link Fanpage." },
          { status: 400 }
        );
      }
    }

    const saved = await saveSourcePage({
      id,
      name: name?.trim() || "",
      url: url?.trim() || "",
      pageId: pageId?.trim(),
      inputMode: mode,
      accessToken: accessToken?.trim(),
      avatarUrl: avatarUrl?.trim(),
      scanPostLimit: scanPostLimit ? Number(scanPostLimit) : 5,
    });

    return NextResponse.json({
      success: true,
      page: saved,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi lưu Fanpage nguồn theo dõi",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pages/source
 * Deletes a source page by id.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse<SourcePagesApiResponse>> {
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
        { success: false, error: "Thiếu ID của Fanpage nguồn cần xóa." },
        { status: 400 }
      );
    }

    const deleted = deleteSourcePage(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy Fanpage nguồn để xóa." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      pages: listSourcePages(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi xóa Fanpage nguồn theo dõi",
      },
      { status: 500 }
    );
  }
}
