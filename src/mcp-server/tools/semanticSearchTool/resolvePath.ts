import path from "path";

/** Normalise les chemins Windows/relatifs vers un absolu lisible en WSL. */
export function resolveNoteAbsolutePath(
  notePath: string,
  vaultRoot: string,
): string {
  const input = notePath?.trim() ?? "";

  if (/^[A-Za-z]:[\\/]/.test(input)) {
    const drive = input[0].toLowerCase();
    const rest = input.slice(2).replace(/\\/g, "/");
    return `/mnt/${drive}${rest.startsWith("/") ? "" : "/"}${rest}`;
  }

  if (path.isAbsolute(input)) {
    return input;
  }

  return path.join(vaultRoot || "", input);
}
