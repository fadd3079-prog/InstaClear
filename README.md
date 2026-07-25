<div align="center">
  <h1>InstaClear</h1>
  <p>A privacy-first, zero-server Instagram unfollower tracking utility executing locally via Meta JSON exports.</p>
  
  <p>
    <img src="https://img.shields.io/badge/License-MIT-4f46e5.svg?style=flat-square" alt="MIT License" />
    <img src="https://img.shields.io/badge/Vanilla-JS-e2e8f0.svg?style=flat-square&logo=javascript&logoColor=0f172a&labelColor=e2e8f0&color=94a3b8" alt="Vanilla JS" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38bdf8?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/PRs-welcome-4f46e5.svg?style=flat-square" alt="PRs Welcome" />
  </p>

  <img src="/public/assets/tutorial-export-json/10.webp" alt="InstaClear UI Preview" width="400" style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
</div>

<br />

## The Problem vs. The Solution

> **The Problem:** Traditional third-party unfollower applications are inherent security liabilities. They rely on direct API access, headless browser scraping, or raw credential inputs. This architectural anti-pattern routinely results in account compromise (phishing), aggressive rate-limiting, and permanent shadowbans implemented by Meta's automated security heuristics.

> **The Solution:** InstaClear entirely bypasses the Instagram API and runtime DOM scraping. By computing the dataset against static, official JSON exports provided voluntarily via Meta's Accounts Center, the audit process is fully isolated. Authentication is never required.

## Architectural Pillars

<ul>
  <li><b>Privacy-First Execution:</b> <i>Zero telemetry.</i> Computation runs 100% client-side in the browser via JavaScript Set mechanics. No data is serialized, transmitted, or persisted on external servers.</li>
  <li><b>Strict JSON Parsing:</b> <i>Deterministic data structures.</i> Bypasses brittle HTML DOM scraping by relying exclusively on Meta's official GDPR-compliant `.json` data exports.</li>
  <li><b>Local State Resilience:</b> <i>Persistent audits.</i> Utilizes the browser's <code>localStorage</code> API for stateless resumption, combined with physical JSON backup capabilities.</li>
  <li><b>Modern Interface:</b> <i>Cognitive clarity.</i> Implements a stark, distraction-free UI leveraging a modern Slate and Indigo palette to reduce cognitive load during bulk manual operations.</li>
</ul>

## Technical Stack

| Technology | Role in Architecture | Rationale |
| :--- | :--- | :--- |
| **Vanilla JavaScript** | Core parsing and state machine logic | Maximizes execution performance, removes bundler dependency overhead, and ensures complete code auditability for security researchers. |
| **Tailwind CSS** | Styling and layout orchestration | Rapid UI prototyping through utility classes injected via CDN, eliminating the need for a complex Node.js build step in production. |
| **HTML5 DOM** | Presentation layer and local storage | Employs native browser APIs (FileReader, DOMParser, LocalStorage) to handle complex datasets natively without heavy frameworks. |

## Execution Guide

1. Navigate to the Instagram Settings menu and select <kbd>Accounts Center</kbd>.
   <br /><img src="/public/assets/tutorial-export-json/1.webp" width="250" style="border-radius: 6px; margin: 10px 0;" alt="Step 1" />
2. Under Account settings, select <kbd>Your information and permissions</kbd>.
   <br /><img src="/public/assets/tutorial-export-json/2.webp" width="250" style="border-radius: 6px; margin: 10px 0;" alt="Step 2" />
3. Select <kbd>Export your information</kbd>.
   <br /><img src="/public/assets/tutorial-export-json/3.webp" width="250" style="border-radius: 6px; margin: 10px 0;" alt="Step 3" />
4. Click the <kbd>Create export</kbd> button.
   <br /><img src="/public/assets/tutorial-export-json/4.webp" width="250" style="border-radius: 6px; margin: 10px 0;" alt="Step 4" />
5. Select your specific Instagram account profile.
   <br /><img src="/public/assets/tutorial-export-json/5.webp" width="250" style="border-radius: 6px; margin: 10px 0;" alt="Step 5" />
6. Choose where to export by selecting <kbd>Export to device</kbd>.
   <br /><img src="/public/assets/tutorial-export-json/6.webp" width="250" style="border-radius: 6px; margin: 10px 0;" alt="Step 6" />
7. Customize information: Uncheck everything, select ONLY <kbd>Followers and following</kbd> under Connections, then Save.
   <br /><img src="/public/assets/tutorial-export-json/7.webp" width="250" style="border-radius: 6px; margin: 10px 0;" alt="Step 7" />
8. **CRITICAL** Date range: Select <kbd>All time</kbd>, then Save.
   <br /><img src="/public/assets/tutorial-export-json/8.webp" width="250" style="border-radius: 6px; margin: 10px 0;" alt="Step 8" />
9. **CRITICAL** Format: Select <kbd>JSON</kbd>, then Save.
   <br /><img src="/public/assets/tutorial-export-json/9.webp" width="250" style="border-radius: 6px; margin: 10px 0;" alt="Step 9" />
10. Media quality: Select Higher quality, then click <kbd>Start export</kbd>.
    <br /><img src="/public/assets/tutorial-export-json/10.webp" width="250" style="border-radius: 6px; margin: 10px 0;" alt="Step 10" />

Once the export completes and you download the `.zip` archive, extract it and drag the `followers_1.json` and `following.json` files into the InstaClear interface.

## Local Development

InstaClear requires zero build tools. However, due to CORS policies on module imports (`type="module"`), it must be served over HTTP rather than the `file://` protocol.

```bash
# Clone the repository
git clone https://github.com/fadd3079-prog/InstaClear.git
cd InstaClear

# Serve locally via Python 3
python -m http.server 8000

# Access via browser
# Navigate to http://localhost:8000
```

<br />
<hr />
<div align="center">
  <p>Copyright &copy; 2026 Mufaddhol (Fadd Graphics) - Informatics Student</p>
  <p>
    <a href="https://instagram.com/fadd.graphics">Instagram</a> &bull; 
    <a href="https://github.com/fadd3079-prog/InstaClear">GitHub</a> &bull; 
    <a href="mailto:faddgraphics@gmail.com">Email</a>
  </p>
</div>
