# Doc Cloud and Sheet Cloud launcher release

3 November 2026 (Africa/Lagos). Launcher 0.7.1 enables the two Windows alpha apps in the existing library. App source and release assets live exclusively in their own repositories; the website repository is unchanged.

## Changes

- Doc Cloud 1.0.0 and Sheet Cloud 0.1.0 are installable alpha products with their existing squircle artwork, actual version numbers, source links and candid compatibility notes.
- Both apps ship managed ZIPs with native executables, third-party notices and known limitations, plus standalone NSIS installers.
- Repository allowlists and signed download-ticket routing include both apps. All existing app IDs, download paths, public signing key and profiles are preserved.
- Launcher 0.7.1 is required to enable the former coming-soon cards. Existing launchers receive its normal staged self-update.
- The six-release alpha feed preserves Coneic 0.6.0, Quranly 0.6.0 and Tooldeck 0.5.1. Private feed-signing material remains local and outside Git and CI.

## Verification before feed activation

- Launcher: 14 unit/integration tests, 3 desktop workflows and 1 release destination test passed. Existing five-app installation, update, rollback, offline retention, resumable download and tamper-rejection workflows passed.
- Doc Cloud: 13 unit/integration, 10 browser workflows and 2 Rust filesystem tests passed; TypeScript/frontend and optimized Windows packaging passed. Native home/editor rendered in an isolated WebView2 profile.
- Sheet Cloud: 13 unit/integration and 8 production-preview browser workflows passed; TypeScript/frontend build passed. Final native package verification is recorded below after completion.
- A first concurrent native build exhausted host memory. The bounded rebuild succeeded. Sheet's initial dev-server browser run was abandoned under memory pressure; the complete production-preview run passed. One initial XLSX unit case exceeded the default five-second timeout during concurrent work and passed on rerun.
- Updated download Edge Function retains signed-ticket authentication; unsigned requests receive 401. Existing four public downloads passed verification after the routing update. Public Doc Cloud ZIP downloaded through the live signed endpoint matches its exact byte size and SHA-256.

Windows x64 unsigned alpha. Full Office fidelity, hosted collaboration, clean-machine install/uninstall, full native save/reopen and other desktop platforms remain outside this release's verified scope. Build chunk-size warnings and an inherited unused Rust metadata type remain documented in the app reports.

## Live publication and final verification

- Public releases: Doc Cloud v1.0.0 (source commit ebed707), Sheet Cloud v0.1.0 (d42df42), Launcher v0.7.1 (7c8d3dc). All uploaded assets passed GitHub size/digest verification before publication.
- All six signed feed records passed public download HEAD/size checks, including both new app-owned repositories. The new envelope was accepted by both the current and previous launcher's signature/schema validators.
- The live alpha channel was updated with a compare-and-set write against the backed-up previous envelope; a readback confirmed all six app/version records and the 0.7.1 requirement for both office apps.
- The packaged Launcher 0.7.1 downloaded and installed the actual public Doc Cloud 1.0.0 and Sheet Cloud 0.1.0 ZIPs into an isolated library. The normal download path verified package hashes, and the expected native executables were present at the recorded installed versions. Both Open app actions remained available when feed refresh was forced offline.
- The native Sheet Cloud executable, home and real budget grid rendered successfully, including calculated totals and local saved state. Its optimized Windows NSIS build and 2 Rust filesystem tests passed.
- Both apps' npm audits reported zero vulnerabilities. Doc Cloud GitHub verification completed successfully; Sheet Cloud GitHub verification was still running at publication (local equivalent workflows passed).
- Rollback envelope and isolated test evidence remain under ignored `.release/`. No user library was installed into, removed or cleared during release QA. The website and production user data were unchanged.
