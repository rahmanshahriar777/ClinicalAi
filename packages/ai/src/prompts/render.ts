/**
 * Minimal, safe template renderer: `{{name}}` → variables[name].
 * Unknown variables render as an explicit "(not provided)" marker so the
 * model never sees a raw `{{...}}` and never invents the value.
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = variables[key];
    return v === undefined || v === null || v === '' ? '(not provided)' : v;
  });
}
