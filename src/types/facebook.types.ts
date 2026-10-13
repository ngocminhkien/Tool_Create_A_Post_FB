import { ContentStyleVariation } from "./socialSeo.types";

export interface FacebookPageConfig {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  avatarUrl?: string;
}

export interface PublishFacebookRequest {
  topicTitle: string;
  hook: string;
  content: string;
  imageUrl?: string;
  imageBase64?: string; // Hỗ trợ tải ảnh trực tiếp từ máy tính lên
  pageId?: string;
  pageAccessToken?: string;
  saveAsDraftOnly?: boolean;
  scheduledPublishTime?: number | string;
  isScheduled?: boolean;
  scheduledAt?: string;
  seoScore?: number;
  seoBreakdown?: string;
  policyWarnings?: string;
  policyStatus?: string;
  hashtags?: string;
  altText?: string;
  imageCaption?: string;
  contentStyle?: ContentStyleVariation | string;
  variationsJson?: string;
}

export interface PostHistoryItem {
  id: string;
  topicTitle: string;
  hook: string;
  finalPost: string;
  modeUsed: string;
  imageUrl?: string;
  imageBase64?: string;
  status: "published" | "draft" | "failed" | "scheduled";
  fbPostId?: string;
  fbPostUrl?: string;
  errorMessage?: string;
  createdAt: string;
  publishedAt?: string;
  scheduledAt?: string;
  seoScore?: number;
  seoBreakdown?: string;
  policyWarnings?: string;
  policyStatus?: string;
  hashtags?: string;
  altText?: string;
  imageCaption?: string;
  contentStyle?: ContentStyleVariation | string;
  variationsJson?: string;
}
