# Required: Download the Offline AI Model Files (one-time, ~12-15 MB)

The face recognition AI needs 3 pre-trained model files. These are
standard, publicly available files from the face-api.js project — they
cannot be generated, only downloaded once and bundled into your app.

## Step 1 — Create the folder

Inside your mobile project:
```
mobile/assets/models/
```

## Step 2 — Download these 6 files

Go to this official source and download all files starting with these 3
names into `mobile/assets/models/`:

**Source:** https://github.com/vladmandic/face-api/tree/master/model

Download these exact 6 files:
- `ssd_mobilenetv1_model-weights_manifest.json`
- `ssd_mobilenetv1_model.bin`
- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model.bin`
- `face_recognition_model-weights_manifest.json`
- `face_recognition_model.bin`

**Direct download (PowerShell):**
```powershell
cd mobile
mkdir assets\models
cd assets\models

$base = "https://raw.githubusercontent.com/vladmandic/face-api/master/model"
$files = @(
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model.bin",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model.bin",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model.bin"
)
foreach ($f in $files) {
  Invoke-WebRequest -Uri "$base/$f" -OutFile $f
}
```

Run that in PowerShell from your `mobile` project root — it downloads all
6 files automatically into the right folder.

## Step 3 — Verify

```powershell
dir mobile\assets\models
```
You should see all 6 files listed, with the `.bin` files being the larger
ones (several MB each).

Once these files exist, the app is fully ready — no further setup needed.
The AI runs 100% on-device after this.
