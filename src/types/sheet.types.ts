export interface TopicRow {
  id: string;
  rowIndex: number;
  title: string; // Tiêu đề (Ví dụ: Tên xã / Chủ đề)
  entity?: string; // Thực thể (Entity) SEO / Thương hiệu / Địa danh / Đối tượng cốt lõi
  info1: string; // Thông tin 1
  info2: string; // Thông tin 2
  info3: string; // Thông tin 3
  info4: string; // Thông tin 4
  prompt1: string; // Prompt 1
  prompt2: string; // Prompt 2
  prompt3: string; // Prompt 3
  prompt4: string; // Prompt 4
  imageUrl?: string; // Link ảnh gợi ý nếu có trong sheet
}

export interface SheetSyncConfig {
  sheetUrl: string;
  sheetName?: string;
  lastSyncedAt?: string;
  useSampleData: boolean;
}
