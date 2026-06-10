/**
 * Sightengine content moderation utility.
 * Checks images and text for NSFW, offensive, violent content.
 */

const SIGHTENGINE_API_USER = process.env.SIGHTENGINE_API_USER!;
const SIGHTENGINE_API_SECRET = process.env.SIGHTENGINE_API_SECRET!;

interface ImageCheckResult {
  safe: boolean;
  reason?: string;
  scores: {
    nudity: number;
    weapon: number;
    alcohol: number;
    drugs: number;
    offensive: number;
    gore: number;
  };
}

interface TextCheckResult {
  safe: boolean;
  reason?: string;
  matches: { type: string; intensity: string; match: string }[];
}

/** Check an image URL for inappropriate content */
export async function checkImage(imageUrl: string): Promise<ImageCheckResult> {
  try {
    const url = new URL("https://api.sightengine.com/1.0/check.json");
    url.searchParams.set("url", imageUrl);
    url.searchParams.set("models", "nudity-2.1,wad,offensive,gore");
    url.searchParams.set("api_user", SIGHTENGINE_API_USER);
    url.searchParams.set("api_secret", SIGHTENGINE_API_SECRET);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "success") {
      return { safe: false, reason: "Moderation check failed", scores: { nudity: 0, weapon: 0, alcohol: 0, drugs: 0, offensive: 0, gore: 0 } };
    }

    const scores = {
      nudity: Math.max(data.nudity?.sexual_activity ?? 0, data.nudity?.sexual_display ?? 0, data.nudity?.erotica ?? 0),
      weapon: data.weapon ?? 0,
      alcohol: data.alcohol ?? 0,
      drugs: data.drugs ?? 0,
      offensive: data.offensive?.prob ?? 0,
      gore: data.gore?.prob ?? 0,
    };

    // Thresholds — conservative but fair
    if (scores.nudity > 0.3) return { safe: false, reason: "이미지에 부적절한 노출이 포함되어 있습니다", scores };
    if (scores.weapon > 0.5) return { safe: false, reason: "무기 관련 이미지는 허용되지 않습니다", scores };
    if (scores.drugs > 0.5) return { safe: false, reason: "약물 관련 이미지는 허용되지 않습니다", scores };
    if (scores.offensive > 0.5) return { safe: false, reason: "공격적인 이미지는 허용되지 않습니다", scores };
    if (scores.gore > 0.3) return { safe: false, reason: "잔인한 이미지는 허용되지 않습니다", scores };

    return { safe: true, scores };
  } catch {
    // On error, allow through (don't block legitimate users)
    return { safe: true, scores: { nudity: 0, weapon: 0, alcohol: 0, drugs: 0, offensive: 0, gore: 0 } };
  }
}

/** Check text for profanity, hate speech, personal info */
export async function checkText(text: string): Promise<TextCheckResult> {
  try {
    const res = await fetch("https://api.sightengine.com/1.0/text/check.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        text,
        mode: "standard",
        lang: "en",
        api_user: SIGHTENGINE_API_USER,
        api_secret: SIGHTENGINE_API_SECRET,
      }),
    });
    const data = await res.json();

    if (data.status !== "success") {
      return { safe: false, reason: "Moderation check failed", matches: [] };
    }

    const matches = data.profanity?.matches || [];
    const highSeverity = matches.filter(
      (m: any) => m.intensity === "high" || m.type === "insult"
    );

    if (highSeverity.length > 0) {
      return {
        safe: false,
        reason: "부적절한 언어가 포함되어 있습니다",
        matches: highSeverity,
      };
    }

    // Check for personal info leaks
    if ((data.personal?.matches || []).length > 0) {
      return {
        safe: false,
        reason: "개인정보가 포함되어 있습니다",
        matches: [],
      };
    }

    return { safe: true, matches: [] };
  } catch {
    return { safe: true, matches: [] };
  }
}
