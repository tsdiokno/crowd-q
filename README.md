# Crowd-Q: Let the Crowd Run the Queue

![image](/../main/screenshot-crowdq.png?raw=true "Screenshot")

**Crowd-Q** is a simple, lightweight web app for creating a **collaborative YouTube Music queue**.  
Inspired by Spotify’s *Jam* feature — but built for YouTube — it lets everyone in the room add to one shared queue while **playback stays centralized** on the host device.

> 🎵 One playback. One room. Everyone in control.

## 🚀 Features

- **Collaborative Queue** — Anyone connected can add YouTube links to the shared queue.  
- **Centralized Playback** — Playback happens on a single host device; no synchronization required.  
- **Real-Time Queue Updates** — The queue refreshes automatically every 30 seconds or on demand.  
- **Password Protection** — Only the host can control playback.  
- **Lightweight Design** — Minimal dependencies, fast and simple UI.  
- **Video Info** — Automatically shows thumbnails and titles (when API key is set).

## 🎧 What Makes Crowd-Q Different?

Unlike other “watch-together” or “sync” apps, **Crowd-Q** is focused on **collaborative queueing**, not synchronized playback.  
It’s designed for *same-room experiences* — a crowd-powered DJ setup, not a remote watch party.

### Comparison

| App / Feature               | Core Purpose                                      | Playback Type                     | Collaboration Style               | Environment Focus       | Unique Differentiator                                 |
|-----------------------------|---------------------------------------------------|-----------------------------------|-----------------------------------|-------------------------|-------------------------------------------------------|
| **Crowd-Q**                 | Remote **collaborative queue** for YouTube Music  | Single central playback (no sync) | Shared queue management (same room) | Local / same-room setup | Acts as an *automatic, crowdsourced DJ* experience     |
| **SyncTube / YouTube Sync** | Watch YouTube videos **in sync** across devices   | Fully synchronized playback       | Host-led shared viewing           | Remote / multi-device   | Focused on *synchronized watching*, not shared control |
| **Spotify Jam**             | Group listening via Spotify app                   | Fully synchronized playback       | Invite-only group session         | Local or remote         | Similar to SyncTube but *natively integrated* in Spotify |

> 🟡 *Crowd-Q = Shared Control, One Playback (Same Room)*  
> 🔵 *Others = Synchronized Playback (Across Devices)*

## 💡 Why Use This?

**Crowd-Q** is perfect for:
- House parties or gatherings using YouTube Music as the main platform.  
- Shared music sessions where multiple people want to contribute songs.  
- Situations where only one speaker or playback device is available.

If you’re looking for *synchronized playback across devices*, check out other great tools like **SyncTube** or **Spotify Jam**.  
But if you want **a shared, same-room queue experience**, Crowd-Q is built exactly for that — and future development will stay focused on **queueing and collaborative control**, not syncing.

## ⚙️ Installation

### Prerequisites
- A web server with PHP support (e.g. Apache, Nginx)  
- A modern browser with JavaScript enabled  
- *(Optional)* YouTube Data API key for displaying video titles

### Steps
1. Clone this repository:
   ```bash
   git clone https://github.com/tsdiokno/ytm4.git
   ```

2. Place the files in your web server’s root directory.
3. Ensure `queue.json` is writable.
4. *(Optional)* Create a `config.json` file with:

   ```json
   {
     "youtube_api_key": "YOUR_API_KEY"
   }
   ```
5. Start your server and open the app in your browser.

## 🎚️ Usage

### Host

1. Open the app in your browser.
2. Enter the **host password** (default: `12345`) to unlock playback controls.
3. Connect your output device (speaker, sound system).

### Guest

1. Join the same network as the host.
2. Open the app in a browser.
3. Add YouTube links to the queue and enjoy the music!

## 🧠 Technical Overview

* **Frontend:** HTML, CSS, vanilla JavaScript (YouTube IFrame Player API).
* **Backend:** PHP scripts (`save_queue.php`, `get_queue.php`) managing `queue.json`.
* **Queue Refresh:** Automatic every 30 seconds or manual refresh.

## ⚠️ Known Limitations

* The YouTube IFrame Player API may restrict playback in development environments — use production hosting.
* The app is intentionally basic; features like live sockets or advanced metadata can be added via forks.

## 📜 License

Licensed under the GNU General Public License v3.0 (GPL-3.0).

## 🤝 Contributing

1. Fork the repo.
2. Create a feature branch (`git checkout -b feature-name`).
3. Commit and push (`git commit -m 'Add feature'`).
4. Submit a pull request.

## 🙏 Acknowledgments

Built by **@tsdiokno**, with design-first simplicity and the help of **ChatGPT**.
**Crowd-Q** stays focused on what it does best: a **shared queue experience** — not a sync app, but a social DJ tool.

> “Let the crowd run the queue.” 🎶
