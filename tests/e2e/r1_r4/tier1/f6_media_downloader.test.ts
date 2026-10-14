/**
 * tests/e2e/r1_r4/tier1/f6_media_downloader.test.ts
 * Tier 1 — Feature F6: Media Downloader to public/uploads/source_media
 * Verifies local storage path formatting, collision resistance, multi-photo handling, and extension mapping.
 */

import { TestRunnerContext } from "../../harness/runnerHelper";
import { downloadMedia } from "../../harness/serviceLoader";
import { TestSuiteSummary } from "../../types";

export async function runTier1F6MediaDownloaderTests(): Promise<TestSuiteSummary> {
  const ctx = new TestRunnerContext("F6: Media Downloader to public/uploads/source_media", 1, "F6");

  await ctx.test("F6-01: Downloaded media paths start strictly with /uploads/source_media/", async () => {
    const urls = ["https://scontent.xx.fbcdn.net/v/t39.30808-6/image_1.jpg"];
    const downloaded = downloadMedia(urls, "fb_post_100");

    if (downloaded.length !== 1) {
      throw new Error(`Expected 1 downloaded media item, got ${downloaded.length}`);
    }
    if (!downloaded[0].startsWith("/uploads/source_media/")) {
      throw new Error(`Path should start with /uploads/source_media/, got: ${downloaded[0]}`);
    }
  });

  await ctx.test("F6-02: Single-image post returns exactly 1 local asset path", async () => {
    const urls = ["https://example.com/single_photo.png"];
    const paths = downloadMedia(urls, "fb_single_post");

    if (paths.length !== 1) {
      throw new Error(`Expected 1 path, got ${paths.length}`);
    }
    if (!paths[0].includes("fb_single_post")) {
      throw new Error(`Expected path to contain post ID, got: ${paths[0]}`);
    }
  });

  await ctx.test("F6-03: Multi-image post generates ordered attachment indices (_0, _1, _2)", async () => {
    const urls = [
      "https://example.com/album_0.jpg",
      "https://example.com/album_1.jpg",
      "https://example.com/album_2.jpg",
      "https://example.com/album_3.jpg",
    ];
    const paths = downloadMedia(urls, "fb_album_post");

    if (paths.length !== 4) {
      throw new Error(`Expected 4 paths, got ${paths.length}`);
    }
    for (let i = 0; i < 4; i++) {
      if (!paths[i].includes(`_${i}_`)) {
        throw new Error(`Expected index _${i}_ in filename, got: ${paths[i]}`);
      }
    }
  });

  await ctx.test("F6-04: Post with 0 images returns empty array without throwing error", async () => {
    const pathsEmpty = downloadMedia([], "fb_text_only_post");
    if (!Array.isArray(pathsEmpty) || pathsEmpty.length !== 0) {
      throw new Error(`Expected empty array for 0 images, got ${pathsEmpty.length}`);
    }

    const pathsNull = downloadMedia(null as any, "fb_null_post");
    if (!Array.isArray(pathsNull) || pathsNull.length !== 0) {
      throw new Error("Null images input should safely return empty array");
    }
  });

  await ctx.test("F6-05: Collision-proof naming prevents overwrite for identical URLs across different posts", async () => {
    const commonUrl = ["https://example.com/viral_infographic.jpg"];
    const pathPostA = downloadMedia(commonUrl, "post_AAA");
    const pathPostB = downloadMedia(commonUrl, "post_BBB");

    if (pathPostA[0] === pathPostB[0]) {
      throw new Error("Filenames for different posts should never collide!");
    }
  });

  await ctx.test("F6-06: Preserves original image file extensions (.jpg, .png, .webp)", async () => {
    const sampleUrls = [
      "https://example.com/photo.jpg",
      "https://example.com/graphic.png",
      "https://example.com/banner.webp",
      "https://example.com/asset.jpeg",
    ];
    const paths = downloadMedia(sampleUrls, "ext_post");

    if (!paths[0].endsWith(".jpg")) throw new Error(`Expected .jpg extension, got ${paths[0]}`);
    if (!paths[1].endsWith(".png")) throw new Error(`Expected .png extension, got ${paths[1]}`);
    if (!paths[2].endsWith(".webp")) throw new Error(`Expected .webp extension, got ${paths[2]}`);
    if (!paths[3].endsWith(".jpeg")) throw new Error(`Expected .jpeg extension, got ${paths[3]}`);
  });

  return ctx.getSummary();
}
