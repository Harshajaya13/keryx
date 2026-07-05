# Keryx Phase 4 - Production Hardening

Keryx is feature complete.

Do NOT add any new features.

This phase is focused entirely on making the application production-ready, lightweight, reliable, and easy for my family to use.

Maintain the existing architecture.

---------------------------------------
1. Progressive Web App Improvements
---------------------------------------

Improve the PWA experience.

- Better install experience.
- Better standalone app behavior.
- Improve service worker reliability.
- Improve background synchronization where appropriate.
- Ensure updates are handled gracefully.

Do not redesign the UI.

---------------------------------------
2. Performance Optimization
---------------------------------------

Optimize the application for low-resource devices.

- Reduce RAM usage.
- Reduce CPU usage.
- Reduce unnecessary network requests.
- Optimize frontend bundle size.
- Cache static assets efficiently.
- Improve startup speed.

Maintain the lightweight sleeping architecture.

---------------------------------------
3. Offline Message Queue
---------------------------------------

If the internet connection is temporarily unavailable:

- Store outgoing messages locally.
- Automatically send them when the connection returns.
- Inform the user that the message is waiting to be sent.

This process should be automatic.

---------------------------------------
4. Reliability
---------------------------------------

Improve application reliability.

Implement:

- Automatic reconnect after network loss.
- Better recovery from Render cold starts.
- Graceful retry logic.
- Stable WebRTC reconnection.
- Better handling of temporary server failures.

---------------------------------------
5. User-Friendly Error Messages
---------------------------------------

Replace technical errors with simple English.

Examples:

Instead of:

"Socket disconnected"

Show:

"Connection lost.
Trying to reconnect..."

Instead of:

"ICE Connection Failed"

Show:

"Unable to connect the call.
Please try again."

Instead of:

"Network Error"

Show:

"No internet connection.
Your message will be sent automatically when you're back online."

The application is being used by non-technical users.

---------------------------------------
6. Battery Optimization
---------------------------------------

Continue improving battery efficiency.

Ensure:

- Idle sockets disconnect correctly.
- No unnecessary timers continue running.
- Background tasks remain minimal.
- No unnecessary CPU wakeups.
- Calls release all resources immediately after ending.

---------------------------------------
7. Security Hardening
---------------------------------------

Prepare the application for production deployment.

Implement:

- HTTPS only.
- Secure cookies.
- Content Security Policy (CSP).
- Request rate limiting.
- Environment variable validation.
- Proper input validation.

Do not add any authentication systems or unnecessary security complexity.

---------------------------------------
8. Production Readiness
---------------------------------------

Ensure the application is stable for everyday family use.

- Improve logging for debugging.
- Handle unexpected errors gracefully.
- Prevent crashes where possible.
- Keep the application responsive even on slow devices.
- Keep the code clean and modular.

---------------------------------------
Rules
---------------------------------------

Do not add new features.

Do not redesign the UI.

Do not modify the sleeping architecture.

Focus only on stability, reliability, performance, battery efficiency, and production readiness.