// 12-hour time helpers. The canonical stored value stays 24-hour "HH:mm"
// (so schedule math in the preview keeps working); these convert to and from
// the 12-hour parts the UI presents, and format for display.

export type Meridiem = 'AM' | 'PM';

export interface Time12 {
  hour12: number; // 1-12
  minute: string; // "00".."55"
  meridiem: Meridiem;
}

// Parse a canonical "HH:mm" 24-hour string into 12-hour parts.
// Returns null for an empty/invalid value (unset field).
export function parse24(value: string): Time12 | null {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  const meridiem: Meridiem = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12, minute: String(m).padStart(2, '0'), meridiem };
}

// Compose 12-hour parts back into a canonical "HH:mm" 24-hour string.
export function to24(hour12: number, minute: string, meridiem: Meridiem): string {
  const base = hour12 % 12; // 12 -> 0
  const h = meridiem === 'PM' ? base + 12 : base;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

// Format a canonical "HH:mm" value for display, e.g. "07:30" -> "7:30 AM".
// Empty/invalid values format to "" so callers can fall back to a placeholder.
export function formatTime12(value: string): string {
  const t = parse24(value);
  if (!t) return '';
  return `${t.hour12}:${t.minute} ${t.meridiem}`;
}
