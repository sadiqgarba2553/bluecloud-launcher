# Windows signing

Builds remain unsigned until a certificate is connected. Ed25519 release-feed signatures verify downloads; Authenticode identifies the Windows publisher.

To require Authenticode, set `BLUECLOUD_SIGN_WINDOWS=1` and either:

- `CSC_LINK` / `CSC_KEY_PASSWORD` for a private PFX available outside this repository, or
- `BLUECLOUD_CERT_THUMBPRINT` for a signing certificate and private key in the Windows certificate store.

Run the ordinary `npm run dist:win` command. The configuration requires signing when enabled and fails if no certificate is available. Timestamping and SHA-256 are handled by electron-builder. Verify the resulting installer and application with Windows signature tools before publishing. Configure CI credentials as secrets, never as files in Git or release assets. Do not paste passwords into command-line arguments or commit certificates, keys, or environment files.

Without `BLUECLOUD_SIGN_WINDOWS=1`, packaging intentionally produces an unsigned preview. Do not describe it as signed.
