"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  Wand2,
  Check,
  Copy,
  Send,
  Save,
  Image as ImageIcon,
  Upload,
  Layers,
  GitBranch,
  Zap,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  ThumbsUp,
  MessageCircle,
  Share2,
  Globe,
  FileSpreadsheet,
  Palette,
  Download,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Hash,
  Tag,
  Target,
  BookOpen,
  Newspaper,
  Calendar,
} from "lucide-react";
import { TopicRow } from "@/types/sheet.types";
import {
  PromptExecutionMode,
  StepOutput,
  ImageStylePreset,
  GeneratedImageItem,
} from "@/types/ai.types";
import {
  scanFacebookPolicy,
  applyPolicyFix,
  autoSanitizeAll,
} from "@/services/policyGuard.service";
import { evaluateSocialSeo } from "@/services/socialSeo.service";
import { getGoldenHourPresets } from "@/services/goldenHours.service";
import { generateThreeTierHashtags, appendHashtags } from "@/services/hashtagEngine.service";
import { getAllStylePresets, getStylePrompt } from "@/services/contentVariations.service";
import {
  GoldenHourSlot,
  ThreeTierHashtags,
  ContentStyleVariation,
} from "@/types/socialSeo.types";

export default function ContentStudioPage() {
  // 1. Sheet Topics State
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingSheets, setLoadingSheets] = useState<boolean>(true);
  const [showDataInspector, setShowDataInspector] = useState<boolean>(true);
  const [quickSheetUrl, setQuickSheetUrl] = useState<string>("");
  const [syncingQuickSheet, setSyncingQuickSheet] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable working copy of the selected topic's Title, Info 1-4, Prompt 1-4
  const [workingTopic, setWorkingTopic] = useState<TopicRow | null>(null);

  // 2. Hook Step State
  const [customHookHint, setCustomHookHint] = useState<string>("");
  const [generatedHooks, setGeneratedHooks] = useState<string[]>([]);
  const [selectedHook, setSelectedHook] = useState<string>("");
  const [hookKeyUsed, setHookKeyUsed] = useState<string>("");
  const [loadingHook, setLoadingHook] = useState<boolean>(false);

  // 3. Final Post Step State (Prompt 1-4 modes)
  const [executionMode, setExecutionMode] =
    useState<PromptExecutionMode>("modular");
  const [activePrompts, setActivePrompts] = useState<boolean[]>([
    true,
    true,
    true,
    true,
  ]);
  const [toneInstruction, setToneInstruction] = useState<string>("");
  const [finalPost, setFinalPost] = useState<string>("");
  const [stepOutputs, setStepOutputs] = useState<StepOutput[]>([]);
  const [postKeysUsed, setPostKeysUsed] = useState<string[]>([]);
  const [loadingPost, setLoadingPost] = useState<boolean>(false);
  const [activePreviewTab, setActivePreviewTab] = useState<
    "editor" | "steps"
  >("editor");

  // 4. Image & Facebook Publishing State
  const [imageSourceTab, setImageSourceTab] = useState<"ai" | "upload" | "url">("ai");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [imageFileName, setImageFileName] = useState<string>("");
  const [generatingAiImage, setGeneratingAiImage] = useState<boolean>(false);
  const [aiImageStyle, setAiImageStyle] = useState<ImageStylePreset>("photorealistic");
  const [aiImagePrompt, setAiImagePrompt] = useState<string>("");
  const [aiAspectRatio, setAiAspectRatio] = useState<"16:9" | "1:1" | "4:5">("16:9");
  const [showAiCustomPrompt, setShowAiCustomPrompt] = useState<boolean>(false);
  const [aiImageCount, setAiImageCount] = useState<number>(1);
  const [generatedGallery, setGeneratedGallery] = useState<GeneratedImageItem[]>([]);
  const [showTokenWarningModal, setShowTokenWarningModal] = useState<boolean>(false);
  const [pendingImageCount, setPendingImageCount] = useState<number>(1);
  const [activeKeysCount, setActiveKeysCount] = useState<number>(30);
  const [totalKeysCount, setTotalKeysCount] = useState<number>(30);
  const [pageName, setPageName] = useState<string>("Facebook Fanpage");
  const [hasFbToken, setHasFbToken] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);

  // 5. Social SEO, Policy Guard & Golden Hours States
  const [selectedStyle, setSelectedStyle] =
    useState<ContentStyleVariation>("storytelling");
  const stylePresets = getAllStylePresets();
  const [showSeoDetails, setShowSeoDetails] = useState<boolean>(false);
  const [generatedHashtags, setGeneratedHashtags] =
    useState<ThreeTierHashtags | null>(null);
  const [goldenHourSlots] = useState<GoldenHourSlot[]>(() =>
    getGoldenHourPresets()
  );
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [imageAltText, setImageAltText] = useState<string>("");
  const [imageCaptionText, setImageCaptionText] = useState<string>("");

  // Real-time Social SEO & Facebook Policy Evaluation
  const policyScan = React.useMemo(() => {
    return scanFacebookPolicy(finalPost);
  }, [finalPost]);

  const seoEval = React.useMemo(() => {
    return evaluateSocialSeo(
      finalPost,
      workingTopic?.entity,
      workingTopic?.title
    );
  }, [finalPost, workingTopic?.entity, workingTopic?.title]);

  // Token and Quota limits constants
  const ESTIMATED_TOKENS_PER_IMAGE = 450;
  const SAFE_TOKEN_THRESHOLD = 1000; // Ngưỡng an toàn khuyến nghị (1,000 tokens ≈ 2 ảnh)

  // Feedback Banner
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
    link?: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedStepIdx, setCopiedStepIdx] = useState<number | null>(null);

  // Load Topics from Sheet, FB Config & Gemini Key Stats on mount
  useEffect(() => {
    const loadInitial = async () => {
      try {
        setLoadingSheets(true);
        const [sheetRes, fbRes, keyRes] = await Promise.all([
          fetch("/api/sheets"),
          fetch("/api/facebook/publish"),
          fetch("/api/ai/keys"),
        ]);
        if (sheetRes.ok) {
          const sheetData = await sheetRes.json();
          const rows: TopicRow[] = sheetData.rows || [];
          setTopics(rows);
          if (sheetData.config?.sheetUrl) {
            setQuickSheetUrl(sheetData.config.sheetUrl);
          }
          if (rows.length > 0) {
            setSelectedTopicId(rows[0].id);
            setWorkingTopic({ ...rows[0] });
          } else {
            setSelectedTopicId("");
            setWorkingTopic(null);
          }
        }
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          if (fbData.config?.pageName) setPageName(fbData.config.pageName);
          setHasFbToken(Boolean(fbData.config?.hasToken));
        }
        if (keyRes.ok) {
          const keyData = await keyRes.json();
          if (keyData.stats) {
            setActiveKeysCount(keyData.stats.active ?? 30);
            setTotalKeysCount(keyData.stats.total ?? 30);
          }
        }
      } catch {
        setStatusMessage({
          type: "error",
          text: "Không thể tải dữ liệu khởi tạo.",
        });
      } finally {
        setLoadingSheets(false);
      }
    };
    loadInitial();
  }, []);

  const handleQuickSyncSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSheetUrl.trim()) return;
    setSyncingQuickSheet(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          sheetUrl: quickSheetUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi đồng bộ Google Sheet");
      const rows: TopicRow[] = data.rows || [];
      setTopics(rows);
      if (rows.length > 0) {
        setSelectedTopicId(rows[0].id);
        setWorkingTopic({ ...rows[0] });
      }
      setStatusMessage({
        type: "success",
        text: `Đã đồng bộ thành công ${rows.length} dòng chủ đề từ Google Sheet của bạn!`,
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi đồng bộ Sheet",
      });
    } finally {
      setSyncingQuickSheet(false);
    }
  };

  // Process Excel (.xlsx, .xls) or CSV file from laptop
  const processUploadedSheetFile = (file: File) => {
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const isSpreadsheet =
      validExtensions.includes(fileExt) ||
      file.type.includes("sheet") ||
      file.type.includes("csv") ||
      file.type.includes("excel");

    if (!isSpreadsheet && fileExt !== "") {
      setStatusMessage({
        type: "error",
        text: `Tệp "${file.name}" không đúng định dạng. Vui lòng kéo thả hoặc chọn file Excel (.xlsx, .xls) hoặc CSV (.csv).`,
      });
      return;
    }

    setSyncingQuickSheet(true);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = typeof reader.result === "string" ? reader.result : "";
        const res = await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload_file",
            fileName: file.name,
            fileBase64: base64,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lỗi đọc file từ máy tính");

        const rows: TopicRow[] = data.rows || [];
        setTopics(rows);
        if (rows.length > 0) {
          setSelectedTopicId(rows[0].id);
          setWorkingTopic({ ...rows[0] });
        }
        setStatusMessage({
          type: "success",
          text: `Đã nạp thành công ${rows.length} dòng chủ đề từ file "${file.name}" trên máy tính!`,
        });
      } catch (err: unknown) {
        setStatusMessage({
          type: "error",
          text:
            err instanceof Error ? err.message : "Không thể đọc file vừa chọn",
        });
      } finally {
        setSyncingQuickSheet(false);
      }
    };
    reader.onerror = () => {
      setStatusMessage({
        type: "error",
        text: "Lỗi trong quá trình đọc file từ thiết bị của bạn.",
      });
      setSyncingQuickSheet(false);
    };
    reader.readAsDataURL(file);
  };

  // Upload Excel or CSV file via input click
  const handleLaptopSheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedSheetFile(file);
    e.target.value = "";
  };

  // Drag & drop handlers for spreadsheet files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingFile) {
      setIsDraggingFile(true);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processUploadedSheetFile(files[0]);
    }
  };

  // When user picks a different topic (e.g., another Commune)
  const handleSelectTopic = (id: string) => {
    setSelectedTopicId(id);
    const found = topics.find((t) => t.id === id);
    if (found) {
      setWorkingTopic({ ...found });
      setGeneratedHooks([]);
      setSelectedHook("");
      setFinalPost("");
      setStepOutputs([]);
      setStatusMessage(null);
    }
  };

  const filteredTopics = topics.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Step 1 Action: Generate Hooks
  const handleGenerateHooks = async () => {
    if (!workingTopic) return;
    setLoadingHook(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/ai/hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: workingTopic,
          customInstruction: customHookHint,
          count: 3,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Lỗi khi sinh Hook.");
      }

      const hooks: string[] = data.hooks || [];
      setGeneratedHooks(hooks);
      if (hooks.length > 0) {
        setSelectedHook(hooks[0]);
      }
      setHookKeyUsed(`${data.usedKeyMasked} (${data.model})`);
      setStatusMessage({
        type: "success",
        text: `Đã tạo ${hooks.length} phương án Hook bằng Key luân phiên ${data.usedKeyMasked}! Hãy chọn hoặc chỉnh sửa Hook bên dưới rồi bấm Tạo Bài Viết Cuối Cùng.`,
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi tạo Hook",
      });
    } finally {
      setLoadingHook(false);
    }
  };

  // Step 2 Action: Generate Final Post from Prompt 1-4 + Info 1-4 + Hook
  const handleGenerateFinalPost = async () => {
    if (!workingTopic) return;
    if (!selectedHook.trim()) {
      setStatusMessage({
        type: "error",
        text: "Bạn vui lòng bấm 'Tạo Hook' hoặc tự nhập câu Hook mở đầu ở Bước 2 trước khi tạo bài viết cuối cùng.",
      });
      return;
    }

    setLoadingPost(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/ai/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: workingTopic,
          selectedHook,
          mode: executionMode,
          activePrompts,
          toneInstruction,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Lỗi khi tạo bài viết cuối cùng.");
      }

      setFinalPost(data.finalPost || "");
      setStepOutputs(data.steps || []);
      setPostKeysUsed(data.totalKeysUsed || []);
      setActivePreviewTab("editor");
      setStatusMessage({
        type: "success",
        text: `Đã hoàn thành Bài Viết Cuối Cùng theo chế độ "${
          executionMode === "modular"
            ? "Ghép từng phần (Prompt 1-4)"
            : executionMode === "chaining"
            ? "Chạy nối tiếp (Chaining 1->4)"
            : "Tổng hợp nhanh"
        }"! Đã luân phiên qua ${
          (data.totalKeysUsed || []).length
        } lượt gọi Gemini Key.`,
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi tạo bài viết cuối cùng",
      });
    } finally {
      setLoadingPost(false);
    }
  };

  // Step 4 Action: Check token threshold & prompt user if exceeding limit
  const handleInitiateImageGeneration = () => {
    if (!workingTopic) {
      setStatusMessage({
        type: "error",
        text: "Vui lòng chọn một chủ đề ở Bước 1 trước khi tạo ảnh AI.",
      });
      return;
    }

    const estimatedTokens = aiImageCount * ESTIMATED_TOKENS_PER_IMAGE;
    const isOverLimit =
      estimatedTokens > SAFE_TOKEN_THRESHOLD ||
      (activeKeysCount > 0 && activeKeysCount < aiImageCount);

    if (isOverLimit) {
      setPendingImageCount(aiImageCount);
      setShowTokenWarningModal(true);
    } else {
      executeGenerateAiImages(aiImageCount);
    }
  };

  // Execute AI image generation with specific count
  const executeGenerateAiImages = async (countToGenerate: number) => {
    setShowTokenWarningModal(false);
    if (!workingTopic) return;

    setGeneratingAiImage(true);
    setStatusMessage({
      type: "info",
      text: `Đang dùng AI tạo ${countToGenerate} ảnh cho chủ đề "${workingTopic.title}" (phong cách: ${aiImageStyle}, dự toán ~${countToGenerate * ESTIMATED_TOKENS_PER_IMAGE} tokens)...`,
    });

    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_image",
          topicTitle: workingTopic.title,
          entity: workingTopic.entity,
          summaryText: finalPost || workingTopic.info1 || workingTopic.title,
          style: aiImageStyle,
          customPrompt: showAiCustomPrompt ? aiImagePrompt : undefined,
          aspectRatio: aiAspectRatio,
          count: countToGenerate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi tạo ảnh AI");

      const items: GeneratedImageItem[] = data.images || [];
      setGeneratedGallery(items);

      if (items.length > 0) {
        setImageBase64(items[0].imageBase64);
        setImageUrl(items[0].imageUrl);
        setImageFileName(`AI_${countToGenerate}anh_${workingTopic.title.replace(/\s+/g, "_")}.jpg`);
        setAiImagePrompt(items[0].optimizedPrompt);
      } else {
        setImageBase64(data.imageBase64 || "");
        setImageUrl(data.imageUrl || "");
        setImageFileName(`AI_${workingTopic.title.replace(/\s+/g, "_")}.jpg`);
        setAiImagePrompt(data.optimizedPrompt || "");
      }

      setStatusMessage({
        type: "success",
        text: `Đã tạo thành công bộ ${items.length || countToGenerate} ảnh AI theo chủ đề "${workingTopic.title}"! Đã sử dụng ước tính ~${data.tokensUsedEstimated || countToGenerate * ESTIMATED_TOKENS_PER_IMAGE} tokens. Bạn có thể chọn ảnh bên dưới để đính kèm vào Facebook.`,
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi sinh ảnh AI",
      });
    } finally {
      setGeneratingAiImage(false);
    }
  };

  // Handle local image upload -> Base64
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageBase64(reader.result);
        setImageUrl("");
      }
    };
    reader.readAsDataURL(file);
  };

  // Step 3 Action: Publish to Facebook Page or Save Draft
  const handlePublishOrSave = async (saveAsDraftOnly: boolean) => {
    if (!workingTopic || !finalPost.trim()) {
      setStatusMessage({
        type: "error",
        text: "Chưa có nội dung bài viết cuối cùng để đăng hoặc lưu.",
      });
      return;
    }

    setPublishing(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/facebook/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicTitle: workingTopic.title,
          hook: selectedHook,
          content: finalPost,
          imageUrl: imageUrl.trim() || undefined,
          imageBase64: imageBase64 || undefined,
          saveAsDraftOnly,
          modeUsed: executionMode,
          scheduledAt: isScheduled && scheduledTime ? scheduledTime : undefined,
          seoScore: seoEval.totalScore,
          seoBreakdown: JSON.stringify(seoEval.metrics),
          policyWarnings: policyScan.violations.map((v) => v.matchedText).join(", "),
          policyStatus: policyScan.riskLevel,
          hashtags: generatedHashtags?.formattedBlock || undefined,
          altText: imageAltText || undefined,
          imageCaption: imageCaptionText || undefined,
          contentStyle: selectedStyle,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Lỗi khi xử lý đăng bài");
      }

      if (saveAsDraftOnly) {
        setStatusMessage({
          type: "success",
          text: isScheduled && scheduledTime
            ? `Đã lên lịch đăng bài vào ${scheduledTime}!`
            : "Đã lưu bài viết vào danh sách Bản nháp (Lịch sử)!",
        });
      } else {
        setStatusMessage({
          type: "success",
          text: "Đăng bài lên Facebook Page thành công!",
          link: data.item?.fbPostUrl,
        });
      }
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi đăng bài Facebook",
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleSelectStyle = (styleId: ContentStyleVariation) => {
    setSelectedStyle(styleId);
    const prompt = getStylePrompt(styleId);
    setToneInstruction(prompt);
  };

  const handleGenerateHashtags = () => {
    if (!workingTopic) return;
    const tags = generateThreeTierHashtags(workingTopic.title, workingTopic.entity, finalPost);
    setGeneratedHashtags(tags);
  };

  const handleAppendHashtagsToPost = () => {
    if (!generatedHashtags || generatedHashtags.allCombined.length === 0) return;
    const updated = appendHashtags(finalPost, generatedHashtags.allCombined);
    setFinalPost(updated);
    setStatusMessage({
      type: "success",
      text: `Đã chèn ${generatedHashtags.allCombined.length} hashtag chuẩn SEO vào cuối bài viết!`,
    });
  };

  const handleSuggestImageSeo = () => {
    if (!workingTopic) return;
    const safeTitle = workingTopic.title || "Nội dung Facebook";
    const safeEntity = workingTopic.entity || "Thương hiệu";
    setImageAltText(`Hình ảnh minh họa chuyên nghiệp cho chủ đề ${safeTitle} của ${safeEntity}, sắc nét, ánh sáng tự nhiên.`);
    setImageCaptionText(`[Hình ảnh] ${safeTitle} - Khám phá góc nhìn chuyên sâu cùng ${safeEntity} ✨`);
    setStatusMessage({
      type: "success",
      text: "Đã sinh Alt Text và Caption chuẩn SEO cho hình ảnh!",
    });
  };

  const handleCopyPost = () => {
    if (!finalPost) return;
    navigator.clipboard.writeText(finalPost);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const previewImageSrc = imageBase64 || imageUrl.trim() || "";

  return (
    <div className="space-y-6">
      {/* Status Notification Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 shadow-sm ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : statusMessage.type === "error"
              ? "bg-red-50 border-red-200 text-red-900"
              : "bg-blue-50 border-blue-200 text-blue-900"
          }`}
        >
          <div className="flex items-start gap-2.5 text-sm">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium">{statusMessage.text}</p>
              {statusMessage.link && (
                <a
                  href={statusMessage.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold underline mt-1 text-emerald-800 hover:text-emerald-950"
                >
                  <span>Xem bài đăng trực tiếp trên Facebook Page</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-medium opacity-70 hover:opacity-100"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Main 2-Column Studio Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 cols): Step 1 (Select Topic & Inspect Sheet Row) -> Step 2 (Generate & Approve Hook) -> Step 3 (Run Prompt 1-4) */}
        <div className="xl:col-span-7 space-y-6">
          {/* STEP 1 CARD: CHỌN CHỦ ĐỀ (XÃ / ĐỊA PHƯƠNG) & BỘ THÔNG TIN 1-4 / PROMPT 1-4 */}
          <section
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative"
          >
            {/* Drag overlay when topics are already loaded */}
            {isDraggingFile && topics.length > 0 && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="absolute inset-0 z-40 bg-blue-600/95 backdrop-blur-xs flex flex-col items-center justify-center text-white p-6 rounded-2xl border-2 border-dashed border-white animate-in fade-in duration-150"
              >
                <Upload className="w-12 h-12 animate-bounce mb-3 text-white" />
                <p className="text-base font-bold">Thả file Excel (.xlsx, .xls) hoặc CSV vào đây</p>
                <p className="text-xs text-blue-100 mt-1">Hệ thống sẽ nạp dữ liệu và cập nhật danh sách chủ đề ngay lập tức</p>
              </div>
            )}

            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  1
                </span>
                <div>
                  <h2 className="font-bold text-slate-900 text-base">
                    Chọn Chủ Đề Từ Trang Sheet (Kéo Thả File Laptop hoặc Link Sheet)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Kéo thả file Excel/CSV vào đây, dán link Google Sheet hoặc chọn từ máy để nạp Thông tin 1–4 &amp; Prompt 1–4
                  </p>
                </div>
              </div>

              {workingTopic && (
                <button
                  onClick={() => setShowDataInspector(!showDataInspector)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
                >
                  {showDataInspector ? (
                    <>
                      <span>Thu gọn Thông tin &amp; Prompt 1–4</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Xem / Sửa Thông tin &amp; Prompt 1–4</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="p-5 space-y-4">
              {/* Direct Google Sheet Sync Input + Laptop File Upload right inside Step 1 */}
              <form
                onSubmit={handleQuickSyncSheet}
                className="flex flex-col sm:flex-row gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80"
              >
                <div className="relative flex-1">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={quickSheetUrl}
                    onChange={(e) => setQuickSheetUrl(e.target.value)}
                    placeholder="Dán link Google Sheet của bạn vào đây để tải danh sách Chủ đề..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={syncingQuickSheet || !quickSheetUrl.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition cursor-pointer shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      syncingQuickSheet ? "animate-spin" : ""
                    }`}
                  />
                  <span>Tải Link Sheet</span>
                </button>

                <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn File Từ Laptop (.xlsx / .csv)</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleLaptopSheetUpload}
                    className="hidden"
                  />
                </label>
              </form>

              {topics.length === 0 ? (
                <div
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`group relative p-8 md:p-10 text-center rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
                    isDraggingFile
                      ? "border-blue-500 bg-blue-50/80 ring-4 ring-blue-500/20 scale-[1.01]"
                      : "border-slate-300 hover:border-blue-400 bg-slate-50/70 hover:bg-blue-50/30"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleLaptopSheetUpload}
                    className="hidden"
                  />

                  <div className="flex flex-col items-center justify-center space-y-3.5 max-w-md mx-auto">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                        isDraggingFile
                          ? "bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/30"
                          : "bg-blue-100 text-blue-600 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white"
                      }`}
                    >
                      {syncingQuickSheet ? (
                        <RefreshCw className="w-7 h-7 animate-spin" />
                      ) : isDraggingFile ? (
                        <Upload className="w-7 h-7 animate-bounce" />
                      ) : (
                        <FileSpreadsheet className="w-7 h-7" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800">
                        {isDraggingFile
                          ? "Thả file Excel / CSV vào đây ngay để tải dữ liệu..."
                          : syncingQuickSheet
                          ? "Đang nạp và phân tích file bảng tính..."
                          : "Kéo & Thả file Excel hoặc CSV vào đây"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {isDraggingFile
                          ? "Thả chuột ra để hệ thống tự động nạp danh sách chủ đề"
                          : "hoặc click chuột vào khung này để chọn file từ máy tính của bạn"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        .xlsx
                      </span>
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        .xls
                      </span>
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        .csv
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Chọn File Từ Laptop</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Search & Select Topic Row */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm nhanh tên xã / chủ đề..."
                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div className="md:col-span-7">
                      <select
                        value={selectedTopicId}
                        onChange={(e) => handleSelectTopic(e.target.value)}
                        disabled={loadingSheets}
                        aria-label="Chọn Chủ đề hoặc Xã từ trang Sheet"
                        className="w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50/80 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {filteredTopics.length === 0 ? (
                          <option value="">
                            -- Không tìm thấy chủ đề phù hợp --
                          </option>
                        ) : (
                          filteredTopics.map((t) => (
                            <option key={t.id} value={t.id}>
                              [Dòng #{t.rowIndex}] {t.title}{t.entity ? ` (Entity: ${t.entity})` : ""}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Quick Topic Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {filteredTopics.slice(0, 10).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTopic(t.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition inline-flex items-center gap-1.5 ${
                          selectedTopicId === t.id
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        <span>{t.title}</span>
                        {t.entity && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${
                              selectedTopicId === t.id
                                ? "bg-blue-500 text-blue-100"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {t.entity}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Inspector / Live Editor for Info 1-4 and Prompt 1-4 of selected topic */}
              {showDataInspector && workingTopic && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Dữ liệu đầu vào của:{" "}
                      <strong className="text-blue-700">
                        {workingTopic.title}
                      </strong>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Có thể sửa trực tiếp chủ đề, entity &amp; nội dung bên dưới trước khi chạy AI
                    </span>
                  </div>

                  {/* Entity & Title Editor */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 bg-purple-50/60 rounded-xl border border-purple-100">
                    <div className="md:col-span-5">
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Chủ đề / Tiêu đề:
                      </label>
                      <input
                        type="text"
                        value={workingTopic.title}
                        onChange={(e) =>
                          setWorkingTopic({
                            ...workingTopic,
                            title: e.target.value,
                          })
                        }
                        placeholder="VD: Xã Hải Bối, Đông Anh..."
                        className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="md:col-span-7">
                      <label className="block text-xs font-bold text-purple-900 mb-1 flex items-center justify-between">
                        <span>Thực thể chính (Entity / SEO Brand / Địa danh):</span>
                        <span className="text-[10px] font-normal text-purple-600 font-mono">
                          Dùng biến &#123;entity&#125; trong Prompt
                        </span>
                      </label>
                      <input
                        type="text"
                        value={workingTopic.entity || ""}
                        onChange={(e) =>
                          setWorkingTopic({
                            ...workingTopic,
                            entity: e.target.value,
                          })
                        }
                        placeholder="VD: Xã Hải Bối, Cầu Nhật Tân, BRG Smart City..."
                        className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-purple-300 bg-white focus:outline-none focus:border-purple-600 placeholder:text-purple-300 text-purple-950"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {([1, 2, 3, 4] as const).map((num) => {
                      const infoKey = `info${num}` as const;
                      const promptKey = `prompt${num}` as const;
                      const isEnabled = activePrompts[num - 1];

                      return (
                        <div
                          key={num}
                          className={`p-3.5 rounded-xl border transition ${
                            isEnabled
                              ? "bg-slate-50/70 border-slate-200"
                              : "bg-slate-100/50 border-slate-200/60 opacity-60"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) => {
                                  const next = [...activePrompts];
                                  next[num - 1] = e.target.checked;
                                  setActivePrompts(next);
                                }}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span>Cặp Thông tin {num} &amp; Prompt {num}</span>
                            </label>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500">
                              #{num}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <div className="text-[11px] font-medium text-slate-500 mb-0.5">
                                Thông tin {num}:
                              </div>
                              <textarea
                                rows={2}
                                value={workingTopic[infoKey]}
                                onChange={(e) =>
                                  setWorkingTopic({
                                    ...workingTopic,
                                    [infoKey]: e.target.value,
                                  })
                                }
                                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <div className="text-[11px] font-medium text-indigo-600 mb-0.5">
                                Prompt {num}:
                              </div>
                              <textarea
                                rows={2}
                                value={workingTopic[promptKey]}
                                onChange={(e) =>
                                  setWorkingTopic({
                                    ...workingTopic,
                                    [promptKey]: e.target.value,
                                  })
                                }
                                className="w-full text-xs p-2 rounded-lg border border-indigo-200/80 bg-indigo-50/30 text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* STEP 2 CARD: SINH & DUYỆT HOOK MỞ ĐẦU */}
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  2
                </span>
                <div>
                  <h2 className="font-bold text-slate-900 text-base">
                    Nhận &amp; Chốt Câu Hook Mở Đầu
                  </h2>
                  <p className="text-xs text-slate-500">
                    Sinh các phương án Hook thu hút cho{" "}
                    <strong className="text-slate-700">
                      {workingTopic?.title || "chủ đề đang chọn"}
                    </strong>{" "}
                    trước khi chạy chuỗi Prompt 1–4
                  </p>
                </div>
              </div>

              {hookKeyUsed && (
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Key: {hookKeyUsed}
                </span>
              )}
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={customHookHint}
                  onChange={(e) => setCustomHookHint(e.target.value)}
                  placeholder="Gợi ý thêm cho Hook (Không bắt buộc)"
                  className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleGenerateHooks}
                  disabled={loadingHook || !workingTopic}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm shadow-indigo-600/20 transition cursor-pointer shrink-0"
                >
                  {loadingHook ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang tạo Hook...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      <span>
                        {generatedHooks.length > 0
                          ? "Tạo Lại 3 Hook Khác"
                          : "Tạo 3 Phương Án Hook"}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Generated Hook Options */}
              {generatedHooks.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-600">
                    Chọn 1 phương án Hook gợi ý bên dưới (hoặc chỉnh sửa trực tiếp ở ô Hook đã chốt):
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {generatedHooks.map((h, idx) => {
                      const isChosen = selectedHook === h;
                      const labels = [
                        "Gợi tò mò / Tin nóng",
                        "Cảm xúc / Tự hào",
                        "Câu hỏi tương tác",
                      ];
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedHook(h)}
                          className={`p-3.5 rounded-xl border text-sm cursor-pointer transition flex items-start gap-3 ${
                            isChosen
                              ? "bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/15"
                              : "bg-white border-slate-200 hover:border-indigo-300"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                              isChosen
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {isChosen ? <Check className="w-3 h-3" /> : idx + 1}
                          </div>
                          <div className="flex-1 space-y-1">
                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              Phương án {idx + 1}: {labels[idx] || "Hook thu hút"}
                            </span>
                            <p className="text-slate-800 leading-relaxed">{h}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Editable Approved Hook Box */}
              <div className="pt-1">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Câu Hook mở đầu đã chốt (sẽ dùng để dẫn dắt Bài Viết Cuối Cùng):
                </label>
                <textarea
                  rows={2}
                  value={selectedHook}
                  onChange={(e) => setSelectedHook(e.target.value)}
                  placeholder="Bấm 'Tạo 3 Phương Án Hook' ở trên hoặc tự gõ câu Hook mở đầu của bạn tại đây..."
                  className="w-full p-3 text-sm font-medium rounded-xl border border-slate-300 bg-amber-50/30 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>
          </section>

          {/* STEP 3 CARD: CHỌN CHẾ ĐỘ CHẠY PROMPT 1-4 & TẠO BÀI VIẾT CUỐI CÙNG */}
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  3
                </span>
                <div>
                  <h2 className="font-bold text-slate-900 text-base">
                    Chạy Bộ Prompt 1–4 &amp; Xuất Bài Viết Cuối Cùng
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tùy chọn cơ chế kết hợp Thông tin 1–4 và Prompt 1–4 theo nhu cầu của bạn
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* 3 Mode Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setExecutionMode("modular")}
                  className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                    executionMode === "modular"
                      ? "bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-500/15"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Khuyên dùng
                      </span>
                    </div>
                    <div className="font-bold text-sm text-slate-900">
                      1. Ghép Từng Phần
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Chạy độc lập từng cặp (TT 1 + Prompt 1 &rarr; 4) với 4 Key xoay vòng rồi ghép cùng Hook.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExecutionMode("chaining")}
                  className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                    executionMode === "chaining"
                      ? "bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-500/15"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <GitBranch className="w-4 h-4 text-blue-600" />
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        Chaining
                      </span>
                    </div>
                    <div className="font-bold text-sm text-slate-900">
                      2. Chạy Nối Tiếp 1&rarr;4
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Kết quả Prompt 1 truyền làm đầu vào cho Prompt 2 &rarr; Prompt 3 &rarr; Prompt 4 để tinh chỉnh sâu.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExecutionMode("synthesis")}
                  className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                    executionMode === "synthesis"
                      ? "bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-500/15"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                        Siêu tốc (1 lượt)
                      </span>
                    </div>
                    <div className="font-bold text-sm text-slate-900">
                      3. Tổng Hợp Nhanh
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Gộp Hook + toàn bộ Thông tin 1–4 &amp; Prompt 1–4 biên tập mượt mà trong 1 lần gọi AI.
                    </p>
                  </div>
                </button>
              </div>

              {/* A/B Content Style Variations Selector */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Target className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Phong Cách Viết Bài (A/B Content Variations):</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">Tối ưu theo mục tiêu chuyển đổi</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {stylePresets.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => handleSelectStyle(style.id)}
                      className={`p-2.5 rounded-lg border text-left transition text-xs flex flex-col justify-between cursor-pointer ${
                        selectedStyle === style.id
                          ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 font-bold text-indigo-950 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-1">
                        {style.id === "storytelling" && <BookOpen className="w-3 h-3 text-indigo-600" />}
                        {style.id === "direct_sales" && <Target className="w-3 h-3 text-emerald-600" />}
                        {style.id === "news_guide" && <Newspaper className="w-3 h-3 text-blue-600" />}
                        {style.id === "humorous_trend" && <Sparkles className="w-3 h-3 text-amber-500" />}
                        <span>{style.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 line-clamp-2 mt-1 font-normal leading-relaxed">{style.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Tone Instruction + Generate Final Post Button */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <div className="relative flex-1">
                  <SlidersHorizontal className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={toneInstruction}
                    onChange={(e) => setToneInstruction(e.target.value)}
                    placeholder="Ghi chú giọng văn bổ sung (Tùy chọn)"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <button
                  onClick={handleGenerateFinalPost}
                  disabled={loadingPost || !workingTopic}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer shrink-0"
                >
                  {loadingPost ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang chạy chuỗi Prompt 1–4...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Tạo Bài Viết Cuối Cùng</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (5 cols): Final Post Editor + Intermediate Steps Viewer + Facebook Live Preview & Publish */}
        <div className="xl:col-span-5 space-y-6">
          {/* FINAL POST & STEP BREAKDOWN CARD */}
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/60">
              <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
                <button
                  onClick={() => setActivePreviewTab("editor")}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                    activePreviewTab === "editor"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Bài Viết Cuối Cùng
                </button>
                <button
                  onClick={() => setActivePreviewTab("steps")}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                    activePreviewTab === "steps"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Chi Tiết Bước Prompt ({stepOutputs.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {postKeysUsed.length > 0 && (
                  <span
                    title={`Các Key đã luân phiên: ${postKeysUsed.join(", ")}`}
                    className="text-[11px] font-mono px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    {postKeysUsed.length} Key xoay vòng
                  </span>
                )}
                <button
                  onClick={handleCopyPost}
                  disabled={!finalPost}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Đã Copy</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy bài</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {activePreviewTab === "editor" ? (
              <div className="p-4 space-y-4">
                <div>
                  <textarea
                    rows={10}
                    value={finalPost}
                    onChange={(e) => setFinalPost(e.target.value)}
                    placeholder="Bài viết cuối cùng sau khi chạy Hook + Prompt 1–4 sẽ hiển thị tại đây..."
                    className="w-full p-3.5 text-sm leading-relaxed rounded-xl border border-slate-200 bg-slate-50/40 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-1">
                    <span>Độ dài: {finalPost.length} ký tự</span>
                    <span>Hỗ trợ xuống dòng &amp; biểu tượng cảm xúc Facebook</span>
                  </div>
                </div>

                {/* 1. FACEBOOK POLICY GUARD & ANTI-SHADOWBAN SCANNER */}
                {finalPost.trim() && (
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      policyScan.riskLevel === "danger"
                        ? "bg-red-50/85 border-red-300 text-red-950"
                        : policyScan.riskLevel === "warning"
                        ? "bg-amber-50/85 border-amber-300 text-amber-950"
                        : "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {policyScan.riskLevel === "danger" ? (
                          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                        ) : policyScan.riskLevel === "warning" ? (
                          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                        ) : (
                          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-bold flex items-center gap-1.5">
                            <span>
                              {policyScan.riskLevel === "danger"
                                ? "🚨 Nguy Cơ Bóp Reach / Vi Phạm Chính Sách Meta"
                                : policyScan.riskLevel === "warning"
                                ? "⚠️ Cảnh Báo: Phát Hiện Từ Khóa Nhạy Cảm Facebook"
                                : "✅ Nội Dung An Toàn: Chuẩn Chính Sách Meta"}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                                policyScan.riskLevel === "danger"
                                  ? "bg-red-200 text-red-800"
                                  : policyScan.riskLevel === "warning"
                                  ? "bg-amber-200 text-amber-800"
                                  : "bg-emerald-200 text-emerald-800"
                              }`}
                            >
                              Rủi ro: {policyScan.riskScore}/100
                            </span>
                          </div>
                          <div className="text-[11px] opacity-80 mt-0.5">
                            {policyScan.isSafe
                              ? "Bài viết không chứa các từ khóa cam kết 100%, trị dứt điểm hay link spam gây shadowban."
                              : `Phát hiện ${policyScan.violations.length} điểm có nguy cơ khiến Facebook bóp tương tác hoặc cảnh cáo trang.`}
                          </div>
                        </div>
                      </div>

                      {!policyScan.isSafe && (
                        <button
                          type="button"
                          onClick={() => {
                            const sanitized = autoSanitizeAll(finalPost);
                            setFinalPost(sanitized);
                            setStatusMessage({
                              type: "success",
                              text: "Đã tự động thay thế tất cả từ khóa nhạy cảm bằng từ ngữ an toàn!",
                            });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white shadow-xs border border-slate-300 hover:bg-slate-50 text-slate-800 transition cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          <span>Tự Động Sửa Tất Cả</span>
                        </button>
                      )}
                    </div>

                    {/* Violation items with quick fix suggestions */}
                    {policyScan.violations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-2">
                        {policyScan.violations.map((v) => (
                          <div
                            key={v.id}
                            className="p-2.5 rounded-lg bg-white/90 border border-slate-200 text-xs space-y-1.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 text-[11px]">
                                  &quot;{v.matchedText}&quot;
                                </span>
                                <span className="text-slate-600 font-medium">
                                  ({v.label})
                                </span>
                              </div>
                              <span className="text-[10px] uppercase font-bold text-slate-400">
                                {v.severity}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              {v.explanation}
                            </p>
                            {v.suggestions.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[10px] font-semibold text-slate-500">
                                  Gợi ý sửa an toàn:
                                </span>
                                {v.suggestions.map((sug, sIdx) => (
                                  <button
                                    key={sIdx}
                                    type="button"
                                    onClick={() => {
                                      const updated = applyPolicyFix(
                                        finalPost,
                                        v.id,
                                        sug
                                      );
                                      setFinalPost(updated);
                                    }}
                                    className="px-2 py-0.5 text-[11px] font-medium rounded bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                                  >
                                    + Thay bằng &quot;{sug}&quot;
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. SOCIAL SEO & READABILITY SCORECARD */}
                {finalPost.trim() && (
                  <div className="p-4 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center text-sm shadow-xs ${
                            seoEval.totalScore >= 80
                              ? "bg-emerald-600 text-white"
                              : seoEval.totalScore >= 60
                              ? "bg-blue-600 text-white"
                              : seoEval.totalScore >= 40
                              ? "bg-amber-500 text-white"
                              : "bg-red-500 text-white"
                          }`}
                        >
                          {seoEval.totalScore}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>Social SEO &amp; Readability Scorecard</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                seoEval.grade === "excellent"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : seoEval.grade === "good"
                                  ? "bg-blue-100 text-blue-800"
                                  : seoEval.grade === "average"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {seoEval.grade === "excellent"
                                ? "Xuất sắc"
                                : seoEval.grade === "good"
                                ? "Đạt chuẩn"
                                : seoEval.grade === "average"
                                ? "Trung bình"
                                : "Cần cải thiện"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Chấm điểm theo thuật toán giữ chân (Dwell Time) và tìm kiếm Facebook
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowSeoDetails(!showSeoDetails)}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <span>
                          {showSeoDetails
                            ? "Thu gọn tiêu chí"
                            : "Xem 6 tiêu chí chi tiết"}
                        </span>
                        {showSeoDetails ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Quick Metrics Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="p-2 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">
                          Độ dài bài viết
                        </span>
                        <span className="font-bold text-slate-800">
                          {seoEval.metrics.wordCount} từ
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">
                          Số đoạn văn
                        </span>
                        <span className="font-bold text-slate-800">
                          {seoEval.metrics.paragraphCount} đoạn (~
                          {seoEval.metrics.avgWordsPerParagraph} từ/đoạn)
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">
                          Mật độ từ khóa
                        </span>
                        <span className="font-bold text-slate-800">
                          {seoEval.metrics.keywordDensityPercent}% (Chuẩn 1–2.5%)
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">
                          Emoji bài đăng
                        </span>
                        <span className="font-bold text-slate-800">
                          {seoEval.metrics.emojiCount} biểu tượng
                        </span>
                      </div>
                    </div>

                    {/* Detailed Checklist */}
                    {showSeoDetails && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                        {seoEval.checks.map((c) => (
                          <div
                            key={c.id}
                            className={`flex items-start justify-between p-2 rounded-lg text-xs ${
                              c.passed
                                ? "bg-emerald-50/60 text-emerald-950"
                                : "bg-slate-50 text-slate-600"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {c.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                              )}
                              <div>
                                <span className="font-semibold">{c.label}</span>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {c.feedback}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`text-[11px] font-bold shrink-0 ml-2 ${
                                c.passed ? "text-emerald-700" : "text-slate-400"
                              }`}
                            >
                              {c.points}/{c.maxPoints} đ
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. 3-TIER HASHTAG GENERATOR & QUICK INSERT */}
                <div className="p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/30 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-900">
                        Bộ Hashtag 3 Tầng Chuẩn SEO Facebook
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateHashtags}
                        disabled={!workingTopic}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 transition cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        ✨ Tạo bộ Hashtag 3 tầng
                      </button>
                      {generatedHashtags && (
                        <button
                          type="button"
                          onClick={handleAppendHashtagsToPost}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer shadow-xs"
                        >
                          ➕ Chèn vào cuối bài
                        </button>
                      )}
                    </div>
                  </div>

                  {generatedHashtags && (
                    <div className="space-y-1.5 text-xs bg-white p-3 rounded-lg border border-slate-200">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          Tầng 1 (Entity/Brand):
                        </span>
                        {generatedHashtags.tier1Entity.map((t, idx) => (
                          <span
                            key={idx}
                            className="font-mono text-[11px] text-indigo-600 font-semibold"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          Tầng 2 (Chủ đề/Ngành):
                        </span>
                        {generatedHashtags.tier2Topic.map((t, idx) => (
                          <span
                            key={idx}
                            className="font-mono text-[11px] text-blue-600 font-semibold"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          Tầng 3 (Trend/Khám phá):
                        </span>
                        {generatedHashtags.tier3Trend.map((t, idx) => (
                          <span
                            key={idx}
                            className="font-mono text-[11px] text-amber-600 font-semibold"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Image Attachment & AI Generator Module */}
                <div className="p-4 rounded-2xl bg-gradient-to-b from-purple-50/50 to-slate-50 border border-purple-200/70 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-purple-600 text-white shadow-xs">
                        <Wand2 className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>Hình Ảnh Bài Đăng &amp; AI Tạo Ảnh Theo Chủ Đề</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Tự động sinh ảnh chuẩn kích thước Facebook hoặc tải ảnh từ máy
                        </div>
                      </div>
                    </div>

                    {(imageBase64 || imageUrl) && (
                      <div className="flex items-center gap-2">
                        {previewImageSrc && (
                          <a
                            href={previewImageSrc}
                            download={imageFileName || "ai_generated_image.jpg"}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                            title="Tải ảnh này về máy"
                          >
                            <Download className="w-3 h-3" />
                            <span>Tải ảnh</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setImageBase64("");
                            setImageUrl("");
                            setImageFileName("");
                          }}
                          className="text-[11px] text-red-600 hover:underline font-semibold"
                        >
                          Gỡ ảnh
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 3 Tabs Selection */}
                  <div className="flex rounded-xl bg-slate-200/60 p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setImageSourceTab("ai")}
                      className={`flex-1 py-1.5 rounded-lg transition inline-flex items-center justify-center gap-1.5 ${
                        imageSourceTab === "ai"
                          ? "bg-white text-purple-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>AI Tạo Ảnh (Flux)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageSourceTab("upload")}
                      className={`flex-1 py-1.5 rounded-lg transition inline-flex items-center justify-center gap-1.5 ${
                        imageSourceTab === "upload"
                          ? "bg-white text-blue-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      <span>Chọn Từ Laptop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageSourceTab("url")}
                      className={`flex-1 py-1.5 rounded-lg transition inline-flex items-center justify-center gap-1.5 ${
                        imageSourceTab === "url"
                          ? "bg-white text-slate-800 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                      <span>Dán Link URL</span>
                    </button>
                  </div>

                  {/* TAB 1: AI IMAGE GENERATION */}
                  {imageSourceTab === "ai" && (
                    <div className="space-y-3 pt-1">
                      {/* Style Presets & Aspect Ratio */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Phong cách hình ảnh:
                          </label>
                          <select
                            value={aiImageStyle}
                            onChange={(e) => setAiImageStyle(e.target.value as ImageStylePreset)}
                            className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-purple-500"
                          >
                            <option value="photorealistic">📸 Chụp ảnh thực tế (Flycam, chân thực)</option>
                            <option value="urban_planning">🏙️ Quy hoạch đô thị &amp; Thành phố thông minh</option>
                            <option value="cinematic_landscape">🌅 Phong cảnh hoàng hôn ven sông (Điện ảnh)</option>
                            <option value="facebook_editorial">📰 Báo chí / Truyền thông nổi bật (Editorial)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Tỉ lệ kích thước:
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            {(["16:9", "1:1", "4:5"] as const).map((ratio) => (
                              <button
                                key={ratio}
                                type="button"
                                onClick={() => setAiAspectRatio(ratio)}
                                className={`text-[11px] py-1.5 rounded-lg border font-semibold transition ${
                                  aiAspectRatio === ratio
                                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                {ratio === "16:9" ? "16:9 (FB ngang)" : ratio === "1:1" ? "1:1 (Vuông)" : "4:5 (Dọc)"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Image Count Selector & Token Estimation */}
                      <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-700">
                            Số lượng ảnh muốn tạo:
                          </label>
                          <span className="text-[11px] font-mono font-semibold text-purple-700">
                            {aiImageCount} ảnh (~{aiImageCount * ESTIMATED_TOKENS_PER_IMAGE} tokens)
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5">
                          {([1, 2, 3, 4] as const).map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => setAiImageCount(cnt)}
                              className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                aiImageCount === cnt
                                  ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              {cnt} Ảnh
                            </button>
                          ))}
                        </div>

                        {/* Live Token Estimation & Safety Threshold Indicator */}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-purple-200/50">
                          <span className="text-slate-500">
                            Hạn mức an toàn: <strong className="text-slate-700">{SAFE_TOKEN_THRESHOLD} tokens</strong>
                          </span>
                          {aiImageCount * ESTIMATED_TOKENS_PER_IMAGE > SAFE_TOKEN_THRESHOLD ? (
                            <span className="font-semibold text-amber-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Vượt ngưỡng an toàn (sẽ báo cáo trước)</span>
                            </span>
                          ) : (
                            <span className="font-semibold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Trong giới hạn an toàn</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Custom Prompt Toggle */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowAiCustomPrompt(!showAiCustomPrompt)}
                          className="text-[11px] text-purple-700 hover:text-purple-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Palette className="w-3 h-3" />
                          <span>
                            {showAiCustomPrompt ? "Ẩn câu lệnh Prompt ảnh" : "Tùy chỉnh Prompt ảnh bằng tay (Tùy chọn)"}
                          </span>
                        </button>
                        {showAiCustomPrompt && (
                          <div className="mt-1.5 space-y-1">
                            <textarea
                              rows={2}
                              value={aiImagePrompt}
                              onChange={(e) => setAiImagePrompt(e.target.value)}
                              placeholder="Nhập mô tả cảnh bạn muốn vẽ (hoặc để trống để AI tự sinh prompt tối ưu từ chủ đề và entity)..."
                              className="w-full p-2 text-xs rounded-lg border border-purple-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-600"
                            />
                            <div className="text-[10px] text-slate-400">
                              Mẹo: Hệ thống tự động dịch &amp; tối ưu chi tiết ánh sáng, góc chụp sang tiếng Anh cho model Flux.
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Main Action Button */}
                      <button
                        type="button"
                        onClick={handleInitiateImageGeneration}
                        disabled={generatingAiImage || !workingTopic}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white shadow-sm transition inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {generatingAiImage ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                            <span>Đang Dùng AI Tạo Bộ {aiImageCount} Ảnh (Flux.1) Theo Chủ Đề...</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4 text-amber-300" />
                            <span>
                              {previewImageSrc && imageFileName?.startsWith("AI_")
                                ? `Tạo Lại Bộ ${aiImageCount} Ảnh AI Cho "${workingTopic?.title || "Chủ Đề"}"`
                                : `Tạo Bộ ${aiImageCount} Ảnh AI Theo Chủ Đề "${workingTopic?.title || "Đang Chọn"}"`}
                            </span>
                          </>
                        )}
                      </button>

                      {/* Generated Multi-Image Gallery */}
                      {generatedGallery.length > 1 && (
                        <div className="space-y-1.5 pt-2 border-t border-purple-200/60">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                            <span>Bộ {generatedGallery.length} ảnh đã tạo (Bấm vào để chọn ảnh đại diện bài viết):</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {generatedGallery.map((item, idx) => {
                              const isSelected = previewImageSrc === (item.imageBase64 || item.imageUrl);
                              return (
                                <div
                                  key={item.id || idx}
                                  onClick={() => {
                                    setImageUrl(item.imageUrl);
                                    setImageBase64(item.imageBase64);
                                    setImageFileName(`AI_${item.label || idx + 1}.jpg`);
                                    setAiImagePrompt(item.optimizedPrompt);
                                  }}
                                  className={`relative group rounded-xl overflow-hidden border-2 cursor-pointer transition ${
                                    isSelected
                                      ? "border-purple-600 ring-2 ring-purple-500/20 shadow-md scale-[1.02]"
                                      : "border-slate-200 hover:border-purple-300"
                                  }`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={item.imageBase64 || item.imageUrl}
                                    alt={item.label || `Ảnh ${idx + 1}`}
                                    className="w-full h-18 object-cover"
                                  />
                                  <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 p-1 text-[9px] text-white truncate font-medium">
                                    {item.label}
                                  </div>
                                  {isSelected && (
                                    <div className="absolute top-1 right-1 bg-purple-600 text-white rounded-full p-0.5 shadow-xs">
                                      <Check className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: LOCAL LAPTOP FILE UPLOAD */}
                  {imageSourceTab === "upload" && (
                    <div className="pt-1">
                      <label className="w-full py-4 rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 text-blue-700 text-xs font-semibold cursor-pointer transition flex flex-col items-center justify-center gap-1.5">
                        <Upload className="w-5 h-5 text-blue-600" />
                        <span>
                          {imageFileName ? `Đã chọn: ${imageFileName}` : "Bấm để chọn file ảnh từ laptop (.jpg, .png, .webp)"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          Ảnh sẽ được đính kèm trực tiếp khi đăng lên Facebook Page
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {/* TAB 3: IMAGE URL */}
                  {imageSourceTab === "url" && (
                    <div className="pt-1 space-y-1">
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => {
                          setImageUrl(e.target.value);
                          if (e.target.value) {
                            setImageBase64("");
                            setImageFileName("");
                          }
                        }}
                        placeholder="Dán link URL ảnh (VD: https://domain.com/photo.jpg)..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-blue-500 text-slate-800"
                      />
                      <div className="text-[10px] text-slate-400">
                        Link ảnh trực tiếp có đuôi .jpg, .png hoặc link từ CDN công khai.
                      </div>
                    </div>
                  )}

                  {/* IMAGE SEO ALT-TEXT & CAPTION INPUTS */}
                  {(imageBase64 || imageUrl) && (
                    <div className="p-3 rounded-xl bg-white border border-purple-200/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-purple-600" />
                          <span>Tối Ưu SEO Hình Ảnh Facebook:</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleSuggestImageSeo}
                          className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 cursor-pointer"
                        >
                          🪄 Gợi ý Alt Text &amp; Caption SEO
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                            Alt Text (Mô tả hình ảnh cho tìm kiếm Facebook &amp; SEO):
                          </label>
                          <input
                            type="text"
                            value={imageAltText}
                            onChange={(e) => setImageAltText(e.target.value)}
                            placeholder="Mô tả trực quan hình ảnh hỗ trợ SEO..."
                            className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-purple-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                            Chú thích ảnh (Caption):
                          </label>
                          <input
                            type="text"
                            value={imageCaptionText}
                            onChange={(e) => setImageCaptionText(e.target.value)}
                            placeholder="Chú thích hiển thị cùng ảnh..."
                            className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-purple-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Steps Output Breakdown Tab */
              <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
                {loadingPost ? (
                  /* Loading State when AI is currently running steps */
                  <div className="p-8 text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-pulse">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800">
                        AI đang chạy các bước Prompt và luân phiên Gemini Key...
                      </p>
                      <p className="text-xs text-slate-500">
                        Hệ thống đang xử lý tuần tự theo chế độ &ldquo;
                        {executionMode === "modular"
                          ? "Ghép từng phần (Prompt 1–4)"
                          : executionMode === "chaining"
                          ? "Chạy nối tiếp (Chaining 1->4)"
                          : "Tổng hợp nhanh"}
                        &rdquo;
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 max-w-xs mx-auto pt-2 text-left">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>Bước 1: Chuẩn bị câu Hook &amp; Thông tin xã/địa phương...</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                        <span>Bước 2: Xử lý Prompt 1–4 với Thông tin tương ứng...</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                        <span>Bước 3: Biên tập bài viết hoàn chỉnh đăng Facebook...</span>
                      </div>
                    </div>
                  </div>
                ) : stepOutputs.length === 0 ? (
                  /* Planned Steps Roadmap Before Run */
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>Quy trình các bước AI sẽ thực hiện:</span>
                      </div>
                      <p className="text-[11px] text-blue-700 leading-relaxed">
                        Sau khi bạn bấm <strong>&ldquo;Tạo Bài Viết Cuối Cùng&rdquo;</strong>, AI sẽ thực hiện theo từng bước dưới đây và hiển thị toàn bộ nội dung chi tiết kèm mã Key Gemini đã dùng:
                      </p>
                    </div>

                    <div className="space-y-2">
                      {/* Step 0: Hook */}
                      <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold">
                              0
                            </span>
                            <span>Mở đầu (Câu Hook thu hút)</span>
                          </span>
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold border border-amber-200">
                            {selectedHook ? "Đã sẵn sàng" : "Chờ tạo Hook"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 italic line-clamp-2">
                          {selectedHook || "Chưa có Hook. Hãy bấm 'Tạo Hook' ở Bước 2 bên trái để tạo câu mở đầu."}
                        </p>
                      </div>

                      {/* Steps 1 to 4 */}
                      {([1, 2, 3, 4] as const).map((num) => {
                        const pText = workingTopic ? (workingTopic[`prompt${num}`] as string) : "";
                        const iText = workingTopic ? (workingTopic[`info${num}`] as string) : "";
                        const isActive = activePrompts[num - 1];

                        return (
                          <div
                            key={num}
                            className={`p-3 rounded-xl border transition shadow-xs ${
                              isActive
                                ? "border-slate-200 bg-white"
                                : "border-slate-200/60 bg-slate-50/50 opacity-60"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                                  {num}
                                </span>
                                <span>Bước {num}: Prompt {num} &amp; Thông tin {num}</span>
                              </span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  isActive
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {isActive ? "Kích hoạt" : "Tạm tắt"}
                              </span>
                            </div>

                            {pText ? (
                              <div className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <strong className="text-slate-700">Prompt:</strong> {pText}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400 italic">
                                Prompt {num} đang để trống trong dữ liệu bảng tính.
                              </div>
                            )}

                            {iText && (
                              <div className="text-[10px] text-slate-500 line-clamp-1 mt-1 px-1">
                                <strong>Thông tin đầu vào:</strong> {iText}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Final Assemble Step */}
                      <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                              ✓
                            </span>
                            <span>Tổng hợp bài viết cuối cùng</span>
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                            Sẵn sàng xuất bản
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800">
                          AI kết nối câu Hook mở đầu cùng kết quả 4 bước trên thành một bài viết hoàn chỉnh, chuẩn văn phong và biểu tượng cảm xúc để đăng Facebook.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Step Outputs when generated */
                  stepOutputs.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {step.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Key: {step.usedKeyMasked}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(step.output);
                              setCopiedStepIdx(idx);
                              setTimeout(() => setCopiedStepIdx(null), 2000);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
                          >
                            {copiedStepIdx === idx ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700">Đã copy</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {step.promptUsed && (
                        <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                          <strong className="text-indigo-600">Prompt đã chạy:</strong> {step.promptUsed}
                        </div>
                      )}

                      {step.infoUsed && (
                        <div className="text-[10px] text-slate-500 bg-slate-100/70 px-2 py-1 rounded">
                          <strong>Thông tin đầu vào:</strong> {step.infoUsed}
                        </div>
                      )}

                      <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                        {step.output}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          {/* FACEBOOK PAGE MOCKUP LIVE PREVIEW & PUBLISH ACTION */}
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-[#1877F2]/5">
              <span className="text-xs font-bold text-[#1877F2] uppercase tracking-wider">
                Xem Trước Giao Diện Facebook Fanpage
              </span>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  hasFbToken
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {hasFbToken ? "Đã kết nối Page Token" : "Chế độ Xem trước / Nháp"}
              </span>
            </div>

            {/* Simulated Facebook Post Card */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                  FB
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 leading-tight">
                    {pageName}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                    <span>Vừa xong</span>
                    <span>•</span>
                    <Globe className="w-3 h-3" />
                  </div>
                </div>
              </div>

              <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto pr-1">
                {finalPost ||
                  (selectedHook
                    ? `${selectedHook}\n\n(Đang chờ chạy chuỗi Prompt 1–4 để hoàn thiện toàn bộ bài viết...)`
                    : "Nội dung bài viết xem trước trên Facebook Page sẽ xuất hiện tại đây...")}
              </div>

              {previewImageSrc && (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-60 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewImageSrc}
                    alt="Facebook post attachment preview"
                    className="w-full h-full object-cover max-h-60"
                  />
                </div>
              )}

              {/* Simulated FB Likes/Comments Bar */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-around text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-1.5 py-1">
                  <ThumbsUp className="w-4 h-4" />
                  <span>Thích</span>
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <MessageCircle className="w-4 h-4" />
                  <span>Bình luận</span>
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <Share2 className="w-4 h-4" />
                  <span>Chia sẻ</span>
                </div>
              </div>
            </div>

            {/* KHUNG GIỜ VÀNG ĐĂNG BÀI & LẬP LỊCH TƯƠNG TÁC CAO */}
            <div className="p-4 bg-slate-50/80 border-t border-slate-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Khung Giờ Vàng Đăng Bài (Tương Tác Cao)</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Social SEO
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Chọn khung giờ thuật toán Facebook có lượng tương tác đỉnh
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span>Hẹn giờ đăng bài</span>
                </label>
              </div>

              {/* 4 Golden Hours Preset Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {goldenHourSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => {
                      setIsScheduled(true);
                      setScheduledTime(slot.timestamp.slice(0, 16));
                      setStatusMessage({
                        type: "info",
                        text: `Đã chọn ${slot.label}: ${slot.formattedTarget} (${slot.timeRange})`,
                      });
                    }}
                    className={`p-2.5 rounded-xl border text-left transition text-xs flex flex-col justify-between cursor-pointer ${
                      slot.isRecommendedPrime
                        ? "bg-amber-50/70 border-amber-300 hover:bg-amber-100/70 text-amber-950"
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                    } ${
                      scheduledTime.startsWith(slot.timestamp.slice(0, 10)) &&
                      slot.isRecommendedPrime
                        ? "ring-2 ring-amber-500/40"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{slot.timeRange}</span>
                      {slot.isRecommendedPrime && (
                        <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full">
                          PRIME ⭐
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] opacity-75 mt-1 font-medium">
                      {slot.label}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                      {slot.formattedTarget}
                    </div>
                  </button>
                ))}
              </div>

              {isScheduled && (
                <div className="flex items-center gap-2 pt-1">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 shrink-0">
                    Thời điểm hẹn:
                  </span>
                  <input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-blue-500 flex-1"
                  />
                </div>
              )}
            </div>

            {/* Publish & Save Draft Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => handlePublishOrSave(true)}
                disabled={publishing || !finalPost.trim()}
                className="sm:w-2/5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isScheduled && scheduledTime ? "Lưu Lịch Hẹn" : "Lưu Bản Nháp"}</span>
              </button>

              <button
                type="button"
                onClick={() => handlePublishOrSave(false)}
                disabled={publishing || !finalPost.trim()}
                className="sm:w-3/5 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#1877F2] hover:bg-[#166fe5] disabled:opacity-50 text-white shadow-md shadow-blue-600/20 transition cursor-pointer"
              >
                {publishing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang đăng lên Page...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {isScheduled && scheduledTime
                        ? `Lên Lịch Đăng (${scheduledTime.replace("T", " ")})`
                        : "Đăng Ngay Lên Facebook Page"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Modal Cảnh báo & Báo cáo Lượng Token Vượt Ngưỡng Trước Khi Tạo Ảnh */}
      {showTokenWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Báo Cáo Dự Toán Token &amp; Giới Hạn Quota API Key
                </h3>
                <p className="text-xs text-slate-500">
                  Cảnh báo trước khi thực hiện để đảm bảo an toàn cho hệ thống Key
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-medium">Số lượng ảnh yêu cầu:</span>
                <span className="font-bold text-slate-900 text-sm px-2 py-0.5 rounded bg-white border border-amber-200">
                  {pendingImageCount} ảnh
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-medium">Lượng Token ước tính:</span>
                <span className="font-bold text-amber-800 text-sm">
                  ~{pendingImageCount * ESTIMATED_TOKENS_PER_IMAGE} Tokens
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-medium">Ngưỡng giới hạn an toàn:</span>
                <span className="font-semibold text-emerald-700">
                  {SAFE_TOKEN_THRESHOLD} Tokens (~2 ảnh)
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-medium">Trạng thái Pool Key:</span>
                <span className="font-mono font-semibold text-indigo-700">
                  {activeKeysCount} / {totalKeysCount} Key hoạt động
                </span>
              </div>

              <div className="pt-2 border-t border-amber-200/60 text-[11px] text-amber-900 leading-relaxed">
                ⚠️ <strong>Báo cáo phân tích:</strong> Việc tạo {pendingImageCount} ảnh cùng lúc yêu cầu khoảng ~{pendingImageCount * ESTIMATED_TOKENS_PER_IMAGE} tokens và gửi {pendingImageCount} lượt gọi API liên tiếp đến Gemini để biên soạn prompt thị giác tiếng Anh. Nếu các API Key chạm ngưỡng RPM tạm thời (15 lượt/phút), hệ thống sẽ cần xoay vòng sang key khác.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  const reduced = Math.max(1, pendingImageCount <= 2 ? 1 : 2);
                  setAiImageCount(reduced);
                  executeGenerateAiImages(reduced);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Giảm Xuống {pendingImageCount <= 2 ? 1 : 2} Ảnh (Tiết kiệm Token)</span>
              </button>

              <button
                type="button"
                onClick={() => executeGenerateAiImages(pendingImageCount)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Tiếp Tục Tạo ({pendingImageCount} Ảnh)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTokenWarningModal(false)}
                className="px-3.5 py-2.5 rounded-xl font-semibold text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
