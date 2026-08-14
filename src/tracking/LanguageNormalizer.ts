export function normalizeLanguageId(
  languageId:
    string | undefined,
): string | undefined {
  const normalized =
    languageId
      ?.trim()
      .toLowerCase();

  return normalized ||
    undefined;
}
