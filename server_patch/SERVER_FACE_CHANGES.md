# Server Changes for Face Embedding Storage (Optional, Non-Breaking)

These changes let your server store the face embedding sent from mobile,
so you can later build re-identification (matching a scanned face against
existing babies). Nothing here changes existing behavior — the field is
optional everywhere.

## 1. `server/src/models/Baby.ts`

Find this section:
```typescript
  motherImage?: string;
```
Add right below it:
```typescript
  motherFaceEmbedding?: number[];
```

Find this section (in the schema definition):
```typescript
    motherImage: { type: String },
```
Add right below it:
```typescript
    motherFaceEmbedding: { type: [Number], select: false },
```
(`select: false` keeps it out of normal API responses — it's a large array,
no need to send it to the web dashboard. It's only used server-side for
matching, if you build that later.)

## 2. `server/src/controllers/babyController.ts`

Find where `motherImage` is read from `req.body` or `req.file` during baby
creation/update (likely in the `createBaby` and `updateBaby` functions).
Add alongside it:

```typescript
if (req.body.motherFaceEmbedding) {
  try {
    babyData.motherFaceEmbedding = JSON.parse(req.body.motherFaceEmbedding);
  } catch {
    // Ignore malformed embedding — baby still saves normally
  }
}
```

That's the only server change needed. Everything else — babies without a
face scan, existing web dashboard, existing mobile screens — works exactly
as before.

## 3. Add the "Scan to Find Baby" endpoints

Two new files are included in this package:

- `server_patch/faceMatchController.ts` → copy to `server/src/controllers/faceMatchController.ts`
- `server_patch/babyRoutes_UPDATED.ts` → replace `server/src/routes/babyRoutes.ts` with this file

These add two endpoints:
- `POST /babies/match-face` — mobile sends a scanned embedding, server searches the live database and returns the matching baby (used when the phone is online)
- `GET /babies/face-index` — mobile downloads a lightweight list of all embeddings to cache locally, so matching still works when the phone has no internet

No other server files need to change. Restart your server after copying these two files.
