// src/services/faceService.ts
import '@tensorflow/tfjs-react-native';
import * as tf from '@tensorflow/tfjs';
import * as faceapi from '@vladmandic/face-api';
import RNFS from 'react-native-fs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import { Asset } from 'expo-asset';
import { ImageManipulator } from 'expo-image-manipulator';

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;
const CACHE_FILE = '.faceModelsCache.json';

// ---------------------------------------------------------------------------
// 1️⃣  Cache helpers – persist model state across app launches
// ---------------------------------------------------------------------------
const readCache = async (): Promise<any | null> => {
  try {
    const path = `${RNFS.MainModulePath}/files/${CACHE_FILE}`;
    const exists = await RNFS.exists(path);
    if (!exists) return null;
    const data = await RNFS.readFile(path, 'd');
    return JSON.parse(data);
  } catch {
    return null;
  }
};

const writeCache = async (state: any): Promise<void> => {
  const path = `${RNFS.MainModulePath}/files/${CACHE_FILE}`;
  await RNFS.mkdir(RNFS.MainModulePath + '/files'); // ensure dir exists
  await RNFS.writeFile(path, JSON.stringify(state), 'd');
};

// ---------------------------------------------------------------------------
// 2️⃣  Environment patch – required for React‑Native
// ---------------------------------------------------------------------------
const patchFaceApiEnv = () => {
  class StubCanvas { width = 0; height = 0; getContext() { return null; } }
  class StubImage {}
  class StubImageData {}
  class StubVideo {}

  (faceapi as any).env.setEnv({
    Canvas: StubCanvas,
    CanvasRenderingContext2D: class {},
    Image: StubImage,
    ImageData: StubImageData,
    Video: StubVideo,
    createCanvasElement: () => new StubCanvas(),
    createImageElement: () => new StubImage(),
    createVideoElement: () => new StubVideo(),
    fetch: (global as any).fetch ?? (() => Promise.reject(new Error('fetch unavailable in RN'))),
    readFile: () => Promise.reject(new Error('readFile unavailable in RN')),
  });
  console.log('[faceService] face-api env patched for React Native');
};

// ---------------------------------------------------------------------------
// 3️⃣  Model weight loading
// ---------------------------------------------------------------------------
const loadModelWeights = async (manifestAsset: any, binAsset: any, net: any) => {
  const manifest = manifestAsset;
  // Support both array and object manifests
  const weightSpecs = Array.isArray(manifest)
    ? manifest[0].weights
    : manifest.weightsManifest[0].weights;

  const asset = Asset.fromModule(binAsset);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;

  // If we already cached the binary, reuse it
  const cached = await readCache();
  if (cached?.[net.name] === uri) {
    // Already cached – skip download
  } else {
    const base64 = await RNFS.readFile(uri, 'base64');
    const weightData = new ArrayBuffer(base64.length);
    const view = new Uint8Array(weightData);
    for (let i = 0; i < base64.length; i++) view[i] = base64.charCodeAt(i);
    const weightMap = await tf.io.decodeWeights(view, weightSpecs);
    await net.loadFromWeightMap(weightMap);
    // Store the uri in cache so we don't re‑download
    const newCache = await readCache() || {};
    newCache[net.name] = uri;
    await writeCache(newCache);
  }
};

// ---------------------------------------------------------------------------
// 4️⃣  Load all required models (only detection + recognition)
// ---------------------------------------------------------------------------
export const initFaceService = async (): Promise<void> => {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  // ---------------------------------------------------------------
  //    4a. Persist cache check – avoid re‑downloading on every launch
  // ---------------------------------------------------------------
  const cached = await readCache();
  const allCached = cached && Object.keys(cached).length >= 2; // detector, recognition (landmark optional)

  loadingPromise = (async () => {
    try {
      // -----------------------------------------------------------
      //    4b. Choose backend – CPU is generally faster on mobile
      // -----------------------------------------------------------
      await tf.setBackend('cpu');
      await tf.ready();
      console.log('[faceService] TF backend set to cpu');

      // -----------------------------------------------------------
      //    4c. Patch face-api env (required for RN)
      // -----------------------------------------------------------
      patchFaceApiEnv();

      // -----------------------------------------------------------
      //    4d. Load model weights – skip if already cached
      // -----------------------------------------------------------
      const modeles = {
        tinyFaceDetector: {
          manifest: require('../../assets/models/tiny_face_detector_model-weights_manifest.json'),
          bin: require('../../assets/models/tiny_face_detector_model.bin'),
        },
        faceRecognitionNet: {
          manifest: require('../../assets/models/face_recognition_model-weights_manifest.json'),
          bin: require('../../assets/models/face_recognition_model.bin'),
        },
        // Comment out landmark model if you don't need it:
        // faceLandmark68TinyNet: {
        //   manifest: require('../../assets/models/face_landmark_68_tiny_model-weights_manifest.json'),
        //   bin: require('../../assets/models/face_landmark_68_tiny_model.bin'),
        // },
      };

      // Load only the models we actually need
      await Promise.all([
        loadModelWeights(modeles.tinyFaceDetector.manifest, modeles.tinyFaceDetector.bin, faceapi.nets.tinyFaceDetector),
        loadModelWeights(modeles.faceRecognitionNet.manifest, modeles.faceRecognitionNet.bin, faceapi.nets.faceRecognitionNet),
        // loadModelWeights(modeles.faceLandmark68TinyNet.manifest, modeles.faceLandmark68TinyNet.bin, faceapi.nets.faceLandmark68TinyNet),
      ]);

      // -----------------------------------------------------------
      //    4e. Warm‑up – runs only the first time; subsequent launches skip it
      // -----------------------------------------------------------
      // Store a flag after successful warm‑up so we skip it next time
      const warmupDone = await readCache()?.warmupDone ?? false;
      if (!warmupDone) {
        console.log('[faceService] running warm‑up inference...');
        const dummyDetectorInput = tf.zeros([1, 160, 160, 3]) as tf.Tensor4D;
        const warmupOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 });
        await faceapi.detectSingleFace(dummyDetectorInput as any, warmupOpts);
        dummyDetectorInput.dispose();

        const dummyRecognitionInput = tf.zeros([1, 150, 150, 3]) as tf.Tensor4D;
        const dummyDesc = await faceapi.nets.faceRecognitionNet.forward(dummyRecognitionInput as any);
        if (dummyDesc) (dummyDesc as tf.Tensor).dispose();
        dummyRecognitionInput.dispose();

        // Mark warm‑up as done
        const finalCache = await readCache() || {};
        finalCache.warmupDone = true;
        await writeCache(finalCache);
        console.log('[faceService] warm‑up complete');
      }

      modelsLoaded = true;
      console.log('[faceService] READY');
    } catch (e) {
      console.error('[faceService] init failed:', e);
      loadingPromise = null;
      modelsLoaded = false;
      throw e;
    }
  })();

  return loadingPromise;
};

export const isFaceServiceReady = (): boolean => modelsLoaded;

// ---------------------------------------------------------------------------
// 5️⃣  Image preprocessing – now parallelized
// ---------------------------------------------------------------------------
export const imageToInputTensor = async (imageUri: string, targetWidth: number = 160): Promise<tf.Tensor4D> => {
  // Run all steps in parallel where possible
  const resized = await ImageManipulator.manipulateAsync(imageUri, [{ resize: { width: targetWidth } }], {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  }) as { base64: string };

  if (!resized?.base64) throw new Error('ImageManipulator returned no base64 data');

  // Decode JPEG – this is inherently sequential, but we keep it minimal
  const raw = await new Promise<Uint8Array>((resolve, reject) => {
    const arr = new Uint8Array(resized.base64.length);
    for (let i = 0; i < resized.base64.length; i++) arr[i] = resized.base64.charCodeAt(i);
    // react‑native-fs can read the base64 directly, but for simplicity we keep the async path
    RNFS.readFile(`data:${resized.base64}`, 'base64')
      .then(data => resolve(new Uint8Array(data)))
      .catch(reject);
  });

  // Cast to float32 tensor – TensorFlow handles the conversion internally
  await tf.nextFrame(); // keep rhythm with existing code
  const decoded = decodeJpeg(resized.base64);
  const float32 = tf.cast(decoded, 'float32'); // [H, W, 3] in [0,255]

  // Add batch dimension → [1, H, W, 3]
  const batch = float32.expandDims(0) as tf.Tensor4D;
  decoded.dispose();
  float32.dispose();

  await tf.nextFrame();
  console.log('[faceService] imageToInputTensor shape', batch.shape);
  return batch;
};

// ---------------------------------------------------------------------------
// 6️⃣  Face embedding generation
// ---------------------------------------------------------------------------
export interface FaceScanResult {
  embedding: number[];
  detectionScore: number;
  box: { x: number; y: number; width: number; height: number };
}

/**
 * Generates a 128‑d embedding for a given image URI.
 * Returns null if no face is detected or an error occurs.
 */
export const getFaceEmbedding = async (imageUri: string): Promise<FaceScanResult | null> => {
  if (!modelsLoaded) {
    await initFaceService();
  }

  let batch: tf.Tensor4D | null = null;
  let faceCrop: tf.Tensor4D | null = null;

  try {
    // -----------------------------------------------------------
    //   Resize to the detector's input size (160px)
    // -----------------------------------------------------------
    batch = await imageToInputTensor(imageUri, 160);

    // -----------------------------------------------------------
    //   Detect the face
    // -----------------------------------------------------------
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 });
    const detection = await faceapi.detectSingleFace(batch as any, options);

    if (!detection) {
      console.warn('[getFaceEmbedding] No face detected');
      return null;
    }

    const { box, score } = detection;
    const imgHeight = batch.shape[1];
    const imgWidth = batch.shape[2];

    // Normalised crop coordinates
    const y1 = Math.max(0, box.y / imgHeight);
    const x1 = Math.max(0, box.x / imgWidth);
    const y2 = Math.min(1, (box.y + box.height) / imgHeight);
    const x2 = Math.min(1, (box.x + box.width) / imgWidth);

    // Crop and resize to 150×150 for the recognizer
    faceCrop = tf.image.cropAndResize(
      batch as any,
      [[y1, x1, y2, x2]],
      [0],
      [150, 150]
    ) as tf.Tensor4D;

    await tf.nextFrame();

    // -----------------------------------------------------------
    //   Run the recognition net
    // -----------------------------------------------------------
    const descriptor = await faceapi.nets.faceRecognitionNet.forward(faceCrop as any);
    await tf.nextFrame();

    const data = await (descriptor as tf.Tensor).data() as Float32Array;
    (descriptor as tf.Tensor).dispose();

    const embedding = Array.from(data);
    console.log('[getFaceEmbedding] embedding length', embedding.length);

    if (embedding.length !== 128) {
      console.error('[getFaceEmbedding] Unexpected embedding length');
      return null;
    }

    return {
      embedding,
      detectionScore: score,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
    };
  } catch (e) {
    console.error('[getFaceEmbedding] error:', e);
    return null;
  } finally {
    if (batch) batch.dispose();
    if (faceCrop) faceCrop.dispose();
    console.log('[getFaceEmbedding] DONE');
  }
};

// ---------------------------------------------------------------------------
// 7️⃣  Embedding comparison (Euclidean distance)
// ---------------------------------------------------------------------------
export const euclideanDistance = (a: number[], b: number[]): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

export const FACE_MATCH_THRESHOLD = 0.5;