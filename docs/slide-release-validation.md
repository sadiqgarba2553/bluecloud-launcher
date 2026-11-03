# Slide Cloud release verification

3 November 2026, Africa/Lagos.

Slide Cloud 0.1.0 joins Doc Cloud and Sheet Cloud through Launcher 0.7.2. The app source and assets are published in sadiqgarba2553/slide-cloud (source commit d3fbc55); launcher source is de15765. The website repository is separate and unchanged.

## Implementation

Original local-first presentation editor with the supplied orange artwork wrapped in the same squircle as its siblings. Real editable slides support text, simple shapes, embedded images, pointer movement/resizing, exact geometry/layer controls, ordered slide operations, speaker notes, undo/redo, templates, named history, local persistence, native backups, slideshow and basic PPTX import/export. Original imported PPTX files are retained. Slide-only print output excludes notes.

REA inspected the installed PowerPoint executable and English resource DLL, with SHA-bound evidence and limitations retained in the app's docs/RESEARCH.md. It informed the workflow; it does not establish source reconstruction or complete PowerPoint compatibility.

## Checks

- Slide Cloud: 9 model/exchange tests, 21 browser acceptance checks, 2 Rust filesystem tests; strict TypeScript and optimized Windows build passed. npm audit reports zero vulnerabilities.
- Browser workflows verified real text/objects, slide ordering and undo, pointer movement/resizing, image embedding, history, native/PPTX exchange, original byte retention, slideshow privacy/navigation/Escape, local reload and zero page exceptions.
- Two slide-only PDF pages (960×540pt) were inspected for recoverable text, visual content and absent private speaker notes. Editor/library responsive layouts and light/dark appearance passed the recorded checks.
- Native WebView2 library/editor/template and Save As were observed. A disk backup matched the four-slide native template with notes. Complete automated native dialog save/open/reopen remains unverified because UI control/window binding became unavailable; this is documented in the app report.
- Launcher: 14 unit/integration tests, 3 six-app desktop workflows, 1 release-destination test passed. Old apps and identifiers are preserved; new source routing and signed tickets are limited to the app's own repository.
- Public releases uploaded with size/digest verification: Slide Cloud v0.1.0 and Launcher v0.7.2. All seven feed records passed signature/schema and public download size checks. The previous 0.7.1 validator accepts the new envelope; Slide Cloud correctly requires 0.7.2.
- Download Edge Function v3 retains signed-ticket authentication and all existing download routes. The signed alpha channel was promoted with a compare-and-set write against a locally backed-up previous envelope; readback confirms launcher/doc/sheet/slide versions.
- The packaged Launcher 0.7.2 downloaded and installed the actual public Slide Cloud ZIP into an isolated profile. The installed executable is byte-identical to the final tested build. Its Open action spawned a real native Slide Cloud window. Offline feed failure retained the installed app and Open control. The isolated native smoke-test process was closed after verification.
- Both GitHub Slide Cloud verification runs completed successfully. Private feed-signing material remained local and untracked. Existing user profiles/content were not removed or replaced.

Windows x64 unsigned alpha with basic PPTX compatibility. Complete Office fidelity, advanced animations/media, hosted collaboration, multi-monitor Presenter View, clean-machine installation/uninstall, physical printers, accessibility certification, other platforms and large-deck profiling remain outside the verified scope. Exact asset hashes and fuller evidence live in the app report and ignored release/validation artifacts.
