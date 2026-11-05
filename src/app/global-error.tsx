"use client";

/** Last-resort screen if the page shell itself fails. Plain styles: nothing else can be assumed to load. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#fbf7ef", color: "#14161f", textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: 26, margin: "0 0 8px" }}>Galla hit a problem</h1>
          <p style={{ margin: "0 0 20px", color: "#6b6458" }}>Please try again. If it keeps happening, check your internet connection.</p>
          <button onClick={reset} style={{ font: "inherit", fontWeight: 600, padding: "10px 22px", borderRadius: 999, border: 0, background: "#f5a524", color: "#2a1b05", cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
