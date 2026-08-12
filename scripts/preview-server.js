import express from "express";
import { marked } from "marked";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const readmePath = join(repoRoot, "README.md");

// Resolve the bundled GitHub markdown stylesheet so the preview matches how
// GitHub renders the profile README.
const cssPath = join(
  repoRoot,
  "node_modules",
  "github-markdown-css",
  "github-markdown.css",
);

const app = express();

app.get("/mtime", async (_req, res) => {
  try {
    const { mtimeMs } = await stat(readmePath);
    res.json({ mtimeMs });
  } catch {
    res.json({ mtimeMs: 0 });
  }
});

app.get("/github-markdown.css", async (_req, res) => {
  try {
    const css = await readFile(cssPath, "utf8");
    res.type("text/css").send(css);
  } catch {
    res.type("text/css").send("");
  }
});

app.get("/", async (_req, res) => {
  let markdown;
  try {
    markdown = await readFile(readmePath, "utf8");
  } catch {
    res.status(404).send("README.md not found");
    return;
  }

  const body = marked.parse(markdown, { gfm: true, breaks: false });
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>README preview</title>
  <link rel="stylesheet" href="/github-markdown.css" />
  <style>
    body { margin: 0; background: #f6f8fa; }
    .markdown-body {
      box-sizing: border-box;
      max-width: 980px;
      margin: 32px auto;
      padding: 32px;
      background: #ffffff;
      border: 1px solid #d0d7de;
      border-radius: 6px;
    }
    @media (max-width: 767px) {
      .markdown-body { margin: 0; padding: 16px; border-radius: 0; }
    }
  </style>
</head>
<body>
  <article class="markdown-body">${body}</article>
  <script>
    // Lightweight live reload: poll README mtime and refresh on change.
    let last = null;
    setInterval(async () => {
      try {
        const res = await fetch("/mtime");
        const { mtimeMs } = await res.json();
        if (last === null) { last = mtimeMs; return; }
        if (mtimeMs !== last) { location.reload(); }
      } catch {}
    }, 1000);
  </script>
</body>
</html>`;

  res.type("html").send(html);
});

app.listen(port, host, () => {
  console.log(`README preview server running at http://${host}:${port}`);
  console.log(`Rendering: ${readmePath}`);
});
