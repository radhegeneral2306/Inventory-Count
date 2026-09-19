# Inventory Count

Godown stock-count app: import a Tally stock export (Excel), let staff enter live
counted quantities against that item list, and let admin see the Tally vs Live
difference in real time and export a combined report.

## Roles

- **Staff**: sees item name + unit only, enters live count. Never sees Tally qty
  or the difference.
- **Admin**: imports Tally Excel, sees Tally Qty / Live Count / Difference live as
  staff type, exports Excel/PDF.

## Stack

- React + Vite + TypeScript, hosted on GitHub Pages
- Firebase (Firestore + Auth) as the backend — free Spark plan
- `xlsx` for import/export, `jspdf` for PDF export

## One-time setup

### 1. Create a Firebase project

1. Go to https://console.firebase.google.com, create a project.
2. Build > Authentication > get started > enable **Email/Password** sign-in.
3. Build > Firestore Database > create database (start in production mode).
4. Project settings > General > "Your apps" > add a **Web app** > copy the
   config values into a local `.env` file (see `.env.example`).

### 2. Set Firestore Security Rules

Copy the contents of `firestore.rules` (repo root) into
Firestore Database > Rules in the Firebase Console, and publish.

### 3. Create the admin account

1. Authentication > Users > Add user (email + password).
2. Firestore Database > Data > create collection `users`, document ID = that
   user's UID (copy from the Authentication tab), fields:
   - `fullName`: string
   - `role`: `"admin"`

### 4. Create staff accounts (same process)

Repeat step 3 for each staff member, with `role: "staff"`. This is manual for
now — see the plan notes on why (keeps the project on Firebase's free plan).

### 5. Local development

```bash
cp .env.example .env   # fill in your Firebase config values
npm install
npm run dev
```

### 6. Deploy to GitHub Pages

```bash
npm run deploy
```

This builds the app and pushes `dist/` to the `gh-pages` branch. Enable
GitHub Pages on that branch under repo Settings > Pages (first deploy only).

Note: the `.env` values become part of the public JS bundle — this is normal
for Firebase web apps. The actual security boundary is the Firestore Security
Rules, not hiding these values.

## Known limitations (MVP)

- Excel import only; Tally's PDF export layout is complex enough that PDF
  import is deferred until we've seen a real sample.
- Import parsing uses a heuristic (skips rows with "total"/"grand"/etc.) and
  always shows a review/edit table before committing — check it before
  importing, since Tally layouts vary.
- Staff accounts are created manually in the Firebase Console (see above).
