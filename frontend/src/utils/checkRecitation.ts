export type RecitationMode = "lesson" | "pronunciation" | "quran";

export async function checkRecitation(audioBlob: Blob, mode: RecitationMode, expected: string) {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  formData.append("mode", mode);
  formData.append("expected", expected);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch("/api/check-recitation", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Recitation check failed (${res.status}). ${detail}`.trim());
  }
  return res.json();
}

