// Seriez Poll 다국어 자동 번역 — DeepSeek API 사용
// 질문 + 선택지를 한 언어로 받아 8개 언어(en/ko/ja/zh/fr/de/es/pt)로 번역

export const POLL_LOCALES = ["en", "ko", "ja", "zh", "fr", "de", "es", "pt"] as const;

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

interface TranslateResult {
  question: Record<string, string>;
  options: Record<string, string[]>;
}

export async function translatePoll(
  question: string,
  options: string[],
  sourceLocale: string
): Promise<TranslateResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    // 키 없으면 원문을 모든 언어에 동일하게 채움 (부분 실패 허용, 관리자가 수동 수정 가능)
    const q: Record<string, string> = {};
    const o: Record<string, string[]> = {};
    for (const l of POLL_LOCALES) { q[l] = question; o[l] = options; }
    return { question: q, options: o };
  }

  const targetLocales = POLL_LOCALES.filter((l) => l !== sourceLocale);

  const prompt = [
    "You are a professional translator. Translate the following poll question and its options into each target language.",
    "Return ONLY valid JSON with this exact structure (no markdown, no code fences):",
    '{"question": {"ko": "...", "ja": "...", "zh": "...", "fr": "...", "de": "...", "es": "...", "pt": "..."}, "options": {"ko": ["...", "..."], "ja": ["..."], "zh": ["..."], "fr": ["..."], "de": ["..."], "es": ["..."], "pt": ["..."]}}',
    "",
    `Source language: ${sourceLocale}`,
    `Target languages: ${targetLocales.join(", ")}`,
    "",
    `Question: ${question}`,
    `Options (keep order):`,
    ...options.map((o, i) => `${i}: ${o}`),
    "",
    "Keep the meaning and tone faithful. Options count must match the source exactly.",
  ].join("\n");

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek translate failed: ${res.status}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";

  // JSON 추출 (코드펜스/마크다운 제거)
  let parsed: any = null;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {}
  }
  if (!parsed) {
    try { parsed = JSON.parse(content); } catch {}
  }

  if (!parsed) {
    throw new Error("DeepSeek translate: invalid JSON response");
  }

  // 결과 조립: 원문 + 번역본
  const questionMap: Record<string, string> = { [sourceLocale]: question };
  const optionsMap: Record<string, string[]> = { [sourceLocale]: options };

  for (const l of targetLocales) {
    questionMap[l] = parsed.question?.[l] || question;
    const translatedOpts = parsed.options?.[l];
    optionsMap[l] =
      Array.isArray(translatedOpts) && translatedOpts.length === options.length
        ? translatedOpts
        : options;
  }

  // 누락 언어 채우기
  for (const l of POLL_LOCALES) {
    if (!questionMap[l]) questionMap[l] = question;
    if (!optionsMap[l]) optionsMap[l] = options;
  }

  return { question: questionMap, options: optionsMap };
}
