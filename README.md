# YTM4: A YouTube Collaborative Queue  

![image](/../main/screenshot.png?raw=true "Screenshot")


A simple, lightweight web app for creating a collaborative YouTube music queue. Inspired by Spotify's **Jam** feature, this app allows multiple users to add YouTube links to a shared queue while playback remains centralized to the host. Ideal for group listening sessions where only YouTube is available.  

---

## Features  
- **Collaborative Queue**: Anyone with access to the app can add YouTube music links to the queue.  
- **Centralized Playback**: Only the host (who knows the password) can control playback—play, pause, next song.  
- **Real-Time Queue Updates**: The queue refreshes every 30 seconds automatically, or you can manually refresh it to see updates on-demand.  
- **Password Protection**: Playback controls and are protected by a host-defined password to maintain centralized control.  
- **Lightweight Design**: Simple UI, no unnecessary bloat.  

---

## Why Use This?  
This app is meant for **group music sessions** where YouTube is the primary platform. It provides a quick and rough alternative to Spotify's collaborative features when YouTube is your go-to music service.  

That said, if you're using this app alone or stumbled upon it accidentally, you might not find much use for it—you could simply make your own YouTube playlist or manually queue songs in the YouTube app.  

---

## Installation  

### Prerequisites  
- A web server with PHP support (e.g., Apache, Nginx).  
- A browser that supports modern JavaScript.  

### Steps  
1. Clone this repository:  
   ```bash
   git clone https://github.com/tsdiokno/ytm4.git
   ```  

2. Place the files in your web server's root directory.  

3. Ensure the following files and folders are writable:  
   - `queue.json` (for saving the queue state).  

4. Start your server and navigate to the app in your browser.  

---

## Usage  

### For Hosts  
1. Open the app in your browser.  
2. Enter the **host password** (default: `12345`) to unlock playback controls.  
3. Connect the audio output to a speaker system for centralized playback.  

### For Guests  
1. Open the app in your browser (ensure you're on the same network as the host).  
2. Add YouTube links to the queue.  
3. Watch the queue update in real time and enjoy the music!  

---

## Technical Overview  

### How It Works  
1. **Frontend**:  
   - Built with HTML, CSS, and vanilla JavaScript.  
   - Uses the YouTube IFrame Player API for video playback.  

2. **Backend**:  
   - Written in PHP to handle queue management (`save_queue.php`, `get_queue.php`).  
   - The queue state is stored in a `queue.json` file.  

3. **Queue Updates**:  
   - Automatically refreshed every 30 seconds via JavaScript.  
   - Manual refresh available for on-demand updates.  

---

## Known Limitations  
- **Development Mode Issues**: The YouTube IFrame Player API may block playback in non-production environments due to YouTube's restrictions. Make sure you run this app on a production server for it to work properly.  
- **Basic Implementation**: The app is intentionally kept simple. Advanced features like server-side updates, more robust APIs, or complex metadata scraping are not implemented but can be added by forking the project.  

---

## License  

This project is licensed under the GNU General Public License v3.0 (GPL-3.0).

---

## Contribution  

We welcome contributions! Here's how you can help:  
1. Fork the repository.  
2. Create a feature branch (`git checkout -b feature-name`).  
3. Commit your changes (`git commit -m 'Add feature'`).  
4. Push to your branch (`git push origin feature-name`).  
5. Open a pull request.  

---

## Acknowledgments  

This app was created by **@tsdiokno**, a designer with limited coding experience, with the help of **ChatGPT**. The project intentionally sticks to the basics but serves as a functional example of a collaborative YouTube queue.  

Feel free to fork and enhance the app with features like more advanced API usage, server-side updates, and metadata scraping.  

---

## Disclaimer  

If you use this app alone, it's no different from manually queuing songs in YouTube or creating a playlist. This app works best in group settings where the host controls playback, and everyone else contributes to the queue.  

Enjoy the music! 🎶
