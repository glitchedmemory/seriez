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

/**
 * Words Sightengine flags as "discriminatory" which are legitimate in film and
 * anime writing. Verified against the live API: a Black Clover S2 review was
 * rejected 3x for "spade" ("Spade Kingdom").
 *
 * IMPORTANT: this is a CONTEXT check, not a blanket allow-list. Allowing "spade"
 * on its own let "Those spade people are all criminals." through in testing, so
 * the term is only excused when the surrounding text puts it in an in-universe
 * context (kingdom / arc / season / a character name).
 */
const TITLE_CONTEXT: RegExp[] = [
  /\bspade\s+(kingdom|arc|편|왕국|saga)\b/i,
  /\b(clover|heart|clover\s+kingdom)\b/i,
  /\b(asta|yuno|noelle|zenon|yami|vangeance|mimosa|gaja|rill|charlotte|langris|megicula|beelzebub|allen|lolopechka|lucius|zogratis)\b/i,
  /\b(season|episode|ep\.?|cour|anime|manga|series|review|arc)\b/i,
];

/** True when the text around a flagged term is clearly about a title, not a person. */
function hasTitleContext(text: string): boolean {
  return TITLE_CONTEXT.some((re) => re.test(text));
}

/**
 * Strip things Sightengine misreads as personal data before sending.
 * Verified failure: "2026년 10월 3일 171" matched phone_number_us, so a review
 * quoting an air date was rejected as "contains personal information".
 *
 * NOTE: only date/episode shapes are rewritten. An earlier version also
 * collapsed every 3-4 digit run, which destroyed real phone numbers
 * ("213-555-0142") and made them pass — that rule is deliberately gone.
 */
function scrubDatePatterns(text: string): string {
  return text
    // 2026년 10월 3일
    .replace(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g, "DATE")
    // 2026.10.03 / 2026-10-03 / 2026/10/03
    .replace(/\d{4}[-./]\d{1,2}[-./]\d{1,2}(?![\d-])/g, "DATE")
    // "171화", "8화" — episode counters that chain onto dates as extra digits
    .replace(/(\d+)\s*화/g, "EP");
}

/** Check text for profanity, hate speech, personal info */
export async function checkText(text: string): Promise<TextCheckResult> {
  try {
    const res = await fetch("https://api.sightengine.com/1.0/text/check.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        text: scrubDatePatterns(text),
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

    // Excuse a flagged term only when the ORIGINAL text reads as being about a
    // title. Genuine abuse has no such context and is still blocked.
    if (highSeverity.length > 0) {
      const allInTitleContext = hasTitleContext(text);
      const genuinelyAbusive = highSeverity.filter((m: any) => {
        const term = String(m.match ?? "").toLowerCase().trim();
        // "spade"/"spades" is the only term we are willing to excuse, and only
        // in title context. Everything else (insults, slurs) is always blocked.
        if ((term === "spade" || term === "spades") && allInTitleContext) return false;
        return true;
      });
      if (genuinelyAbusive.length > 0) {
        return {
          safe: false,
          reason: "This content contains inappropriate language",
          matches: genuinelyAbusive,
        };
      }
    }

    // Check for personal info leaks. A phone-number match is ignored only when
    // the matched text is short enough to be a date remnant, never a full number.
    const personal = (data.personal?.matches || []).filter((m: any) => {
      const raw = String(m.match ?? "");
      const digits = raw.replace(/\D/g, "");
      if (m.type === "phone_number_us" && digits.length < 10) return false;
      return true;
    });
    if (personal.length > 0) {
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
