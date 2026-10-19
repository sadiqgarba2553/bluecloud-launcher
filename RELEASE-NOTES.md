# BlueCloud Launcher 0.6.1 for Windows

Download **BlueCloud-Launcher-Setup-0.6.1-x64.exe** to install or update the launcher.

- Windows updates confirm the helper started before closing the launcher, avoid an unavailable PowerShell hashing command, verify the installed runtime, and report failures without an automatic retry loop.
- Pause and resume app downloads, including after restarting Launcher. Interrupted connections reuse partial downloads and verify the complete archive; progress shows downloaded size, speed and estimated time remaining.
- Restore the previous installed app version from its menu. User profiles stay in place and Windows shortcuts follow the restored installation.
- Apps requiring a newer Launcher show a direct update action. Source links open each app's own repository.
- Windows signing configuration is ready for a certificate. This preview remains unsigned.

The signed release feed and compatible download redirects continue to use each app's public repository. Tests cover helper execution on Windows, installation, rollback, paused downloads across restarts, tampering and retained app data. Source, runtime-integrity metadata and SHA-256 checksums are included.
