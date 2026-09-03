# ArthivoX Release Checklist

## Build hygiene
- [ ] Use Node 20 LTS and Yarn 1.22.x.
- [ ] `yarn install` completes successfully.
- [ ] `yarn typecheck` passes.
- [ ] `yarn lint` passes or all remaining warnings are reviewed.
- [ ] `yarn build:source` passes.
- [ ] No local `.db`, `.arthivox.db`, `.axenc`, `.env`, logs, patch folders, or backup folders are inside the release source.

## Product verification
- [ ] Login / signup / email verification tested.
- [ ] Forgot-password OTP flow tested.
- [ ] Create company tested.
- [ ] Connect existing local company tested.
- [ ] Customer, item, invoice, payment and journal workflows tested.
- [ ] Light, dark and system appearance tested.
- [ ] Offline save + reconnect sync tested.
- [ ] Conflict-resolution UI tested on two devices.
- [ ] Encrypted backup created and restored on a second PC.
- [ ] Legacy local `.books.db` / `.db` opening tested if backwards compatibility is promised.

## Cloud/security
- [ ] Supabase RLS/security advisor reviewed.
- [ ] No service-role key is present in source/bundle.
- [ ] SMTP sender/domain is production-ready.
- [ ] Recovery-passphrase UX clearly warns that lost passphrases cannot be recovered.
- [ ] Legacy unencrypted cloud backups are deleted only after encrypted restore is proven.

## Windows distribution
- [ ] Final x64 NSIS installer created.
- [ ] App name, icon, publisher, taskbar identity and uninstall entry say ArthivoX.
- [ ] Installer is code-signed for public distribution.
- [ ] Install / upgrade / uninstall tested on a clean Windows machine.
- [ ] SmartScreen behavior reviewed.

## Legal
- [ ] `LICENSE` is included.
- [ ] `NOTICE.md` is included.
- [ ] Corresponding source obligations under AGPL-3.0 are satisfied for distribution.
