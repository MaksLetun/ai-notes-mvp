export async function analyzeWithOpenRouter({ note, apiBaseUrl }) {
  if (!apiBaseUrl) {
    throw new Error("OpenRouter proxy API URL is required.");
  }

  const response = await fetch(`${apiBaseUrl}/ai/analyze-note`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ note }),
  });

  if (!response.ok) {
    throw new Error(`AI analysis failed with status ${response.status}.`);
  }

  return response.json();
}
