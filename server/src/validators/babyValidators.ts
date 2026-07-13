import { z } from 'zod';

export const babySchema = z.object({
  motherName: z.string().min(2, 'Mother Name must be at least 2 characters'),
  motherAge: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().min(18).max(60)).optional(),
  registeredAt: z.string().optional(),
  dob: z.string().min(1, 'Date of Birth is required'),
  
  isTwin: z.preprocess((val) => val === 'true' || val === true, z.boolean()),
  
  // Single baby fields
  weight: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().min(500).max(5000)).optional(),
  gender: z.enum(['Male', 'Female']).optional(),
  gestationalAge: z.string().regex(/^([0-3]?[0-9]|4[0-2])W([\-\+][0-6]D)?$/, 'Gestational Age must be valid (e.g. 36W or 36W+2D)').optional(),
  termStatus: z.enum(['Term', 'Preterm']),
  skinForehead: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().int().min(1)).optional(),
  skinSternum: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().int().min(1)).optional(),
  
  // Twin fields
  weightA: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().min(500).max(5000)).optional(),
  genderA: z.enum(['Male', 'Female']).optional(),
  skinForeheadA: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().int().min(1)).optional(),
  skinSternumA: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().int().min(1)).optional(),
  weightB: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().min(500).max(5000)).optional(),
  genderB: z.enum(['Male', 'Female']).optional(),
  skinForeheadB: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().int().min(1)).optional(),
  skinSternumB: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().int().min(1)).optional(),
}).refine(data => {
  if (data.isTwin) {
    return data.genderA && data.genderB && data.gestationalAge;
  } else {
    return data.gender && data.gestationalAge;
  }
}, { message: "Missing required fields for single or twin selection" });

export const updateBabySchema = z.object({
  motherName: z.string().min(2, 'Mother Name must be at least 2 characters').optional(),
  motherAge: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().min(18).max(60)).optional(),
  dob: z.string().min(1, 'Date of Birth is required').optional(),
  
  weight: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().min(500).max(5000)).optional(),
  gender: z.enum(['Male', 'Female']).optional(),
  gestationalAge: z.string().regex(/^([0-3]?[0-9]|4[0-2])W([\-\+][0-6]D)?$/, 'Gestational Age must be valid (e.g. 36W or 36W+2D)').optional(),
  termStatus: z.enum(['Term', 'Preterm']).optional(),
  skinForehead: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().int().min(1)).optional(),
  skinSternum: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().int().min(1)).optional(),
});
