import fs from "fs";
import path from "path";
import {
  FacebookPageConfig,
  PostHistoryItem,
  PublishFacebookRequest,
} from "@/types/facebook.types";
import {
  getFbConfig as dbGetFbConfig,
  saveFbConfig as dbSaveFbConfig,
  getAllPosts as dbGetAllPosts,
  savePost as dbSavePost,
  deletePost as dbDeletePost,
} from "./db.service";

const DATA_DIR = path.join(process.cwd(), "data");
const FB_CONFIG_FILE = path.join(DATA_DIR, "fb-config.json");
const HISTORY_FILE = path.join(DATA_DIR, "posts-history.json");

export function getFacebookConfig(): FacebookPageConfig {
  const cfg = dbGetFbConfig();
  return {
    pageId: cfg.pageId || process.env.FB_PAGE_ID || "",
    pageName: cfg.pageName || "",
    pageAccessToken: cfg.pageAccessToken || process.env.FB_PAGE_ACCESS_TOKEN || "",
  };
}

export function saveFacebookConfig(config: Partial<FacebookPageConfig>): FacebookPageConfig {
  const current = getFacebookConfig();
  const updated: FacebookPageConfig = {
    ...current,
    ...config,
  };
  dbSaveFbConfig({
    pageId: updated.pageId,
    pageName: updated.pageName,
    pageAccessToken: updated.pageAccessToken,
  });

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FB_CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch {
    // mirror
  }
  return updated;
}

export function getPostHistory(): PostHistoryItem[] {
  return dbGetAllPosts();
}

export function appendPostHistory(item: PostHistoryItem): PostHistoryItem[] {
  dbSavePost({
    ...item,
    createdAt: item.createdAt || new Date().toISOString(),
  });
  return getPostHistory();
}

export function deleteHistoryItem(id: string): PostHistoryItem[] {
  dbDeletePost(id);
  return getPostHistory();
}

/**
 * Verifies a Facebook Page ID & Page Access Token against Graph API
 */
export async function verifyFacebookPageToken(
  pageId: string,
  pageAccessToken: string
): Promise<{ valid: boolean; pageName?: string; id?: string; error?: string }> {
  if (!pageId.trim() || !pageAccessToken.trim()) {
    return { valid: false, error: "Thiếu Page ID hoặc Page Access Token." };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(
      pageId.trim()
    )}?fields=id,name&access_token=${encodeURIComponent(pageAccessToken.trim())}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      return {
        valid: false,
        error: data?.error?.message || `Lỗi HTTP ${res.status}`,
      };
    }

    return {
      valid: true,
      id: data.id,
      pageName: data.name,
    };
  } catch (err: unknown) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Publishes a post (Text only, Image URL + Text, or Base64 Uploaded Image + Text)
 * to a Facebook Page via Facebook Graph API, or saves as a Draft.
 */
export async function publishPostToFacebookPage(
  req: PublishFacebookRequest & { modeUsed?: string }
): Promise<PostHistoryItem> {
  const savedConfig = getFacebookConfig();
  const pageId = (req.pageId || savedConfig.pageId || "").trim();
  const pageAccessToken = (req.pageAccessToken || savedConfig.pageAccessToken || "").trim();

  // Save as draft if requested
  if (req.saveAsDraftOnly) {
    const draftItem: PostHistoryItem = {
      id: `post-${Date.now()}`,
      topicTitle: req.topicTitle,
      hook: req.hook,
      finalPost: req.content,
      modeUsed: req.modeUsed || "modular",
      imageUrl: req.imageUrl || (req.imageBase64 ? "Ảnh tải lên từ máy" : undefined),
      status: req.scheduledAt ? "scheduled" : "draft",
      createdAt: new Date().toISOString(),
      scheduledAt: req.scheduledAt,
      seoScore: req.seoScore,
      seoBreakdown: req.seoBreakdown,
      policyWarnings: req.policyWarnings,
      policyStatus: req.policyStatus,
      hashtags: req.hashtags,
      altText: req.altText,
      imageCaption: req.imageCaption,
      contentStyle: req.contentStyle,
      variationsJson: req.variationsJson,
    };
    appendPostHistory(draftItem);
    return draftItem;
  }

  if (!pageId || !pageAccessToken) {
    throw new Error(
      "Chưa cấu hình Facebook Page ID hoặc Page Access Token. Vui lòng nhập tại mục Cấu hình hoặc lưu Bản nháp."
    );
  }

  try {
    let fbPostId = "";

    // Case 1: User uploaded an image file from computer (Base64 data URL)
    if (req.imageBase64 && req.imageBase64.startsWith("data:image/")) {
      const matches = req.imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!matches) {
        throw new Error("Định dạng file ảnh tải lên không hợp lệ.");
      }
      const mimeType = matches[1];
      const base64Data = matches[2];
      const binaryBuffer = Buffer.from(base64Data, "base64");
      const blob = new Blob([binaryBuffer], { type: mimeType });

      const formData = new FormData();
      formData.append("source", blob, "upload.jpg");
      formData.append("caption", req.content);
      formData.append("access_token", pageAccessToken);

      const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/photos`;
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data?.error?.message || `Lỗi tải ảnh lên Facebook (${res.status})`);
      }
      fbPostId = data.post_id || data.id;
    }
    // Case 2: User provided a public Image URL
    else if (req.imageUrl && req.imageUrl.trim().length > 0) {
      const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/photos`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: req.imageUrl.trim(),
          caption: req.content,
          access_token: pageAccessToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data?.error?.message || `Lỗi đăng ảnh qua URL (${res.status})`);
      }
      fbPostId = data.post_id || data.id;
    }
    // Case 3: Text-only post to /feed
    else {
      const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/feed`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: req.content,
          access_token: pageAccessToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data?.error?.message || `Lỗi đăng bài lên Page (${res.status})`);
      }
      fbPostId = data.id;
    }

    const fbPostUrl = fbPostId ? `https://www.facebook.com/${fbPostId}` : undefined;

    const historyItem: PostHistoryItem = {
      id: `post-${Date.now()}`,
      topicTitle: req.topicTitle,
      hook: req.hook,
      finalPost: req.content,
      modeUsed: req.modeUsed || "modular",
      imageUrl: req.imageUrl || (req.imageBase64 ? "Ảnh tải lên từ máy" : undefined),
      status: "published",
      fbPostId,
      fbPostUrl,
      createdAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      scheduledAt: req.scheduledAt,
      seoScore: req.seoScore,
      seoBreakdown: req.seoBreakdown,
      policyWarnings: req.policyWarnings,
      policyStatus: req.policyStatus,
      hashtags: req.hashtags,
      altText: req.altText,
      imageCaption: req.imageCaption,
      contentStyle: req.contentStyle,
      variationsJson: req.variationsJson,
    };

    appendPostHistory(historyItem);
    return historyItem;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const failedItem: PostHistoryItem = {
      id: `post-${Date.now()}`,
      topicTitle: req.topicTitle,
      hook: req.hook,
      finalPost: req.content,
      modeUsed: req.modeUsed || "modular",
      imageUrl: req.imageUrl,
      status: "failed",
      errorMessage,
      createdAt: new Date().toISOString(),
    };
    appendPostHistory(failedItem);
    throw new Error(errorMessage);
  }
}
