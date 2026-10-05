const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const mdPath = path.join(rootDir, 'DOCUMENTATION.md');
const htmlOutputPath = path.join(rootDir, 'docs.html');
const clientPublicHtmlPath = path.join(rootDir, 'client/public/docs.html');
const pdfOutputPath = path.join(rootDir, 'Flight_Telemetry_System_Documentation.pdf');

console.log('📖 Reading DOCUMENTATION.md...');
const mdContent = fs.readFileSync(mdPath, 'utf8');

// Parse Markdown into HTML body using marked
let rawBodyHtml = '';
try {
  rawBodyHtml = execSync('npx -y marked', { input: mdContent, encoding: 'utf8' });
} catch (err) {
  console.error('Error parsing markdown with marked:', err.message);
  process.exit(1);
}

// Convert mermaid code blocks (<pre><code class="language-mermaid">...</code></pre>) to <div class="mermaid">...</div>
let processedBodyHtml = rawBodyHtml.replace(
  /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
  (match, code) => {
    // Unescape HTML entities in mermaid code
    const unescapedCode = code
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    return `<div class="mermaid">${unescapedCode}</div>`;
  }
);

// HTML Template with dark glassmorphism, responsive sidebar, toolbar, search, and print PDF styles
const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Real-Time Flight Telemetry & Tracking System - Documentation</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  
  <!-- Highlight.js for Syntax Highlighting -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/atom-one-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
  
  <!-- Mermaid.js for Diagrams -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  
  <!-- KaTeX for Math Equations -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body);"></script>

  <style>
    :root {
      --bg-primary: #0b0f19;
      --bg-secondary: #111827;
      --bg-card: rgba(17, 24, 39, 0.7);
      --bg-sidebar: #0f172a;
      --border-color: rgba(255, 255, 255, 0.1);
      --border-glow: rgba(59, 130, 246, 0.4);
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent-blue: #3b82f6;
      --accent-cyan: #06b6d4;
      --accent-purple: #8b5cf6;
      --accent-emerald: #10b981;
      --accent-amber: #f59e0b;
      --accent-crimson: #ef4444;
      --font-main: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-code: 'JetBrains Mono', monospace;
    }

    [data-theme="light"] {
      --bg-primary: #f8fafc;
      --bg-secondary: #ffffff;
      --bg-card: #ffffff;
      --bg-sidebar: #f1f5f9;
      --border-color: #e2e8f0;
      --border-glow: rgba(59, 130, 246, 0.3);
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --text-muted: #64748b;
      --accent-blue: #2563eb;
      --accent-cyan: #0891b2;
      --accent-purple: #7c3aed;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: var(--font-main);
      background-color: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      display: flex;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Top Floating Progress Bar */
    #reading-progress {
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--accent-blue), var(--accent-cyan), var(--accent-purple));
      z-index: 1000;
      width: 0%;
      transition: width 0.1s;
    }

    /* Top Navigation Header */
    header.top-navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 64px;
      background: rgba(11, 15, 25, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      z-index: 500;
    }

    .nav-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
      font-size: 1.1rem;
      color: #ffffff;
      text-decoration: none;
    }

    .nav-brand-badge {
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .search-input {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 8px 14px;
      color: var(--text-primary);
      font-size: 0.875rem;
      outline: none;
      width: 240px;
      transition: all 0.2s;
    }

    .search-input:focus {
      border-color: var(--accent-blue);
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
      background: rgba(255, 255, 255, 0.08);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--border-color);
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-primary);
      transition: all 0.2s ease;
      text-decoration: none;
    }

    .btn:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: var(--text-secondary);
      transform: translateY(-1px);
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--accent-blue), #2563eb);
      color: #ffffff;
      border: none;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
    }

    .btn-primary:hover {
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.6);
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
    }

    /* Layout */
    .app-container {
      display: flex;
      width: 100%;
      margin-top: 64px;
    }

    /* Sidebar Navigation */
    aside.sidebar {
      width: 300px;
      position: fixed;
      top: 64px;
      bottom: 0;
      left: 0;
      background: var(--bg-sidebar);
      border-right: 1px solid var(--border-color);
      padding: 24px 16px;
      overflow-y: auto;
      z-index: 400;
    }

    .sidebar-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      margin-bottom: 12px;
      padding-left: 12px;
    }

    .toc-list { list-style: none; }
    .toc-item { margin-bottom: 4px; }
    .toc-link {
      display: block;
      padding: 8px 12px;
      border-radius: 6px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    .toc-link:hover, .toc-link.active {
      color: #ffffff;
      background: rgba(59, 130, 246, 0.15);
      border-left: 3px solid var(--accent-blue);
      padding-left: 9px;
    }

    .toc-sublink {
      padding-left: 24px;
      font-size: 0.825rem;
      color: var(--text-muted);
    }

    /* Main Content Area */
    main.content-area {
      margin-left: 300px;
      flex: 1;
      padding: 40px 60px 100px 60px;
      max-width: 1100px;
    }

    .doc-hero {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
      border: 1px solid var(--border-glow);
      border-radius: 16px;
      padding: 36px 40px;
      margin-bottom: 40px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      position: relative;
      overflow: hidden;
    }

    .doc-hero::after {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%);
      pointer-events: none;
    }

    .doc-hero h1 {
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(90deg, #ffffff, #93c5fd, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 12px;
      line-height: 1.2;
    }

    .doc-hero p {
      font-size: 1.1rem;
      color: var(--text-secondary);
      max-width: 800px;
    }

    /* Markdown Elements Styling */
    h1, h2, h3, h4, h5, h6 {
      color: #ffffff;
      font-weight: 700;
      margin-top: 40px;
      margin-bottom: 16px;
      scroll-margin-top: 80px;
    }

    h1 { font-size: 2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; }
    h2 { font-size: 1.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 8px; }
    h3 { font-size: 1.25rem; color: var(--accent-cyan); }

    p { margin-bottom: 16px; color: var(--text-secondary); font-size: 1rem; }
    a { color: var(--accent-blue); text-decoration: none; }
    a:hover { text-decoration: underline; }

    ul, ol { margin-bottom: 20px; padding-left: 24px; color: var(--text-secondary); }
    li { margin-bottom: 6px; }

    hr { border: none; border-top: 1px solid var(--border-color); margin: 40px 0; }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      background: var(--bg-card);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border-color);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }

    th, td {
      padding: 14px 18px;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.925rem;
    }

    th {
      background: rgba(30, 41, 59, 0.9);
      color: #ffffff;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.8rem;
      letter-spacing: 0.5px;
    }

    tr:hover { background: rgba(255, 255, 255, 0.03); }

    /* Code Blocks */
    pre {
      background: #090d16 !important;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 20px;
      overflow-x: auto;
      margin: 20px 0;
      font-family: var(--font-code);
      font-size: 0.875rem;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      position: relative;
    }

    code {
      font-family: var(--font-code);
      background: rgba(255, 255, 255, 0.08);
      color: #38bdf8;
      padding: 3px 6px;
      border-radius: 4px;
      font-size: 0.875em;
    }

    pre code {
      background: transparent !important;
      padding: 0;
      color: inherit;
    }

    /* Mermaid Container */
    .mermaid {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border-glow);
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      display: flex;
      justify-content: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }

    /* Back to Top Floating Button */
    .back-to-top {
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--accent-blue);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      z-index: 900;
    }

    .back-to-top.visible {
      opacity: 1;
      visibility: visible;
    }

    .back-to-top:hover {
      transform: translateY(-4px);
    }

    /* PRINT / PDF GENERATION STYLES */
    @media print {
      header.top-navbar, aside.sidebar, #reading-progress, .back-to-top, .nav-actions {
        display: none !important;
      }

      body {
        background-color: #ffffff !important;
        color: #000000 !important;
      }

      main.content-area {
        margin-left: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
      }

      .doc-hero {
        background: #f1f5f9 !important;
        border: 1px solid #cbd5e1 !important;
        box-shadow: none !important;
        color: #000000 !important;
        page-break-after: always;
      }

      .doc-hero h1 {
        background: none !important;
        -webkit-text-fill-color: #000000 !important;
        color: #000000 !important;
      }

      h1, h2 {
        page-break-before: always;
        color: #0f172a !important;
        border-bottom: 2px solid #0f172a !important;
      }

      h3, h4 { color: #1e293b !important; }
      p, li, td { color: #334155 !important; }

      table, pre, .mermaid {
        page-break-inside: avoid;
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        color: #000000 !important;
      }

      th {
        background: #e2e8f0 !important;
        color: #000000 !important;
      }
    }
  </style>
</head>
<body>

  <!-- Reading Progress Bar -->
  <div id="reading-progress"></div>

  <!-- Top Floating Header -->
  <header class="top-navbar">
    <a href="#" class="nav-brand">
      <span>✈️ AWS Flight Telemetry & Analytics</span>
      <span class="nav-brand-badge">Documentation</span>
    </a>

    <div class="nav-actions">
      <input type="text" id="searchInput" class="search-input" placeholder="🔍 Search documentation..." onkeyup="filterDocs()">
      <button class="btn" onclick="toggleTheme()">🌓 Theme</button>
      <button class="btn btn-primary" onclick="window.print()">📥 Export PDF</button>
    </div>
  </header>

  <!-- Container -->
  <div class="app-container">
    
    <!-- Sidebar Navigation -->
    <aside class="sidebar">
      <div class="sidebar-title">Table of Contents</div>
      <ul class="toc-list" id="tocList">
        <!-- Dynamically generated TOC -->
      </ul>
    </aside>

    <!-- Main Content -->
    <main class="content-area" id="docContent">
      <div class="doc-hero">
        <h1>Real-Time Flight Telemetry & Tracking System</h1>
        <p>Comprehensive Architectural Specification, AWS Data Pipeline Integration, REST/WebSocket API Reference & Mathematics Engine Documentation</p>
      </div>

      <div class="markdown-body">
        ${processedBodyHtml}
      </div>
    </main>

  </div>

  <!-- Back to Top Floating Button -->
  <div class="back-to-top" id="backToTop" onclick="scrollToTop()">▲</div>

  <script>
    // Initialize Mermaid.js
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
      flowchart: { curve: 'basis' }
    });

    // Initialize Highlight.js
    hljs.highlightAll();

    // Generate Dynamic Table of Contents (TOC)
    document.addEventListener('DOMContentLoaded', () => {
      const headings = document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3');
      const tocList = document.getElementById('tocList');
      
      headings.forEach((heading, index) => {
        const id = 'heading-' + index;
        heading.id = id;
        
        const li = document.createElement('li');
        li.className = 'toc-item';
        
        const link = document.createElement('a');
        link.href = '#' + id;
        link.className = 'toc-link' + (heading.tagName === 'H3' ? ' toc-sublink' : '');
        link.textContent = heading.textContent.replace(/^#+\s*/, '');
        
        li.appendChild(link);
        tocList.appendChild(li);
      });

      // Highlight TOC active item on scroll
      window.addEventListener('scroll', () => {
        let current = '';
        headings.forEach(heading => {
          const headingTop = heading.offsetTop - 100;
          if (window.scrollY >= headingTop) {
            current = heading.id;
          }
        });

        document.querySelectorAll('.toc-link').forEach(a => {
          a.classList.remove('active');
          if (a.getAttribute('href') === '#' + current) {
            a.classList.add('active');
          }
        });

        // Reading Progress Bar
        const totalHeight = document.body.scrollHeight - window.innerHeight;
        const progressPct = (window.scrollY / totalHeight) * 100;
        document.getElementById('reading-progress').style.width = progressPct + '%';

        // Back to top button visibility
        const backToTop = document.getElementById('backToTop');
        if (window.scrollY > 400) {
          backToTop.classList.add('visible');
        } else {
          backToTop.classList.remove('visible');
        }
      });
    });

    // Theme Switcher (Dark / Light)
    function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      if (currentTheme === 'light') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }

    // Scroll to Top Helper
    function scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Live Search Filter
    function filterDocs() {
      const query = document.getElementById('searchInput').value.toLowerCase();
      const content = document.getElementById('docContent');
      const paragraphs = content.querySelectorAll('p, li, h1, h2, h3, tr');

      paragraphs.forEach(el => {
        if (!query) {
          el.style.display = '';
        } else if (el.textContent.toLowerCase().includes(query)) {
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>
`;

console.log('✍️ Writing docs.html...');
fs.writeFileSync(htmlOutputPath, fullHtml, 'utf8');

// Also write to client/public/docs.html if directory exists
const clientPublicDir = path.dirname(clientPublicHtmlPath);
if (fs.existsSync(clientPublicDir)) {
  fs.writeFileSync(clientPublicHtmlPath, fullHtml, 'utf8');
  console.log('✅ Copied docs.html to client/public/docs.html');
}

// Compile PDF using Chrome Headless
console.log('🖨️ Compiling PDF using Headless Chrome...');
try {
  const chromeCmd = `google-chrome --headless --disable-gpu --no-sandbox --print-to-pdf-no-header --run-all-compositor-stages-before-draw --print-to-pdf="${pdfOutputPath}" "file://${htmlOutputPath}"`;
  execSync(chromeCmd, { timeout: 30000 });
  const stats = fs.statSync(pdfOutputPath);
  console.log(`🎉 PDF generated successfully at ${pdfOutputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
} catch (err) {
  console.error('Error rendering PDF with Chrome:', err.message);
}
