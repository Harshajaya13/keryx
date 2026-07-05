# Keryx

In ancient Greece, a **Keryx** (*κῆρυξ*) was a sacred herald—a trusted messenger whose duty was to deliver crucial communication directly and swiftly between people, without noise or delay. 

We chose the name because that is exactly what this project is: a direct, unburdened messenger designed to carry words between two people instantly when it matters, and step out of the way when it doesn't.

---

# Why Keryx Exists

Keryx was not created to compete with WhatsApp, Telegram, or Signal.

It was created because of a very specific family problem.

Mom and Brother needed a reliable way to communicate.

However, several constraints made existing solutions impractical:

* Both devices use the same WhatsApp account.
* Since it is the same account, they cannot simply call each other through WhatsApp.
* One of the devices is managed with Samsung Knox policies, allowing only administrator-approved applications.
* Installing alternative communication apps is either impossible or unreliable under these restrictions.
* Both devices still have internet access.
* They only need short conversations, usually lasting less than five minutes, mainly for urgent family communication.

Instead of trying to bypass these restrictions, Keryx was designed around them.

The idea was simple:

If both devices already have internet access, why not create a tiny communication bridge dedicated to just these two people?

Rather than keeping a permanent connection alive 24/7, Keryx sleeps when the browser sleeps, consuming almost no battery or RAM.

### The Sleep Philosophy
* **Open Chrome → Connected**
* **Switch Tabs → Still Connected**
* **Close Chrome → Sleep**
* **Push Notification → Wake**
* **Reconnect Automatically**

**Keryx sleeps when the browser sleeps, not when the user simply looks somewhere else.**

When communication is needed:

1. Mom presses **Call**.
2. Brother receives a lightweight notification.
3. Keryx wakes up.
4. A temporary WebRTC connection is established.
5. They talk.
6. The call ends.
7. Keryx goes back to sleep.

The project is not trying to replace WhatsApp.

It simply solves one very specific communication problem that existing platforms were never designed for.

Sometimes the best software isn't built because millions of people need it.

Sometimes it's built because two people do.

---

# The Pain

If you have ever tried to set up modern software for family members under unusual constraints, you already know the pain:

* **"Just call me on WhatsApp."** *"I can't, we are literally the same person according to the servers."*
* **The Overprotective Guard:** Samsung Knox is a brilliant security suite, but it sometimes behaves like an overprotective bouncer at a club. If a background process tries to keep an open socket alive to listen for incoming calls, Knox escorts it off the premises.
* **The Socket Vampires:** Most real-time web apps keep a permanent WebSocket or long-polling connection open 24/7. On a resource-constrained phone, this silently eats away at RAM and siphons battery life just to ask the server, *"Any news yet?"* every three seconds.

We didn't need another heavy application fighting the operating system for background survival. We needed something smarter.

---

# The Idea

Instead of fighting the device's battery optimizer by keeping a permanent connection alive, we adopted a different philosophy:

**Sleep.**  
When communication is needed... **Wake.**  
**Talk.**  
**Sleep again.**  

Keryx spends 99% of its life completely asleep. There are no background WebSockets spinning in infinite loops, and no timers draining battery. 

When Mom sends a message or initiates a voice call, the server fires a high-priority Firebase Cloud Notification (FCM). That push notification acts as a gentle tap on the shoulder, waking up the Progressive Web App just long enough to fetch the data or negotiate a direct, peer-to-peer WebRTC voice connection. Once the call hangs up or the screen locks, Keryx gracefully closes its sockets and goes right back to sleep.

This simple architecture drops CPU and memory usage to virtually zero while idle, while guaranteeing that notifications still break through when it counts.

---

# Features

Despite its tiny footprint, Keryx packs the essentials needed for everyday family communication:

* 💬 **Lightweight Real-Time Chat:** Clean, instant messaging without the bloat.
* 📞 **Peer-to-Peer Voice Calls:** Crystal-clear WebRTC audio calls that connect directly between devices.
* 🚨 **Emergency Mode:** A dedicated high-priority beacon that cuts through background noise with red alert banners and instant admin push notifications.
* 💤 **Sleeping Architecture:** Automatically disconnects idle sockets after 15 seconds in the background to preserve battery and RAM.
* 🔔 **Push Notifications:** Powered by Firebase Cloud Messaging to reliably wake sleeping devices for calls and texts.
* 📦 **SQLite Persistence:** Uses zero-compilation WebAssembly SQLite (`sql.js`) for rock-solid, cross-platform message and call log storage.
* 🔒 **Family Key Security:** Protected by strict bcrypt password hashing and 30-day cryptographically signed session tokens. No random visitors allowed.
* ✓✓ **Smart Read Receipts:** Real-time tracking for Sent (`✓`), Delivered (`✓✓`), and Read (`✓✓` in vibrant green).
* 🟢 **Presence & Last Seen:** Live indicators showing when your partner is Online, In Call, Sleeping, or when they were last seen.
* ✍️ **Live Typing Indicator:** Empathetic visual feedback (`"✍️ Partner is typing..."`) during active conversations.
* 📞 **Call History & Missed Alerts:** A dedicated log of outgoing, incoming, and missed calls, with inline system bubbles in the chat.
* 🕒 **Offline Message Queue:** Type messages even without Wi-Fi; they queue locally and automatically send the second your internet returns.
* 📱 **Progressive Web App (PWA):** Installs cleanly onto the home screen as a standalone app with native desktop and mobile feel.

---

# Philosophy

Keryx is intentionally small. 

It does not try to replace WhatsApp. It does not try to compete with Telegram or Signal. It is simply a dedicated, private communication bridge built for one family.

There are no stories.  
There are no reels.  
There are no broadcast channels.  
There are no ads or algorithmic feeds.  
There is no unnecessary complexity.  

Just communication.

---

# Architecture

```text
       ┌────────────────────────┐
       │     Browser / PWA      │
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │   Firebase Push (FCM)  │
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │    Node.js Backend     │
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │   SQLite Persistence   │
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │   WebRTC Audio Call    │
       └────────────────────────┘
```

---

# Roadmap

* **Phase 1 — Core Communication:** Built the foundational React UI, Node.js signaling server, Socket.IO messaging, and WebRTC audio calling between two fixed identities.
* **Phase 2 — Sleeping Architecture:** Integrated Firebase Cloud Messaging (FCM), device token registration, unread message badges, and idle-socket disconnection.
* **Phase 3 — Reliability and Persistence:** Implemented WebAssembly SQLite (`sql.js`), bcrypt Family Key authentication, presence tracking, read receipts, call logs, and Emergency Mode.
* **Phase 4 — Production Hardening:** Added automatic offline message queuing, HTTP security headers (CSP, HSTS), user-friendly English error wording, and zero-leak WebRTC resource cleanup.

---

# Built For

Keryx wasn't built to connect millions of people.

It was built to make sure two people who matter could always reach each other.

And honestly, sometimes solving one stubborn family problem is more than enough reason to write software.
