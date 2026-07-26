# InstaClear

A privacy-first, zero-server Instagram unfollower tracking utility that executes locally via Meta JSON exports.

[![License: MIT](https://img.shields.io/badge/License-MIT-4f46e5.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-e2e8f0.svg?style=for-the-badge&logo=javascript&logoColor=0f172a&labelColor=e2e8f0&color=94a3b8)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38bdf8?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-4f46e5.svg?style=for-the-badge)](https://github.com/fadd3079-prog/InstaClear/pulls)

![InstaClear UI Preview](/public/assets/screenshot.png)

## Table of Contents
- [The Problem & The Solution](#the-problem--the-solution)
- [Architectural Pillars](#architectural-pillars)
- [Technical Stack](#technical-stack)
- [Installation & Setup](#installation--setup)
- [Usage Guide](#usage-guide)
- [Local Development](#local-development)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## The Problem & The Solution

> **The Problem:** Traditional third-party unfollower applications are inherent security liabilities. They rely on direct API access, headless browser scraping, or raw credential inputs. This architectural anti-pattern routinely results in account compromise (phishing), aggressive rate-limiting, and permanent shadowbans implemented by Meta's automated security heuristics.

> **The Solution:** InstaClear entirely bypasses the Instagram API and runtime DOM scraping. By computing the dataset against static, official JSON exports provided voluntarily via Meta's Accounts Center, the audit process is fully isolated. Authentication is never required.

## Architectural Pillars

- **Privacy-First Execution:** Zero telemetry. Computation runs 100% client-side in the browser via JavaScript Set mechanics. No data is serialized, transmitted, or persisted on external servers.
- **Strict JSON Parsing:** Deterministic data structures. Bypasses brittle HTML DOM scraping by relying exclusively on Meta's official GDPR-compliant `.json` data exports.
- **Local State Resilience:** Persistent audits. Utilizes the browser's `localStorage` API for stateless resumption, combined with physical JSON backup capabilities.
- **Modern Interface:** Cognitive clarity. Implements a stark, distraction-free UI leveraging a modern Slate and Indigo palette to reduce cognitive load during bulk manual operations.

## Technical Stack

| Technology | Role in Architecture | Rationale |
|------------|----------------------|-----------|
| **Vanilla JavaScript** | Core parsing and state machine logic | Maximizes execution performance, removes bundler dependency overhead, and ensures complete code auditability for security researchers. |
| **Tailwind CSS** | Styling and layout orchestration | Rapid UI prototyping via utility classes injected via CDN, eliminating the need for a complex** | Styling and layout orchestration | Rapid UI prototyping via utility classes injected via CDN, eliminating the need for a complex Node.js build step in production. |
| **HTML5 DOM** | Presentation layer and local storage | Leverages native browser APIs (`FileReader`, `DOMParser`, `LocalStorage`) to handle complex datasets natively without heavyweight frameworks. |

## Installation & Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/fadd3079-prog/InstaClear.git
   cd InstaClear
   ```
2. Serve the project via any HTTP server (required due to ES module CORS restrictions):
   ```bash
   # Using Python 3
   python -m http.server 8000
   # Or using Node.js
   npx serve .
   # Or any other static server
   ```
3. Open your browser and navigate to `http://localhost:8000`.

## Usage Guide

1. Navigate to **Instagram Settings** → **Accounts Center**.
2. Go to **Your information and permissions** → **Export your information**.
3. Click **Create export**.
4. Select your Instagram account profile.
5. Choose **Export to device**.
6. **Customize information:** Deselect everything, then select only **Followers and following** under Connections, then **Save**.
7. **Critical:** Set date range to **All time**, then **Save**.
8. **Critical:** Set format to **JSON**, then **Save**.
9. Media quality: Choose **Higher quality**, then click **Start export**.
10. Once the export completes and you download the `.zip` archive, extract it and drag the `followers_1.json` and `following.json` files into the InstaClear interface.

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

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please ensure to update tests as appropriate.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

Mufaddhol (Fadd Graphics) - [Instagram](https://instagram.com/fadd.graphics) · [GitHub](https://github.com/fadd3079-prog/InstaClear) · [Email](mailto:faddgraphics@gmail.com)