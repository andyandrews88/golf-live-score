export const SCORER_SESSION_KEY = "rcgc-scorer-unlocked";

export function getScorerPasscode(): string | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(SCORER_SESSION_KEY);
  return value && value !== "1" ? value : null;
}

export function setScorerPasscode(passcode: string) {
  sessionStorage.setItem(SCORER_SESSION_KEY, passcode);
}

export function clearScorerPasscode() {
  sessionStorage.removeItem(SCORER_SESSION_KEY);
}
