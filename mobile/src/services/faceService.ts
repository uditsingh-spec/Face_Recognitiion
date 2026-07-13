// src/services/faceService.ts
// Offline on-device face recognition using TensorFlow.js + face-api.js
// Runs 100% locally — no internet or backend call required.
//
// ARCHITECTURE NOTE — React Native environment compatibility:
//
// @vladmandic/face-api calls getEnv() in several places to get Canvas/Image/Video
// references. In React Native, getEnv() throws because the lib can't detect the
// environment (neither pure browser nor Node.js).
//
// Fix: call faceapi.env.setEnv(dummyRNEnv) once at startup. The dummy env
// provides empty stub classes for Canvas/Image/Video. Since our inference path
// uses tf.Tensor4D (not HTML elements), all the env.Canvas instanceof checks
// evaluate to false and the canvas path is never entered.
//
// After setEnv, we call net.forward(tensor4D) directly. The internal path:
//   forward(tensor4D) → F(tensor4D) → toNetInput → NetInput([tensor4D])
//   → toBatchTensor → "s instanceof tf.Tensor" branch → resizeBilinear
//   → forwardInput → ResNet → 128-d descriptor
// No canvas, no getEnv crash.

import '@tensorflow/tfjs-react-native';
import * as tf from '@tensorflow/tfjs';
import * as faceapi from '@vladmandic/face-api';
import RNFS from 'react-native-fs';
import { toByteArray as base64Decode } from 'base64-js';
import { Asset } from 'expo-asset';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import * as ImageManipulator from 'expo-image-manipulator';

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

const MODEL_ASSETS = {
  recognitionManifest: require('../../assets/models/face_recognition_model-weights_manifest.json'),
  recognitionBin: require('../../assets/models/face_recognition_model.bin'),
  detectorManifest: require('../../assets/models/tiny_face_detector_model-weights_manifest.json'),
  detectorBin: require('../../assets/models/tiny_face_detector_model.bin'),
  landmarkManifest: require('../../assets/models/face_landmark_68_tiny_model-weights_manifest.json'),
  landmarkBin: require('../../assets/models/face_landmark_68_tiny_model.bin'),
};

/**
 * Patch face-api's environment detection so that getEnv() doesn't throw in RN.
 * We provide stub classes for Canvas/Image/Video. The actual inference never
 * reaches canvas code paths when input is a tf.Tensor4D.
 */
const patchFaceApiEnv = () => {
  class StubCanvas { width = 0; height = 0; getContext() { return null; } }
  class StubImage {}
  class StubVideo {}
  class StubImageData {}

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

const loadModelWeights = async (manifestAsset: any, binAsset: any, net: any) => {
  const manifest = manifestAsset;
  const weightSpecs = Array.isArray(manifest)
    ? manifest[0].weights
    : manifest.weightsManifest[0].weights;

  const asset = Asset.fromModule(binAsset);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;

  const fsPath = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
  const base64 = await RNFS.readFile(fsPath, 'base64');
  const weightData = base64Decode(base64).buffer;
  const weightMap = await tf.io.decodeWeights(weightData as ArrayBuffer, weightSpecs);
  await net.loadFromWeightMap(weightMap);
};

const loadAllModels = async () => {
  console.log('[faceService] loading models...');
  
  await Promise.all([
    loadModelWeights(MODEL_ASSETS.recognitionManifest, MODEL_ASSETS.recognitionBin, faceapi.nets.faceRecognitionNet),
    loadModelWeights(MODEL_ASSETS.detectorManifest, MODEL_ASSETS.detectorBin, faceapi.nets.tinyFaceDetector),
    loadModelWeights(MODEL_ASSETS.landmarkManifest, MODEL_ASSETS.landmarkBin, faceapi.nets.faceLandmark68TinyNet)
  ]);

  console.log('[faceService] all models loaded successfully.');
};

export const initFaceService = async (): Promise<void> => {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      await tf.setBackend('rn-webgl');
      await tf.ready();
      console.log('[faceService] TF backend:', tf.getBackend());

      // Patch the environment BEFORE any face-api call that uses getEnv()
      patchFaceApiEnv();

      await loadAllModels();
      await tf.nextFrame();

      console.log('[faceService] running warm-up inference to compile WebGL shaders...');
      const dummyDetectorInput = tf.zeros([1, 160, 160, 3]) as tf.Tensor4D;
      const warmupOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 });
      await faceapi.detectSingleFace(dummyDetectorInput as any, warmupOptions);
      dummyDetectorInput.dispose();

      const dummyRecognitionInput = tf.zeros([1, 150, 150, 3]) as tf.Tensor4D;
      const dummyDescriptor = await faceapi.nets.faceRecognitionNet.forward(dummyRecognitionInput as any);
      if (dummyDescriptor) (dummyDescriptor as tf.Tensor).dispose();
      dummyRecognitionInput.dispose();
      console.log('[faceService] warm-up complete');

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
// Image preprocessing
// Resize to 150×150 — the recognition net's native input size.
// Values kept in [0, 255] float32; the net normalises internally.
// ---------------------------------------------------------------------------
const imageToInputTensor = async (imageUri: string, targetWidth: number = 400): Promise<tf.Tensor4D> => {
  console.log('[faceService] imageToInputTensor: start');
  await tf.nextFrame();

  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: targetWidth } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  if (!result.base64) throw new Error('ImageManipulator returned no base64 data');
  console.log('[faceService] imageToInputTensor: base64 length', result.base64.length);

  await tf.nextFrame();

  const raw = base64Decode(result.base64);
  const decoded = decodeJpeg(raw);              // [H, W, 3] int32
  const float32 = tf.cast(decoded, 'float32'); // [H, W, 3] float32 in [0, 255]
  decoded.dispose();

  // Add batch dim → [1, H, W, 3]
  const batch = float32.expandDims(0) as tf.Tensor4D;
  float32.dispose();

  await tf.nextFrame();
  console.log('[faceService] imageToInputTensor: shape', batch.shape, 'dtype', batch.dtype);
  return batch;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FaceScanResult {
  embedding: number[];
  detectionScore: number;
  box: { x: number; y: number; width: number; height: number };
}

/**
 * Generates a 128-d face embedding.
 *
 * It first uses tinyFaceDetector to find a face. If found, it crops the
 * tensor using tf.image.cropAndResize and passes the face crop to the
 * recognition net. This prevents earbuds/non-faces from being scanned.
 */
export const getFaceEmbedding = async (imageUri: string): Promise<FaceScanResult | null> => {
  console.log('[getFaceEmbedding] START uri:', imageUri);

  if (!modelsLoaded) {
    console.log('[getFaceEmbedding] initializing...');
    await initFaceService();
  }

  let batch: tf.Tensor4D | null = null;
  let faceCrop: tf.Tensor4D | null = null;
  
  try {
    batch = await imageToInputTensor(imageUri, 160); // 160 width for faster detection

    console.log('[getFaceEmbedding] detecting face...');
    const t0 = Date.now();
    await tf.nextFrame();

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 });
    const detection = await faceapi.detectSingleFace(batch as any, options);
    
    console.log('[getFaceEmbedding] detection done in', Date.now() - t0, 'ms:', !!detection);

    if (!detection) {
      console.warn('[getFaceEmbedding] No face detected in the image.');
      return null;
    }

    const { box, score } = detection;
    
    // Crop the face tensor and resize it to 150x150 for the recognition model
    const [_, imgHeight, imgWidth] = batch.shape;
    
    // Compute normalized coordinates for cropAndResize [y1, x1, y2, x2]
    const y1 = Math.max(0, box.y / imgHeight);
    const x1 = Math.max(0, box.x / imgWidth);
    const y2 = Math.min(1, (box.y + box.height) / imgHeight);
    const x2 = Math.min(1, (box.x + box.width) / imgWidth);
    
    faceCrop = tf.image.cropAndResize(
      batch as any, 
      [[y1, x1, y2, x2]], 
      [0], 
      [150, 150]
    ) as tf.Tensor4D;

    await tf.nextFrame();

    console.log('[getFaceEmbedding] calling faceRecognitionNet.forward() ...');
    const t1 = Date.now();
    const descriptor = await faceapi.nets.faceRecognitionNet.forward(faceCrop as any);
    await tf.nextFrame();
    console.log('[getFaceEmbedding] forward() done in', Date.now() - t1, 'ms');

    if (!descriptor) {
      console.warn('[getFaceEmbedding] forward() returned null');
      return null;
    }

    const data = await (descriptor as tf.Tensor).data() as Float32Array;
    (descriptor as tf.Tensor).dispose();

    const embedding = Array.from(data);
    console.log('[getFaceEmbedding] embedding length:', embedding.length,
      '| min:', Math.min(...embedding).toFixed(3),
      '| max:', Math.max(...embedding).toFixed(3));

    if (embedding.length !== 128) {
      console.error('[getFaceEmbedding] unexpected embedding length:', embedding.length);
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

/**
 * Euclidean distance between two 128-d embeddings.
 * Lower = more similar. Threshold widened to 0.75 (no alignment step).
 */
export const compareFaceEmbeddings = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return Infinity;
  let sumSq = 0;
  for (let i = 0; i < a.length; i++) sumSq += (a[i] - b[i]) ** 2;
  return Math.sqrt(sumSq);
};

export const FACE_MATCH_THRESHOLD = 0.4;
