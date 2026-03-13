const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\btime table\b/g, 'timetable'],
  [/\btable time\b/g, 'timetable'],
  [/\bchat boat\b/g, 'chatbot'],
  [/\bchat bot\b/g, 'chatbot'],
  [/\ba sign ment\b/g, 'assignment'],
  [/\bassigment\b/g, 'assignment'],
  [/\bassainment\b/g, 'assignment'],
  [/\bsee a t\b/g, 'cat'],
  [/\bcee a tee\b/g, 'cat'],
  [/\bclass group\b/g, 'class community'],
];

const TOKEN_ALIASES: Record<string, string> = {
  assigment: 'assignment',
  assainment: 'assignment',
  timtable: 'timetable',
  schdule: 'schedule',
  feez: 'fees',
  comunity: 'community',
  comunication: 'communication',
  lecturor: 'lecturer',
  studant: 'student',
};

const FILLER_WORDS = new Set([
  'um',
  'uh',
  'hmm',
  'like',
  'you',
  'know',
  'please',
]);

export const normalizeSpeechText = (input: string): string => {
  if (!input || !input.trim()) {
    return '';
  }

  let text = input.toLowerCase().trim();

  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(/[^a-z0-9\s]/g, ' ');
  const tokens = text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const corrected = tokens
    .map((token) => TOKEN_ALIASES[token] ?? token)
    .filter((token, index, all) => {
      if (!FILLER_WORDS.has(token)) {
        return true;
      }
      // Keep fillers if removing all tokens would empty the query.
      return all.length <= 2 || index === all.length - 1;
    });

  const normalized = corrected.join(' ').replace(/\s+/g, ' ').trim();
  return normalized || input.trim();
};
