/**
 * ASR mishear-correction, ported from Nanu's
 * frontend-v2/src/utils/speechNormalization.ts pattern: phrase-level regex
 * replacements, then a per-token alias dictionary, then filler-word
 * stripping (kept only if removing them would empty the query). Alias
 * dictionary here is tuned to beadwork vocabulary instead of Nanu's
 * school-domain terms.
 */

const PHRASE_REPLACEMENTS: [RegExp, string][] = [
  [/\bbead\s*work\b/gi, "beadwork"],
  [/\bcolor\s*wheel\b/gi, "color wheel"],
  [/\bstarting\s*technique\b/gi, "starting technique"],
];

const TOKEN_ALIASES: Record<string, string> = {
  beat: "bead",
  beats: "beads",
  "bead's": "beads",
  beeed: "bead",
  needl: "needle",
  needel: "needle",
  threa: "thread",
  wier: "wire",
  clasp: "clasp",
  claps: "clasp",
  milestone: "milestone",
};

const FILLER_WORDS = new Set(["um", "uh", "please", "like", "so"]);

export function normalizeSpeechText(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  let text = trimmed;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  const tokens = text.split(/\s+/).map((token) => {
    const lower = token.toLowerCase();
    return TOKEN_ALIASES[lower] ?? token;
  });

  const withoutFillers = tokens.filter((token) => !FILLER_WORDS.has(token.toLowerCase()));
  const result = (withoutFillers.length > 0 ? withoutFillers : tokens).join(" ").trim();

  return result || trimmed;
}
