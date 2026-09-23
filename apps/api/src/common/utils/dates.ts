/** Parses durations like "15m", "12h", "7d" into seconds. */
export function parseDurationSeconds(value: string): number {
  const m = /^(\d+)([smhd])$/.exec(value);
  if (!m) throw new Error(`Invalid duration: ${value}`);
  const n = Number(m[1]);
  return { s: n, m: n * 60, h: n * 3600, d: n * 86400 }[m[2] as 's' | 'm' | 'h' | 'd'];
}
