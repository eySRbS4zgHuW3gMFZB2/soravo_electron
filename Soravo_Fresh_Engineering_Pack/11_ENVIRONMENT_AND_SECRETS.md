# Environment and Secrets

## Environments

Use distinct `local`, `preview/staging`, and `production` environments. Never point preview deploys at production Supabase or Razorpay live mode.

## Required secrets (names are illustrative)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` / publishable key (public by design, still configure RLS correctly)
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never client)
- `RAZORPAY_KEY_ID` (server-configured)
- `RAZORPAY_KEY_SECRET` (server only)
- `RAZORPAY_WEBHOOK_SECRET` (server only)
- `RESEND_SMTP_USERNAME` / SMTP credential as issued by Resend
- `CLOUDFLARE_API_TOKEN` (least privilege)
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT`
- Optional minisign signing key kept offline, not in CI.

Do not add real values to docs. Provide `.env.example` with placeholders only. Ensure `.env*` ignore rules exclude real files while allowing `.env.example`.

## Owner-friendly setup instructions

Every service setup task must include:
- exact dashboard location in current UI (verify before writing);
- what to click/type;
- what value is safe to share with the agent and what is secret;
- how to verify success;
- how to undo or rotate it;
- screenshots requested only if they do not expose secrets.

Never ask the owner to paste a service-role key, Razorpay secret, SMTP password or Cloudflare token into chat. If the agent needs it, have the owner add it directly to the appropriate secret manager.

## Toolchain audit

The owner reported a Windows VM with Node/npm, Rust MSVC, Git, GitHub CLI, REA/Ghidra, OpenCode and various skills/MCPs. This report is historical and must be re-verified in the active VM before execution.

Record:
- OS/version/architecture;
- `git --version`, `gh --version`;
- `node --version`, `npm --version`;
- `rustc --version`, `cargo --version`, `rustup show`;
- Visual Studio Build Tools/Windows SDK on Windows;
- Linux distribution, WebKitGTK/GTK/ayatana/AppIndicator dependencies and linker packages for Linux;
- Tauri CLI version;
- installed browsers and Playwright version;
- skill inventory and MCP connection state;
- CodeRabbit CLI version/auth/quota status.
Do not dump PATHs containing credentials or environment variable values.
