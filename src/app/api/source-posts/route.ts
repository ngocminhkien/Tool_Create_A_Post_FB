import { NextRequest, NextResponse } from "next/server";
import { collectPostsFromSourcePage } from "@/services/sourceCrawler.service";
import {
  getSourcePosts,
  getSourcePostById,
  getEvergreenCandidates,
  deleteSourcePost,
} from "@/services/db.service";
import { SourcePostsApiResponse } from "@/types/sourcePost.types";

/**
 * GET /api/source-posts
 * Query parameters:
 * - sourcePageId: filter posts by source page
 * - action=evergreen: returns evergreen candidates older than 15-30 days
 * - id: single source post by id
 */
export async function GET(req: NextRequest): Promise<NextResponse<SourcePostsApiResponse>> {
  try {
    const { searchParams } = req.nextUrl;
    const sourcePageId = searchParams.get("sourcePageId") || undefined;
    const action = searchParams.get("action");
    const id = searchParams.get("id");

    if (id) {
      const post = getSourcePostById(id);
      return NextResponse.json({
        success: Boolean(post),
        post,
        error: post ? undefined : "Không tìm thấy bài viết nguồn.",
      });
    }

    if (action === "evergreen" && sourcePageId) {
      const olderThan = Number(searchParams.get("days")) || 15;
      const candidates = getEvergreenCandidates(sourcePageId, olderThan, 10);
      return NextResponse.json({
        success: true,
        candidates,
      });
    }

    const limit = Number(searchParams.get("limit")) || 50;
    const posts = getSourcePosts(sourcePageId, limit);

    return NextResponse.json({
      success: true,
      posts,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi khi lấy danh sách bài viết nguồn.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/source-posts
 * Triggers scanning and collecting latest posts from a monitored Source Page.
 * Body: { sourcePageId: string, limit?: number }
 */
export async function POST(req: NextRequest): Promise<NextResponse<SourcePostsApiResponse>> {
  try {
    const body = await req.json();
    const { sourcePageId, limit } = body;

    if (!sourcePageId) {
      return NextResponse.json(
        { success: false, error: "Thiếu ID của Fanpage nguồn cần quét." },
        { status: 400 }
      );
    }

    const result = await collectPostsFromSourcePage({
      sourcePageId,
      limit: limit ? Number(limit) : undefined,
    });

    return NextResponse.json({
      success: true,
      result,
      posts: result.posts,
      message: result.message,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi thu thập bài viết từ Fanpage nguồn.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/source-posts
 * Query parameter: ?id=xxx
 */
export async function DELETE(req: NextRequest): Promise<NextResponse<SourcePostsApiResponse>> {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Thiếu ID bài viết nguồn cần xóa." },
        { status: 400 }
      );
    }

    const ok = deleteSourcePost(id);
    return NextResponse.json({
      success: ok,
      message: ok ? "Đã xóa bài viết nguồn thành công." : "Không tìm thấy bài viết để xóa.",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Lỗi khi xóa bài viết nguồn.",
      },
      { status: 500 }
    );
  }
}
