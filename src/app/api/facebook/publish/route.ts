import { NextRequest, NextResponse } from "next/server";
import {
  deleteHistoryItem,
  getFacebookConfig,
  getPostHistory,
  publishPostToFacebookPage,
  saveFacebookConfig,
  verifyFacebookPageToken,
} from "@/services/facebookGraph.service";

export async function GET() {
  try {
    const config = getFacebookConfig();
    const history = getPostHistory();
    return NextResponse.json({
      config: {
        ...config,
        hasToken: Boolean(config.pageAccessToken?.trim()),
      },
      history,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi tải dữ liệu Facebook" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "save_config") {
      const updated = saveFacebookConfig({
        pageId: body.pageId,
        pageName: body.pageName,
        pageAccessToken: body.pageAccessToken,
      });
      return NextResponse.json({ config: updated });
    }

    if (action === "verify_token") {
      const check = await verifyFacebookPageToken(
        body.pageId || "",
        body.pageAccessToken || ""
      );
      if (check.valid && check.pageName) {
        saveFacebookConfig({
          pageId: body.pageId,
          pageName: check.pageName,
          pageAccessToken: body.pageAccessToken,
        });
      }
      return NextResponse.json(check);
    }

    if (action === "delete_history" && body.id) {
      const history = deleteHistoryItem(body.id);
      return NextResponse.json({ history });
    }

    // Default action: Publish or Save Draft
    const item = await publishPostToFacebookPage({
      topicTitle: body.topicTitle || "Chủ đề chưa đặt tên",
      hook: body.hook || "",
      content: body.content || "",
      imageUrl: body.imageUrl,
      imageBase64: body.imageBase64,
      pageId: body.pageId,
      pageAccessToken: body.pageAccessToken,
      saveAsDraftOnly: Boolean(body.saveAsDraftOnly),
      modeUsed: body.modeUsed,
    });

    return NextResponse.json({
      item,
      history: getPostHistory(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Lỗi khi đăng bài lên Facebook Page",
      },
      { status: 500 }
    );
  }
}
