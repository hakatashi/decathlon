# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Decathlon is a full-stack web application for managing competitive programming/skill competitions called "Athlons". It supports multiple challenge types: codegolf, typing, SQL, reversing, quantum computing, and prompt engineering.

## Commands

### Frontend (root)
```sh
npm run dev          # Start development server
npm run build        # Build production bundle
npm run lint         # Run ESLint with auto-fix
npm test             # Run Playwright E2E tests (requires built app)
npx tsc --noEmit     # Type-check only
```

### Cloud Functions (`functions/`)
```sh
cd functions
npm run build        # Compile TypeScript
npm run build:watch  # Watch mode
npm run serve        # Build + start Firebase emulators locally
npm run deploy       # Deploy to Firebase
npm run lint         # ESLint check
```

### Running a single Playwright test
```sh
npx playwright test --grep "test name"
npx playwright test tests/e2e.spec.ts --project=chromium
```

## Architecture

This is a monorepo with two deployable units:

**`/src` — SolidStart frontend**
- Solid.js + SolidStart with file-based routing grouped into layouts: `(home)/` and `(fullscreen)/`
- Talks to Firestore directly via `solid-firebase` for real-time data (no dedicated API layer)
- Firebase Auth with Slack OIDC for authentication
- Material Design UI via SUID

**`/functions` — Firebase Cloud Functions**
- Firestore triggers + `onCall` HTTP endpoints
- Handles: user eligibility (Slack team membership check), score calculations, ranking updates, prompt engineering evaluation
- Connects to Slack API for user validation

**`/lib/scores.ts` — Shared scoring utilities** used by both frontend and functions.

**`/src/lib/schema.d.ts`** defines all Firestore data model interfaces. This is the authoritative source for data shapes: `Athlon`, `Game`, `Score`, `Submission`, `Ranking`, `User`, `Writeup`, etc.

### Data Flow
- Submissions and results are stored in Firestore
- Cloud Functions trigger on Firestore writes to compute scores and rankings
- The frontend reads rankings and scores in real-time via Firestore subscriptions
- Rankings are pre-computed and stored; the frontend does not calculate them

## Tech Stack

- **Frontend**: Solid.js, SolidStart, Vinxi, SUID (Material Design), SCSS
- **Backend**: Firebase Cloud Functions (Node 20), Firestore, Cloud Storage
- **Testing**: Playwright — 5 browser profiles (Chromium, Firefox, WebKit, iPhone 15, Pixel 7)
- **Language**: TypeScript with strict mode throughout
- **Linting**: ESLint with `@hakatashi/eslint-config`

## Firebase Project

- Project ID: `tsg-decathlon`
- Firestore security rules: `firestore.rules`
- Storage rules: `storage.rules`
- Functions environment variables are in `functions/.env` (git-ignored; stored in GitHub secret `FUNCTIONS_DOTENV`)

## CI/CD

GitHub Actions (`.github/workflows/test.yml`) runs on every push:
1. Type-check (`tsc --noEmit`)
2. Build
3. Playwright E2E tests (all 5 browsers)
4. Deploy preview to Firebase Hosting
5. On `main`: deploy Firestore rules, functions, and hosting live channel
