# Launcher releases

Publish only to `sadiqgarba2553/bluecloud-launcher`. Source, tags, installers and assets for other apps belong in their respective repositories. The publisher rejects the website repository and checks the origin remote and source commit.

1. Update this app's `package.json`, lockfile, launcher catalog entry, `release.config.json` and release notes.
2. Run `npm test`, `npm run test:desktop`, and `node --test tools/release.test.mjs`. Commit and push to this repository.
3. Dispatch the app-owned release workflow, or run `npm run dist:win`, `node tools/release.mjs prepare`, then `node tools/release.mjs publish` locally with Git credentials. Published assets are immutable.
4. Once each planned app release is public, run `node tools/build-feed.mjs release-plan.json`. The signing key is read from `%LOCALAPPDATA%/BlueCloud/ReleaseSigning/release-private.pem` or `BLUECLOUD_SIGNING_KEY`; never add it to Git or Actions.
5. Deploy `supabase/functions/app-release-download/index.mjs` if its implementation changed. It requires a valid Ed25519 ticket and validates the app, version, expiry and upstream CDN. The JWT platform check is disabled because legacy clients have no user token; authentication occurs inside the handler.
6. Verify every signed download link and compatibility with the legacy launcher validator. Apply `.release/feed/promote-feed.sql` through authorized Supabase tooling, then verify the public signature and run the packaged smoke tests.

The signed redirect preserves previous launcher compatibility without retaining website-hosted releases. Actual files remain in each app's GitHub repository.

The live upgrade smoke tests accept an explicit `BLUECLOUD_UPGRADE_FIXTURES` directory containing previous-version archives and signed metadata. Fixtures are inputs, not a dependency on another source repository. Tests keep profiles in `.release/validation/`; builds stay in `release/`.
