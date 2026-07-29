"use client";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({
  answersJson,
  decisionsJson,
  markdown,
  html,
}: {
  answersJson: string;
  decisionsJson: string;
  markdown: string;
  html: string;
}) {
  return (
    <div className="surface flex flex-wrap gap-3 p-5">
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => download("turner-answers.json", answersJson, "application/json")}
      >
        Export answers (JSON)
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => download("turner-decisions.json", decisionsJson, "application/json")}
      >
        Export decisions (JSON)
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => download("turner-playbook.md", markdown, "text/markdown")}
      >
        Export playbook (Markdown)
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => download("turner-playbook.html", html, "text/html")}
      >
        Export playbook (HTML)
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          const w = window.open("", "_blank");
          if (w) {
            w.document.write(html);
            w.document.close();
            w.focus();
            w.print();
          }
        }}
      >
        Printable HTML preview
      </button>
    </div>
  );
}
