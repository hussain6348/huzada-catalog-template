/**
 * Safely parses a Fetch Response as JSON only when the response is OK and
 * carries a JSON Content-Type, preventing `<!doctype "... is not valid JSON`
 * errors if a proxy or static fallback returns HTML.
 */
export async function parseJsonResponse<T = any>(
  res: Response | null | undefined
): Promise<T | null> {
  if (!res || !res.ok) return null;
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    return null;
  }
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
