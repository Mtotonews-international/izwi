// Flags text for the moderator before they open it. A flag never blocks or approves anything by itself.
// Add words to UNKIND in English, Swahili and Sheng as the moderation team learns what appears.
const UNKIND = ['stupid', 'idiot', 'ugly', 'hate you', 'kill', 'mjinga', 'fala', 'pumbavu', 'shenzi'];

function flagOf(text) {
  const t = String(text || '');
  if (/\d[\d\s-]{6,}\d/.test(t)) return 'Possible phone number';
  if (/@|whatsapp|instagram|tiktok|snapchat|telegram|facebook/i.test(t)) return 'Possible contact detail';
  const low = t.toLowerCase();
  if (UNKIND.some(w => new RegExp(`\\b${w}\\b`).test(low))) return 'Possible unkind language';
  return '';
}
module.exports = { flagOf };
