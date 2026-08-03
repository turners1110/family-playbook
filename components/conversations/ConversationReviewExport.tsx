"use client";

import { useState } from "react";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ConversationReviewExport({
  title,
  markdown,
  json,
  html,
}: {
  title: string;
  markdown: string;
  json: string;
  html: string;
}) {
  const [copied, setCopied] = useState(false);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() =>
          download(`${slug || "conversation"}.md`, markdown, "text/markdown")
        }
      >
        Export Markdown
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() =>
          download(`${slug || "conversation"}.json`, json, "application/json")
        }
      >
        Export JSON
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          const w = window.open("", "_blank");
          if (!w) return;
          w.document.write(html);
          w.document.close();
          w.focus();
          w.print();
        }}
      >
        Export PDF (print)
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Link copied" : "Copy page link"}
      </button>
    </div>
  );
}
