# LISC NY AI Compliance Assistant

An affordable housing compliance assistant for LISC NY underwriters. Searches **public agency rulebooks** and produces term sheet guides, guided deal reviews, and cited compliance flags.

**Built by:** Maurice Dixon (Pursuit) · **Partner:** LISC NY  
**Program:** Goldman Sachs × Pursuit Nonprofit AI Program · 2026

![App screenshot](./docs/screenshots/home.png)

## Demo

🎥 [Watch the demo recording](https://www.loom.com/share/aed3bde1a744473898d8fc0d9b81e5bc)

## What it does

1. **Term Sheet Guide** — Checklist and key thresholds for your loan type + funding programs  
2. **Guided Review** — Short Q&A about a deal, with program-specific follow-ups  
3. **Deal Snapshot** — Compliance flags with severity and rulebook citations  

## Tech stack

- **Next.js 16** + React + TypeScript + Tailwind  
- **Anthropic Claude** — guides, flags, conversation  
- **Supabase + pgvector** — public rulebook storage and search  
- **OpenAI embeddings** — rulebook ingestion only  

## Quick start

### Prerequisites
- Node.js 20+
- Accounts: Anthropic, Supabase, OpenAI (for ingestion), LlamaParse (for PDF parsing)

### Setup
```bash
git clone https://github.com/mauricedixon/LISC-NY-Goldman-build.git
cd LISC-NY-Goldman-build
git checkout tier-2.2
npm install
cp .env.example .env.local   # fill in keys — see Handoff doc
npm run dev
