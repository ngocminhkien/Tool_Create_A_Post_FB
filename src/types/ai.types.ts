import { ContentStyleVariation } from "./socialSeo.types";
export type { ContentStyleVariation };

export type KeyStatus = "active" | "cooldown" | "invalid";

export interface GeminiKeyItem {
  id: string;
  key: string;
  maskedKey: string;
  status: KeyStatus;
  successCount: number;
  errorCount: number;
  rateLimitCount: number;
  lastUsedAt: string | null;
  cooldownUntil: string | null;
  lastError: string | null;
}

export interface KeyPoolStats {
  total: number;
  active: number;
  cooldown: number;
  invalid: number;
  currentIndex: number;
  totalSuccessRequests: number;
  totalFailovers: number;
}

export type PromptExecutionMode =
  | "modular" // Chế độ 1: Ghép từng phần (Prompt 1+Info 1 ... Prompt 4+Info 4) rồi tổng hợp cùng Hook
  | "chaining" // Chế độ 2: Chạy nối tiếp (Prompt 1 -> Prompt 2 -> Prompt 3 -> Prompt 4)
  | "synthesis"; // Chế độ 3: Tổng hợp nhanh (Gộp Hook + Info 1-4 + Prompt 1-4 trong 1 luồng biên tập)

export interface HookGenerationRequest {
  topic: TopicRowInput;
  customInstruction?: string;
  count?: number;
}

export interface TopicRowInput {
  title: string;
  entity?: string;
  info1: string;
  info2: string;
  info3: string;
  info4: string;
  prompt1: string;
  prompt2: string;
  prompt3: string;
  prompt4: string;
}

export interface HookGenerationResponse {
  hooks: string[];
  usedKeyMasked: string;
  failoverAttempts: number;
  model: string;
}

export interface StepOutput {
  stepNumber: number;
  label: string;
  promptUsed: string;
  infoUsed: string;
  output: string;
  usedKeyMasked: string;
}

export interface PostGenerationRequest {
  topic: TopicRowInput;
  selectedHook: string;
  mode: PromptExecutionMode;
  activePrompts?: boolean[]; // Cho phép bật/tắt từng Prompt 1-4 linh hoạt
  toneInstruction?: string;
  contentStyle?: ContentStyleVariation;
}

export interface PostGenerationResponse {
  finalPost: string;
  steps: StepOutput[];
  mode: PromptExecutionMode;
  totalKeysUsed: string[];
  totalFailovers: number;
}

export type ImageStylePreset =
  | "photorealistic" // Ảnh chụp thực tế (Flycam, chân thực, độ nét cao)
  | "urban_planning" // Phối cảnh quy hoạch kiến trúc, thành phố thông minh
  | "cinematic_landscape" // Phong cảnh điện ảnh, hoàng hôn ven sông
  | "facebook_editorial"; // Phong cách tạp chí/báo chí truyền thông

export interface GeneratedImageItem {
  id: string;
  imageUrl: string;
  imageBase64: string;
  optimizedPrompt: string;
  style: ImageStylePreset;
  aspectRatio: "1:1" | "16:9" | "4:5";
  label?: string;
  angleDescription?: string;
  altText?: string;
  caption?: string;
}

export interface AiImageRecord {
  id: string;
  topicTitle?: string;
  entity?: string;
  prompt: string;
  style?: string;
  imageUrl: string;
  imageBase64?: string;
  provider?: string;
  altText?: string;
  caption?: string;
  createdAt?: string;
}

export interface ImageGenerationRequest {
  topicTitle: string;
  entity?: string;
  summaryText?: string;
  style?: ImageStylePreset;
  customPrompt?: string;
  aspectRatio?: "1:1" | "16:9" | "4:5";
  count?: number;
}

export interface ImageGenerationResponse {
  imageUrl: string;
  imageBase64: string;
  optimizedPrompt: string;
  style: ImageStylePreset;
  provider: string;
  images?: GeneratedImageItem[];
  tokensUsedEstimated?: number;
}
