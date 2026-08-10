import { useEffect, useState } from "react";

const STORAGE_KEY = "meritoJdText";
const SANS = "-apple-system, 'Segoe UI', Roboto, sans-serif";

export function Popup() {
  const [jdText, setJdText] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEY]).then((result) => {
      setJdText((result[STORAGE_KEY] as string) ?? "");
    });
  }, []);

  function save() {
    chrome.storage.local.set({ [STORAGE_KEY]: jdText }).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function clear() {
    setJdText("");
    chrome.storage.local.remove(STORAGE_KEY);
  }

  return (
    <div style={{ padding: 16, fontFamily: SANS, width: 320, boxSizing: "border-box" }}>
      <h2 style={{ fontSize: 14, margin: "0 0 8px" }}>Score against your JD</h2>
      <p style={{ fontSize: 11.5, color: "#6C6779", margin: "0 0 8px" }}>
        Paste the job description you&apos;re hiring for. Every consented candidate you visit on LinkedIn gets
        scored fresh against it, until you change or clear it.
      </p>
      <textarea
        value={jdText}
        onChange={(e) => setJdText(e.target.value)}
        rows={10}
        style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: 8, fontFamily: SANS }}
        placeholder="Paste job description..."
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={save} style={{ flex: 1 }}>
          {saved ? "Saved" : "Save"}
        </button>
        <button onClick={clear}>Clear</button>
      </div>
    </div>
  );
}
