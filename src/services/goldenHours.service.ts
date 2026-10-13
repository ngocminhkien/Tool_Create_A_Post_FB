import { GoldenHourSlot } from "@/types/socialSeo.types";

export interface GoldenHourDefinition {
  id: GoldenHourSlot["id"];
  label: string;
  timeRange: string;
  targetHour: number;
  targetMinute: number;
  endHour: number;
  endMinute: number;
  isRecommendedPrime: boolean;
  description: string;
}

export const GOLDEN_HOUR_DEFINITIONS: GoldenHourDefinition[] = [
  {
    id: "morning",
    label: "Sáng: Khởi đầu ngày mới",
    timeRange: "07:30 - 08:30",
    targetHour: 8,
    targetMinute: 0,
    endHour: 8,
    endMinute: 30,
    isRecommendedPrime: false,
    description: "Khung giờ người dùng thức dậy, điểm tâm và check tin tức đầu ngày.",
  },
  {
    id: "noon",
    label: "Trưa: Nghỉ trưa & thư giãn",
    timeRange: "11:30 - 13:00",
    targetHour: 12,
    targetMinute: 0,
    endHour: 13,
    endMinute: 0,
    isRecommendedPrime: false,
    description: "Giờ nghỉ trưa của dân văn phòng, học sinh & sinh viên, lướt điện thoại thư giãn.",
  },
  {
    id: "evening",
    label: "Tối: Giờ vàng tương tác (Prime Time)",
    timeRange: "19:30 - 21:30",
    targetHour: 20,
    targetMinute: 0,
    endHour: 21,
    endMinute: 30,
    isRecommendedPrime: true,
    description: "Khung giờ vàng đỉnh cao của Facebook Việt Nam, tỷ lệ tương tác và dwell time cao nhất.",
  },
  {
    id: "night",
    label: "Đêm: Thư giãn & cú đêm",
    timeRange: "22:00 - 23:00",
    targetHour: 22,
    targetMinute: 30,
    endHour: 23,
    endMinute: 0,
    isRecommendedPrime: false,
    description: "Khung giờ trước khi đi ngủ, phù hợp tâm sự, tản văn và chia sẻ chiều sâu.",
  },
];

/**
 * Calculates the 4 Vietnam peak engagement slots relative to a reference date.
 * If a slot's end cutoff time has already passed today, it automatically advances to tomorrow.
 */
export function getGoldenHourPresets(referenceDate?: Date): GoldenHourSlot[] {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const safeRef = isNaN(ref.getTime()) ? new Date() : ref;

  return GOLDEN_HOUR_DEFINITIONS.map((def) => {
    const targetDate = new Date(safeRef);
    targetDate.setHours(def.targetHour, def.targetMinute, 0, 0);

    const slotEndTime = new Date(safeRef);
    slotEndTime.setHours(def.endHour, def.endMinute, 0, 0);

    let isToday = true;
    if (safeRef.getTime() > slotEndTime.getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
      isToday = false;
    }

    const timeStr = `${String(def.targetHour).padStart(2, "0")}:${String(def.targetMinute).padStart(2, "0")}`;
    const formattedTarget = isToday ? `Hôm nay, ${timeStr}` : `Ngày mai, ${timeStr}`;

    return {
      id: def.id,
      label: def.label,
      timeRange: def.timeRange,
      isToday,
      formattedTarget,
      timestamp: targetDate.toISOString(),
      isRecommendedPrime: def.isRecommendedPrime,
    };
  });
}

/**
 * Retrieves a specific upcoming golden hour preset by its slot ID.
 */
export function getUpcomingPreset(
  id: GoldenHourSlot["id"],
  referenceDate?: Date
): GoldenHourSlot {
  const presets = getGoldenHourPresets(referenceDate);
  const found = presets.find((p) => p.id === id);
  if (found) return found;
  return presets.find((p) => p.id === "evening") || presets[0];
}

/**
 * Returns the upcoming golden hour slot closest in time to the reference date.
 */
export function getNextUpcomingSlot(referenceDate?: Date): GoldenHourSlot {
  const presets = getGoldenHourPresets(referenceDate);
  return [...presets].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )[0];
}

/**
 * Validates whether a target timestamp is acceptable for Facebook Graph API scheduling
 * (must be between 10 minutes and 75 days in the future).
 */
export function validateFacebookScheduleTime(targetDate: Date | number | string): {
  valid: boolean;
  error?: string;
  unixSeconds?: number;
} {
  const dateObj = typeof targetDate === "number" ? new Date(targetDate * 1000) : new Date(targetDate);
  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: "Thời gian hẹn giờ không hợp lệ." };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const targetSeconds = Math.floor(dateObj.getTime() / 1000);
  const diffSeconds = targetSeconds - nowSeconds;

  if (diffSeconds < 600) {
    return {
      valid: false,
      error: "Thời gian hẹn giờ phải cách thời điểm hiện tại ít nhất 10 phút (theo quy định Meta Graph API).",
    };
  }

  if (diffSeconds > 75 * 86400) {
    return {
      valid: false,
      error: "Thời gian hẹn giờ không được vượt quá 75 ngày trong tương lai.",
    };
  }

  return { valid: true, unixSeconds: targetSeconds };
}
