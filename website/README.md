# Soravo Website

Commercial website for Soravo, built with React, TypeScript, Vite, and Tailwind CSS.

## Development

```bash
cd website
npm install
npm run dev
```

Opens at http://localhost:3000.

## Build

```bash
npm run build
```

Output in `website/dist/`.

## Test

```bash
npm test
```

## Environment

Copy `.env.example` to `.env` and fill in Supabase credentials:

```bash
cp .env.example .env
```

## Deployment

Deployed to Cloudflare Pages. See `Soravo_Fresh_Engineering_Pack/` for deployment details.

## Architecture

- React 18 + TypeScript + Vite
- Tailwind CSS v4
- shadcn/ui (radix-nova style)
- Supabase Auth for identity
- Supabase Postgres for data (RLS enabled)
- Razorpay for payments (design only, not yet implemented)