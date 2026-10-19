# BlueCloud Launcher 0.6.2

Install, open and update Coneic, Quranly and Tooldeck in their own public repositories. Downloads support pause/resume across restarts, size/speed/time feedback, integrity verification and restoring the previous app version. Windows updates use a small native helper, acknowledge helper startup and verify the installed runtime before recording success. App profiles stay in place.

See [release notes](RELEASE-NOTES.md), [release workflow](RELEASING.md), and [Windows signing](WINDOWS-SIGNING.md). Run `npm ci`, `npm test`, `npm run test:desktop`, then `npm run dist:win`.

Each app owns its source and release assets. Never publish them to the website repository. Windows x64 preview; unsigned until a certificate is configured.

Windows builds compile `updater/Program.cs` with the .NET Framework compiler included on the Windows build host. The resulting GUI helper is copied outside the installation directory before use and runs independently of the closing Electron process. Windows 10 and 11 supply the .NET Framework runtime.
