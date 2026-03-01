export function renderTemplate(
  template: string,
  params: Record<string, string>,
): string {
  return template.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (match, key) => (key in params ? params[key] : match),
  );
}
