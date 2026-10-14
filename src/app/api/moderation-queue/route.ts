import { NextRequest, NextResponse } from "next/server";
import {
  getModerationItems,
  getModerationItemById,
  updateModerationItem,
  deleteModerationItem,
  getModerationStats,
  getTargetPageById,
  getDefaultTargetPage,
} from "@/services/db.service";
import { repurposeSourcePost } from "@/services/sourceRepurposer.service";
import { publishPostToFacebookPage } from "@/services/facebookGraph.service";
import { ModerationApiResponse, ModerationStatus } from "@/types/sourcePost.types";

/**
 * GET /api/moderation-queue
 * Query parameters:
 * - status: 'pending' | 'approved' | 'published' | 'scheduled' | 'rejected'
 * - id: single moderation item by id
 * - limit: number of items
 */
export async function GET(req: NextRequest): Promise<NextResponse<ModerationApiResponse>> {
  try {
    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");

    if (id) {
      const item = getModerationItemById(id);
      return NextResponse.json({
        success: Boolean(item),
        item: item || undefined,
        error: item ? undefined : "Không tìm thấy bài viết trong hàng đợi duyệt.",
      });
    }

    const status = (searchParams.get("status") as ModerationStatus) || undefined;
    const limit = Number(searchParams.get("limit")) || 50;

    const items = getModerationItems(status, limit);
    const stats = getModerationStats();

    return NextResponse.json({
      success: true,
      items,
      stats,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi khi lấy danh sách hàng đợi duyệt bài.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/moderation-queue
 * Actions:
 * - 'repurpose': Runs AI Reverse Semantic Anatomy & concise rewriting on source post
 * - 'update': Updates editable fields
 * - 'publish_now': Publishes approved post to target Fanpage immediately
 * - 'schedule': Sets scheduled time and status
 * - 'reject': Rejects/archives the item
 */
export async function POST(req: NextRequest): Promise<NextResponse<ModerationApiResponse>> {
  try {
    const body = await req.json();
    const action = body.action || "repurpose";

    // Action 1: Repurpose source post with AI
    if (action === "repurpose") {
      const { sourcePostId, targetPageId, preferredStyle, customInstructions } = body;
      if (!sourcePostId) {
        return NextResponse.json(
          { success: false, error: "Thiếu ID bài viết nguồn để xào lại." },
          { status: 400 }
        );
      }

      const res = await repurposeSourcePost({
        sourcePostId,
        targetPageId,
        preferredStyle,
        customInstructions,
      });

      return NextResponse.json({
        success: true,
        item: res.moderationItem,
        stats: getModerationStats(),
        message: `Đã xào bài thành công với AI (${res.modelUsed}). Độ cô đọng ngắn hơn ${res.compressionRate}% so với bài gốc.`,
      });
    }

    // Action 2: Update moderation item content
    if (action === "update") {
      const { id, updates } = body;
      if (!id || !updates) {
        return NextResponse.json(
          { success: false, error: "Thiếu ID hoặc dữ liệu cập nhật." },
          { status: 400 }
        );
      }

      const updated = updateModerationItem(id, updates);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: "Không tìm thấy bài viết để cập nhật." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        item: updated,
        stats: getModerationStats(),
      });
    }

    // Action 3: Publish approved post to target Fanpage immediately
    if (action === "publish_now") {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { success: false, error: "Thiếu ID bài viết cần đăng." },
          { status: 400 }
        );
      }

      const item = getModerationItemById(id);
      if (!item) {
        return NextResponse.json(
          { success: false, error: "Không tìm thấy bài viết trong hàng đợi duyệt." },
          { status: 404 }
        );
      }

      // Resolve Target Page and Access Token
      let targetPage = item.targetPageId ? getTargetPageById(item.targetPageId) : null;
      if (!targetPage) {
        targetPage = getDefaultTargetPage();
      }

      if (!targetPage || !targetPage.accessToken || !targetPage.pageId) {
        return NextResponse.json(
          {
            success: false,
            error: "Chưa cấu hình Fanpage Đích hoặc thiếu Page Access Token để đăng bài. Vui lòng vào Cấu Hình Fanpage kiểm tra.",
          },
          { status: 400 }
        );
      }

      // Check if image is local or remote
      let publishImageUrl: string | undefined = undefined;
      let publishImageBase64: string | undefined = undefined;

      if (item.selectedImages && item.selectedImages.length > 0) {
        const firstImg = item.selectedImages[0];
        if (firstImg.startsWith("data:image")) {
          publishImageBase64 = firstImg;
        } else if (firstImg.startsWith("http")) {
          publishImageUrl = firstImg;
        } else if (firstImg.startsWith("/")) {
          // Local path - if running locally without public domain, read as base64
          try {
            const fs = await import("fs");
            const path = await import("path");
            const localFile = path.join(process.cwd(), "public", firstImg.replace(/^\//, ""));
            if (fs.existsSync(localFile)) {
              const fileBuf = fs.readFileSync(localFile);
              const ext = path.extname(localFile).replace(".", "") || "jpeg";
              publishImageBase64 = `data:image/${ext};base64,${fileBuf.toString("base64")}`;
            }
          } catch {
            // fallback
          }
        }
      }

      // Publish via Graph API
      const publishResult = await publishPostToFacebookPage({
        pageId: targetPage.pageId,
        pageAccessToken: targetPage.accessToken,
        content: item.aiFullPost,
        topicTitle: item.aiHeadline,
        hook: item.aiHook,
        imageUrl: publishImageUrl,
        imageBase64: publishImageBase64,
        modeUsed: "repurposed",
      });

      if (publishResult.status === "failed") {
        updateModerationItem(item.id, {
          errorMessage: publishResult.errorMessage || "Lỗi đăng lên Facebook Fanpage",
        });
        return NextResponse.json(
          {
            success: false,
            error: publishResult.errorMessage || "Không thể đăng bài lên Fanpage.",
          },
          { status: 500 }
        );
      }

      // Update moderation item to published
      const updated = updateModerationItem(item.id, {
        status: "published",
        publishedAt: new Date().toISOString(),
        fbPostId: publishResult.fbPostId,
        fbPostUrl: publishResult.fbPostUrl,
        errorMessage: undefined,
        targetPageId: targetPage.pageId,
        targetPageName: targetPage.pageName,
      });

      return NextResponse.json({
        success: true,
        item: updated || undefined,
        stats: getModerationStats(),
        message: `Đã đăng bài thành công lên Fanpage "${targetPage.pageName}"!`,
      });
    }

    // Action 4: Schedule post
    if (action === "schedule") {
      const { id, scheduledAt } = body;
      if (!id || !scheduledAt) {
        return NextResponse.json(
          { success: false, error: "Thiếu ID hoặc thời gian hẹn giờ." },
          { status: 400 }
        );
      }

      const updated = updateModerationItem(id, {
        status: "scheduled",
        scheduledAt,
      });

      return NextResponse.json({
        success: true,
        item: updated || undefined,
        stats: getModerationStats(),
        message: `Đã lên lịch đăng bài vào lúc ${scheduledAt}.`,
      });
    }

    // Action 5: Reject post
    if (action === "reject") {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { success: false, error: "Thiếu ID bài viết." },
          { status: 400 }
        );
      }

      const updated = updateModerationItem(id, {
        status: "rejected",
      });

      return NextResponse.json({
        success: true,
        item: updated || undefined,
        stats: getModerationStats(),
        message: "Đã từ chối bài viết.",
      });
    }

    return NextResponse.json(
      { success: false, error: `Hành động không hợp lệ: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi xử lý hàng đợi duyệt bài.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/moderation-queue
 * Query parameter: ?id=xxx
 */
export async function DELETE(req: NextRequest): Promise<NextResponse<ModerationApiResponse>> {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Thiếu ID bản ghi cần xóa." },
        { status: 400 }
      );
    }

    const ok = deleteModerationItem(id);
    return NextResponse.json({
      success: ok,
      stats: getModerationStats(),
      message: ok ? "Đã xóa bản ghi khỏi hàng đợi duyệt." : "Không tìm thấy bản ghi để xóa.",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi khi xóa bản ghi.",
      },
      { status: 500 }
    );
  }
}
