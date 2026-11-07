# BlueCloud Linux x86_64 alpha

AppImage and Debian packages are provided separately from Windows releases.
Make the AppImage executable and open it. If FUSE is unavailable, launch it
with `--appimage-extract-and-run`. Debian packages can be installed with the
distribution package manager. ARM and older Linux systems are not validated.

BlueCloud Launcher installs verified AppImages in its per-user library and
checks its signed Linux release feed every 15 minutes while open. Automatic
updates apply to installed apps; launcher updates need a restart. Rollback
keeps the preceding app version. Documents and app data are outside the
managed binary library and are preserved on updates and uninstall.

Tooldeck bundles Linux FFmpeg. Protected-PDF operations additionally need
`qpdf` installed from the distribution. The Debian package declares this
requirement; AppImage users install qpdf separately.

Linux release metadata is `app-release-linux.json`, on `linux-v<version>`
releases in each app's own repository. Feed publication is a separate step:
packages become installable in the launcher only after their public downloads
are verified and their metadata is included in the signed Linux feed.

The Linux signing key stays under the owner's home directory, outside Git.
The Linux channel uses its own Ed25519 key; Windows release trust is unchanged.
Keep a private backup of the Linux signing key before future releases.

Startup checks establish initial rendering only. Native file-dialog round
trips, printing, Wayland, accessibility, broad distribution compatibility and
physical BlueCloud OS integration still need interactive validation.
