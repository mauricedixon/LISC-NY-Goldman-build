export function parseClaudeJson<T>(responseText: string): T {
  const cleanJson = responseText.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleanJson) as T;
}
