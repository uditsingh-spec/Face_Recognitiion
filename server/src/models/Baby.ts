import mongoose, { Document, Schema } from 'mongoose';

export interface IBaby extends Document {
  displayId: string;
  motherName: string;
  motherImage?: string;
  motherFaceEmbedding?: number[];
  motherAge: number;
  gender: 'Male' | 'Female';
  weight?: number;
  gestationalAge: string;
  termStatus: 'Term' | 'Preterm';
  skinForehead?: number;
  skinSternum?: number;
  dob?: Date;
  isTwin: boolean;
  twinLabel?: 'A' | 'B' | '1' | '2' | null;
  registeredAt: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const babySchema = new Schema<IBaby>(
  {
    displayId: { type: String, required: true, unique: true },
    motherName: { type: String, required: true },
    motherImage: { type: String },
    motherFaceEmbedding: { type: [Number], select: false },
    motherAge: { type: Number },
    gender: { type: String, enum: ['Male', 'Female'], required: true },
    weight: { type: Number },
    gestationalAge: { type: String, required: true },
    termStatus: { type: String, enum: ['Term', 'Preterm'], required: true, default: 'Term' },
    skinForehead: { type: Number, min: 1 },
    skinSternum: { type: Number, min: 1 },
    dob: { type: Date },
    isTwin: { type: Boolean, default: false },
    twinLabel: { type: String, enum: ['A', 'B', '1', '2', null], default: null },
    registeredAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

babySchema.index({ motherName: 1 });
babySchema.index({ registeredAt: -1 });

const Baby = mongoose.model<IBaby>('Baby', babySchema);
export default Baby;
