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

## Implementation Guidelines

### Always verify after changes
After any code change, run all three checks before considering the task done:
```sh
npm run lint       # auto-fixes what it can; remaining output = problems to fix
npx tsc --noEmit   # must produce no output (no errors)
npm run build      # must succeed
```

If UI changes affect any element captured by Playwright screenshot tests (e.g. the header), update the snapshot assets too:
```sh
npx playwright test --update-snapshots
```
Snapshot files live in `tests/e2e.spec.ts-snapshots/` and must be committed alongside the code change.

### Linting
Both the frontend and functions have separate ESLint configs based on `@hakatashi/eslint-config/typescript.js`.

- **Frontend**: `npm run lint` (runs `eslint . --fix` from the repo root, ignores `functions/`)
- **Functions**: `cd functions && npm run lint`

`npm run lint` uses `--fix`, so it auto-corrects formatting and import order in place. Always run it and check whether any unfixable warnings or errors remain in the output after auto-fix.

Key rules enforced by `@hakatashi/eslint-config`:
- **Import order**: imports are sorted alphabetically within each group (type imports last). The auto-fixer handles this, but write imports in sorted order to avoid unnecessary diffs.
- **Line length**: maximum 150 characters (`@stylistic/js/max-len`).
- **No non-null assertions** (`@typescript-eslint/no-non-null-assertion`): use optional chaining or explicit null checks instead.
- **No warning comments**: do not leave `TODO:`, `FIXME:`, or `XXX:` comments.
- Standard TypeScript strict rules apply throughout.

Some pre-existing warnings exist in the codebase (e.g. `react/prop-types`, `max-params`). New code should not introduce new warnings.

### Styling policy
- **Choose the right SUID component** for the job (e.g. `Stack` for flex layout, `Container` for max-width centering, `Typography` for text, `Divider` for separators). This is the primary way to avoid writing CSS.
- When individual style properties are needed beyond what the SUID component selection provides, write them in a **CSS Module** (`.module.css`) co-located with the route or component file. Do not use `sx` as a substitute for CSS.
- The `sx` prop is acceptable for SUID-specific theming values (e.g. `sx={{my: 2}}` using the spacing scale, or `sx={{color: 'text.secondary'}}` using the theme palette), but avoid encoding arbitrary pixel values or layout logic in `sx`.
- Global styles in `src/app.css` cover base resets and the `.markdown` class. Do not add new rules there.

### Doc and Collection components
Always use `Doc` and `Collection` from `~/components/` to render Firestore data — never access `.data` directly in JSX without these wrappers. They handle loading skeletons and error display consistently.

- **`Doc`** — for a single document (`useFirestore(docRef)`). Renders `Skeleton` while loading, calls children with the typed document when available. Pass `fallback` for the "document does not exist" case.
- **`Collection`** — for a collection query (`useFirestore(query(...))`). Renders `Skeleton` while loading, calls children via `<For>`. Pass `empty` for the zero-results case.

`useFirestore` can be called inside a `Collection` render function (it's inside the reactive component tree), e.g. fetching a related document per list item. This is safe and used throughout the codebase.

### Firestore + Solid.js reactivity
`useFirestore(ref)` returns a reactive store `{data, loading, error}` and must be called **synchronously at component creation time** or inside a `createEffect`. Never call it inside `createMemo` or conditional branches, as Solid.js cannot track subscriptions created outside a reactive root.

When a Firestore ref depends on async state (e.g., the authenticated user's UID), use the `createSignal` + `createEffect` pattern:
```ts
const [userData, setUserData] = createSignal<UseFireStoreReturn<User | null | undefined> | null>(null);
createEffect(() => {
    if (authState.data) {
        const userRef = doc(db, 'users', authState.data.uid) as DocumentReference<User>;
        setUserData(useFirestore(userRef)); // called inside createEffect = safe
    }
});
```
This pattern is used in `Header.tsx` and in the rules pages for the admin check.

### Global admin check (users.isAdmin)
To check whether the current user is a global admin, load the user document reactively (see pattern above) and derive a memo:
```ts
const isAdmin = createMemo(() => userData()?.data?.isAdmin === true);
```
Wrap admin-only UI in `<Show when={isAdmin()}>`. In `firestore.rules`, use `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true`.

### Markdown rendering
Use `SolidMarkdown` with the global `.markdown` class and `remarkGfm`:
```tsx
import remarkGfm from 'remark-gfm';
import {SolidMarkdown} from 'solid-markdown';

<SolidMarkdown class="markdown" children={content} remarkPlugins={[remarkGfm]} linkTarget="_blank"/>
```
The `.markdown` class (defined in `src/app.css`) handles word-break, link colour, image sizing, and inline code styling.

### Firestore writes
- Use `addDoc` when the document ID should be auto-generated.
- Use `setDoc(doc(db, collection, id), data)` when the caller specifies the ID.
- Use `serverTimestamp()` for `createdAt`/`updatedAt` fields. Immediately after a write the local pending state may have a `null`-like timestamp, so null-check before calling `formatTimestamp`.

### Schema and Firestore rules
- Add new Firestore document shapes to `src/lib/schema.d.ts` (cast refs with `as CollectionReference<T>` / `as DocumentReference<T>`).
- Add corresponding rules to `firestore.rules` for every new collection. Validate field types and allowed keys explicitly; Firestore rules do not infer them.
- The `UseFireStoreReturn<T>` type is defined in `schema.d.ts` — import it from `~/lib/schema`, not from `solid-firebase`.
