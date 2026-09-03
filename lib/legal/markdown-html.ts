/** Markdown juridique → HTML print-ready (A4 serif Affisell). */
export function legalMarkdownToHtml(markdown: string, title = "Document juridique Affisell"): string {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  const body = escaped
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^---$/gm, "<hr />")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ol>${block}</ol>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br />")

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 2.5cm; }
    body { font-family: "Times New Roman", Georgia, serif; font-size: 12pt; line-height: 1.55; color: #111; max-width: 18cm; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 16pt; letter-spacing: 0.06em; text-align: center; margin-bottom: 1.5rem; }
    h2 { font-size: 13pt; margin-top: 1.25rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }
    h3 { font-size: 12pt; margin-top: 1rem; }
    hr { border: none; border-top: 1px solid #999; margin: 1.25rem 0; }
    strong { font-weight: 700; }
    ol { padding-left: 1.25rem; }
    .doc-header { text-align: center; margin-bottom: 2rem; }
    .doc-logo { font-weight: bold; font-size: 14pt; letter-spacing: 0.12em; color: #92400e; }
  </style>
</head>
<body>
  <div class="doc-header">
    <div class="doc-logo">AFFISELL MARKET</div>
  </div>
  <p>${body}</p>
</body>
</html>`
}
