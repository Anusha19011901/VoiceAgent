import * as chrono from "chrono-node";

const DEFAULT_TIMEZONE = "America/New_York";

export function parseNaturalDateToISO(
  input: string
): { startISO?: string; endISO?: string } {
  // chrono.parseDate returns Date | null
  const parsed = chrono.parseDate(input, new Date(), { forwardDate: true });
  if (!parsed) return {};

  const start = new Date(parsed);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}

export function timezoneFromInput(input?: string): string {
  if (!input) return DEFAULT_TIMEZONE;
  const lowered = input.toLowerCase();

  if (lowered.includes("pst") || lowered.includes("pacific"))
    return "America/Los_Angeles";
  if (lowered.includes("est") || lowered.includes("eastern"))
    return "America/New_York";
  if (lowered.includes("cst") || lowered.includes("central"))
    return "America/Chicago";
  if (lowered.includes("mst") || lowered.includes("mountain"))
    return "America/Denver";

  return DEFAULT_TIMEZONE;
}

export const DEFAULT_TZ = DEFAULT_TIMEZONE;
