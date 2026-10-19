# BlueCloud Launcher

Standalone Windows app for installing, opening and updating Coneic, Quranly PC and Tooldeck. This repository contains only the launcher and its update service.

- [Coneic source and releases](https://github.com/sadiqgarba2553/coneic)
- [Quranly PC source and releases](https://github.com/sadiqgarba2553/quranly-pc)
- [Tooldeck source and releases](https://github.com/sadiqgarba2553/tooldeck)
- [Launcher releases](https://github.com/sadiqgarba2553/bluecloud-launcher/releases)

Run `npm ci`, then `npm run desktop`. `npm test` checks signatures, repository routing, extraction, update integrity and isolation. `npm run test:desktop` exercises the launcher with disposable profiles. `npm run dist:win` builds this app's installer in `release/`. Each other app has its own dependencies, build commands and installer.

See [release instructions](RELEASING.md). Both publishing and download validation reject the website repository. The website is separate. The release endpoint authenticates Ed25519 tickets and redirects only to fixed app repositories; it never writes to GitHub or accesses user data.
