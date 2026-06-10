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
    if (scores.nudity > 0.3) return { safe: false, reason: "This image contains inappropriate nudity", scores };
    if (scores.weapon > 0.5) return { safe: false, reason: "Images containing weapons are not allowed", scores };
    if (scores.drugs > 0.5) return { safe: false, reason: "Drug-related images are not allowed", scores };
    if (scores.offensive > 0.5) return { safe: false, reason: "Offensive images are not allowed", scores };
    if (scores.gore > 0.3) return { safe: false, reason: "Graphic or violent images are not allowed", scores };

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
        reason: "This content contains inappropriate language",
        matches: highSeverity,
      };
    }

    // Check for personal info leaks
    if ((data.personal?.matches || []).length > 0) {
      return {
        safe: false,
        reason: "This content contains personal information",
        matches: [],
      };
    }

    return { safe: true, matches: [] };
  } catch {
    return { safe: true, matches: [] };
  }
}
