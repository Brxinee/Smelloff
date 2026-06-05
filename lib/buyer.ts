"use client";

/** Tracks whether this browser has ordered before — gates the trial wedge. */

const KEY = "smelloff-has-ordered";

export function isNewBuyer(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(KEY) !== "true";
}

export function markHasOrdered(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, "true");
}
