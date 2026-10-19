# BlueCloud Launcher 0.6.0

Install, open and update Coneic, Quranly and Tooldeck in their own public repositories. Downloads support pause/resume across restarts, size/speed/time feedback, integrity verification and restoring the previous app version. Windows updates acknowledge helper startup and verify the installed runtime before recording success. App profiles stay in place.

See [release notes](RELEASE-NOTES.md), [release workflow](RELEASING.md), and [Windows signing](WINDOWS-SIGNING.md). Run `npm ci`, `npm test`, `npm run test:desktop`, then `npm run dist:win`.

Each app owns its source and release assets. Never publish them to the website repository. Windows x64 preview; unsigned until a certificate is configured.
