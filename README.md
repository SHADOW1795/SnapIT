# ⚡ SnapIT — Modern URL Shortener Web Application

A lightweight, beautiful, and fully functional URL Shortener web application built with vanilla **HTML5**, **CSS3**, and **JavaScript** (ES6+). Zero external dependencies, offline-ready, and privacy-first.

---

## 🌟 Key Features

1. **Dual Shortening Modes**:
   - **Instant Local Shortener (Offline-Ready)**: Generates high-entropy Base62 slugs (`snap.link/?r=xyz123`) and saves them to browser `localStorage`. When opened, an interactive redirection screen counts down and forwards you directly to the destination URL.
   - **Global Web Link (TinyURL API)**: Generates a public short link (`tinyurl.com/...`) using the free public TinyURL API so you can share links with anyone across the globe.
2. **Instant Redirection Simulator**:
   - Accessing `index.html?r=<slug>` simulates a real URL shortener redirect with a 3-second countdown, instant "Go Now" button, and automatic click tracking.
3. **Custom Slug & Labels**:
   - Choose your own custom alias (e.g., `portfolio`, `my-promo`).
   - Add labels or notes to organize and find your links quickly.
4. **Offline QR Code Generator**:
   - Generates crisp QR codes instantly for any shortened link using an embedded, zero-dependency HTML5 Canvas QR engine.
   - One-click PNG download for sharing on slides, posters, or mobile devices.
5. **Click Analytics & History**:
   - Tracks total links created, total clicks, and the top performing link.
   - Real-time search filter and instant copy/delete buttons for each link.
   - One-click **Export to CSV** for spreadsheets and backup.
6. **Modern, Responsive Design**:
   - Dark mode & light mode toggle with preference persistence.
   - Responsive layout designed for desktop, tablet, and mobile browsers.
   - Micro-interactions, copy-to-clipboard toast notifications, and accessible keyboard navigation.

---

## 🚀 How to Run the Web App

### Option 1: Direct Browser Launch (Simplest, Zero Setup)
1. Navigate to:
   ```
   C:\Users\abhay\.gemini\antigravity\scratch\url-shortener\
   ```
2. Double-click **`index.html`** or right-click and choose **Open with > Chrome / Edge / Firefox**.
3. That's it! Everything works immediately right in your browser.

---

## 📂 Project Structure

```
url-shortener/
├── index.html       # Clean semantic HTML5 layout & UI structure
├── style.css        # Modern responsive design, dark/light themes & animations
├── app.js           # URL validation, slug generation, storage & redirection logic
├── qrcode.js        # Zero-dependency vanilla JS QR code rendering engine
└── README.md        # Documentation and guide
```

---

## 🛠️ How It Works Under the Hood

### 1. Base62 Slug Algorithm
When a URL is submitted, a 6-character random code is generated from a 62-character alphabet (`[0-9a-zA-Z]`):
$$62^6 \approx 56.8 \text{ billion unique combinations}$$
This ensures zero collisions while keeping URLs extremely compact.

### 2. URL Normalization & Validation
- Automatically detects and prepends `https://` if the protocol was omitted by the user (e.g. `github.com` becomes `https://github.com`).
- Validates hostname syntax and blocks unsafe pseudo-protocols (`javascript:`, `data:`).

### 3. Redirection Flow
```
User visits [index.html?r=my-link]
   │
   ▼
Read ?r parameter
   │
   ├── Found in localStorage?
   │     ├─ Yes ──> Increment clicks count (+1)
   │     │          Display countdown timer
   │     │          window.location.replace(destinationUrl)
   │     │
   │     └─ No  ──> Show toast alert: "Link not found or expired"
```

---

## 💡 Recommended Next Step

To make this directory your active workspace in Antigravity, open your settings or workspace switcher and select:
```
C:\Users\abhay\.gemini\antigravity\scratch\url-shortener
```
