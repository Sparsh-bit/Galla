"use client";

/** Last-resort screen if the page shell itself fails. Plain styles: nothing else can be assumed to load. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#032048", textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: 26, margin: "0 0 8px", color: "#032048" }}>Galla hit a problem</h1>
          <p style={{ margin: "0 0 20px", color: "#54657e" }}>Please try again. If it keeps happening, check your internet connection.</p>
          <button onClick={reset} style={{ font: "inherit", fontWeight: 600, padding: "10px 24px", borderRadius: 999, border: 0, background: "#047348", color: "#ffffff", cursor: "pointer", boxShadow: "0 2px 8px rgba(4,115,72,0.3)" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
