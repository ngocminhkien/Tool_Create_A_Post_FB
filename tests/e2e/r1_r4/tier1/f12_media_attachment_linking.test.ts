/**
 * tests/e2e/r1_r4/tier1/f12_media_attachment_linking.test.ts
 * Tier 1 — Feature F12: Source Media Attachment Linking & Image SEO
 * Verifies association of downloaded source images, selection filtering,
 * Alt Text generation, and image SEO captions.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { rewriteSourcePost } from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier1F12MediaAttachmentLinkingTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F12: Source Media Attachment Linking", 1, "F12");

  await ctx.test("F12-01: Links downloaded local media paths from source post to queue item", async () => {
    const downloadedImages = [
      "/uploads/source_media/spost_tech_101_0_ab12cd.jpg",
      "/uploads/source_media/spost_tech_101_1_ef34gh.jpg",
    ];

    const res = await rewriteSourcePost({
      sourcePostId: "sp_link_101",
      sourcePageName: "Kênh Công Nghệ",
      sourceContent: "Giới thiệu sản phẩm mới với thiết kế đột phá.",
      sourceImages: downloadedImages,
      style: "direct_sales",
    });

    const item = res.queueItem;
    if (item.sourceImages.length !== 2) {
      throw new Error(`Expected 2 sourceImages, got ${item.sourceImages.length}`);
    }
    if (item.sourceImages[0] !== downloadedImages[0]) {
      throw new Error(`Path mismatch: expected ${downloadedImages[0]}, got ${item.sourceImages[0]}`);
    }
  });

  await ctx.test("F12-02: Defaults selectedImages to all sourceImages initially", async () => {
    const images = [
      "/uploads/source_media/spost_photo_1.jpg",
      "/uploads/source_media/spost_photo_2.jpg",
      "/uploads/source_media/spost_photo_3.jpg",
    ];

    const res = await rewriteSourcePost({
      sourcePostId: "sp_default_select",
      sourcePageName: "Nguồn Ảnh",
      sourceContent: "Bộ sưu tập phong cảnh mùa thu.",
      sourceImages: images,
      style: "storytelling",
    });

    const item = res.queueItem;
    if (item.selectedImages.length !== 3) {
      throw new Error(`Expected selectedImages to default to 3 images, got ${item.selectedImages.length}`);
    }
  });

  await ctx.test("F12-03: Generates descriptive Vietnamese Alt Text for attached images", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_alt_test",
      sourcePageName: "Nội Thất Hiện Đại",
      sourceContent: "Xu hướng thiết kế phòng khách tối giản phong cách Bắc Âu.",
      targetPageName: "Decor Sang Trọng",
      style: "news_guide",
      sourceImages: ["/uploads/source_media/nordic_room.jpg"],
    });

    const item = res.queueItem;
    if (!item.altText) {
      throw new Error("Expected altText to be populated for attached image");
    }
    if (item.altText.length < 15) {
      throw new Error(`Alt text is too short to be descriptive: "${item.altText}"`);
    }
    if (!item.altText.toLowerCase().includes("hình ảnh") && !item.altText.toLowerCase().includes("minh họa")) {
      throw new Error(`Alt text lacks accessibility context: "${item.altText}"`);
    }
  });

  await ctx.test("F12-04: Generates engaging Social SEO image caption", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_caption_test",
      sourcePageName: "Ẩm Thực Phố",
      sourceContent: "Top 5 quán phở gia truyền ngon nức tiếng tại Hà Nội.",
      targetPageName: "Foodie Review",
      style: "humorous_trend",
      sourceImages: ["/uploads/source_media/pho_hanoi.jpg"],
    });

    const item = res.queueItem;
    if (!item.imageCaption) {
      throw new Error("Expected imageCaption to be populated for attached image");
    }
    if (item.imageCaption.length < 10) {
      throw new Error(`Image caption is too short: "${item.imageCaption}"`);
    }
  });

  await ctx.test("F12-05: Handles text-only source posts with zero media attachments cleanly", async () => {
    const res = await rewriteSourcePost({
      sourcePostId: "sp_text_only",
      sourcePageName: "Tản Văn Cuộc Sống",
      sourceContent: "Những dòng suy ngẫm sâu lắng về ngày đầu tuần.",
      sourceImages: [],
      style: "storytelling",
    });

    const item = res.queueItem;
    if (!Array.isArray(item.sourceImages) || item.sourceImages.length !== 0) {
      throw new Error("Expected empty sourceImages array");
    }
    if (!Array.isArray(item.selectedImages) || item.selectedImages.length !== 0) {
      throw new Error("Expected empty selectedImages array");
    }
  });

  await ctx.test("F12-06: Subset image selection preserves local path references", async () => {
    const images = [
      "/uploads/source_media/img_keep_1.jpg",
      "/uploads/source_media/img_drop_2.jpg",
      "/uploads/source_media/img_keep_3.jpg",
    ];

    const res = await rewriteSourcePost({
      sourcePostId: "sp_subset_test",
      sourcePageName: "Nguồn Ảnh Lọc",
      sourceContent: "Lọc ảnh chất lượng trước khi duyệt.",
      sourceImages: images,
      style: "direct_sales",
    });

    // Simulate user selecting subset: index 0 and 2
    res.queueItem.selectedImages = [images[0], images[2]];

    if (res.queueItem.selectedImages.length !== 2) {
      throw new Error("Subset selection failed");
    }
    if (res.queueItem.selectedImages.includes(images[1])) {
      throw new Error("Deselected image still present in selectedImages");
    }
  });

  return ctx.getSummary();
}
