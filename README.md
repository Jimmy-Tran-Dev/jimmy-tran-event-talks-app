# BigQuery Release Radar 📡

BigQuery Release Radar is a high-fidelity single-page web dashboard that monitors Google Cloud's BigQuery release notes. It parses the live feed, breaks daily bundles down into individual updates, caches them locally for maximum efficiency, and features a smart, interactive composer to tweet updates directly to X/Twitter.

---

## 🚀 Getting Started

### Prerequisites
* Python 3.8 or higher
* Pip (Python package manager)

### Installation
1. **Clone or download** this repository.
2. Navigate to the project root directory:
   ```bash
   cd bq-releases-notes
   ```
3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application
1. Start the Flask development server:
   ```bash
   python app.py
   ```
2. Open your web browser and navigate to:
   **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🎨 Key Features

### 1. Granular Timeline Nodes
Instead of displaying all daily updates in a single block, the backend uses `BeautifulSoup` to split feed data into individual items. Updates are categorized and color-coded with sleek tag indicators:
* <span style="color:#10b981">●</span> **Feature** — Emerald
* <span style="color:#ef4444">●</span> **Issue** — Red
* <span style="color:#f59e0b">●</span> **Changed** — Amber
* <span style="color:#8b5cf6">●</span> **Deprecation** — Purple
* <span style="color:#0ea5e9">●</span> **Other** — Blue

### 2. Premium Light/Dark Theme
The interface supports a glassmorphic dashboard design utilizing HSL color variables. You can toggle between dark (default) and light mode via the theme switch in the navbar.

### 3. Integrated X/Twitter Composer
Clicking **Tweet** on any update card opens a custom draft editor:
* **Compliant URL Weighting:** Adjusts character limits to treat the documentation URL as exactly **23 characters**, adhering to X/Twitter's `t.co` shortening standard.
* **Auto-Truncation:** Pre-truncates descriptions to fit within the 280-character limit automatically.
* **Hashtag Selector:** Checkboxes let you toggle popular hashtags (`#BigQuery`, `#GoogleCloud`, `#GCP`, etc.) dynamically into your draft.
* **Actions:** Copy the formatted text to your clipboard or push it directly to a new browser tab with X/Twitter's share intent.

### 4. Smart Local Cache
To ensure speed and minimize network overhead, the feed is stored locally in `cache.json` and loads instantly. Click **Refresh** to run an on-demand sync. If the live feed fails to load due to network issues, the application will display a warning and fall back to the cached copy safely.

---

## 📂 Project Directory Structure

```text
bq-releases-notes/
├── app.py                  # Flask backend server containing XML feed parsing & caching
├── requirements.txt        # Backend dependencies (Flask, Requests, BeautifulSoup4)
├── .gitignore              # Git ignore rules for virtualenvs, caches, and IDE structures
├── README.md               # Project documentation
├── templates/
│   └── index.html          # SPA dashboard layout structure and modal compositions
└── static/
    ├── css/
    │   └── styles.css      # Dark/light variables, timeline graphics, glassmorphic rules
    └── js/
        └── app.js          # Client-side filtering, fuzzy searches, and Twitter composer calculations
```

---

## 🛠️ Technology Stack
* **Backend:** Python (Flask, requests, beautifulsoup4, xml.etree.ElementTree)
* **Frontend:** Plain Vanilla HTML5, CSS3, ES6 JavaScript (No frameworks like React or Tailwind, resulting in sub-millisecond layout calculations and zero bundle compiling).
* **Icons:** High-performance inline SVGs.
