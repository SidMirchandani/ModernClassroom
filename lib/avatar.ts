/** Consistent initials from first + last name (e.g. "Vikram" + "Mehta" → "VM"). */
export function getUserInitials(firstName: string, lastName?: string): string {
  const first = firstName.trim().charAt(0);
  const last = (lastName ?? "").trim().charAt(0);
  const initials = (first + last).toUpperCase();
  return initials || "?";
}

/** Initials from a display name like "Vikram Mehta". */
export function getInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return parts[0]?.charAt(0).toUpperCase() ?? "?";
}
