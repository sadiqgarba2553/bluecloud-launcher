# BlueCloud apps 0.5.0 for Windows

Coordinated Windows x64 preview release for Coneic Player, Quranly PC, Tooldeck and BlueCloud Launcher. Each app's package version is 0.5.0. Existing app identifiers, settings paths and saved-content locations are retained.

- Coneic introduces a minimal glass interface, an inset media library, frosted settings and floating playback controls with a live blurred video backdrop. General Settings offers system, frosted glass and solid materials; reduced motion and Windows high contrast are respected. It keeps its validated VLC 3.0.24 engine and all 360 media plugins. Windows registration covers 134 media formats, each with a labelled format icon. A standalone per-user installer and a portable package are available.
- Quranly includes the existing reading, reciter collections, persistent offline downloads, audio-quality options, personal library and optional account backup features.
- Tooldeck retains its 79 local PDF, image, video, audio and utility tools.
- The launcher installs all three apps from signed release metadata, maintains Windows shortcuts and Coneic associations, and supports app and launcher updates. The 0.5 app packages require launcher 0.5.0; older launchers can first apply the launcher update.

The release includes four standalone installers, three managed app ZIPs, corresponding source archives, SHA-256 checksums and the signed update feed. Installers are unsigned Windows preview builds. The `alpha` update channel and existing pinned signing public key are retained. Publication does not edit or deploy website files.

The coordinated packager uses Quranly's freshly built application folder and includes each app's standalone installer. It archives committed app sources and never includes local environment files, dependencies, app profiles or private signing keys.
