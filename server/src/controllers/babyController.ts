import { Request, Response, NextFunction } from 'express';
import Baby from '../models/Baby';
import { babySchema, updateBabySchema } from '../validators/babyValidators';
import { createSampleSchema } from '../validators/sampleValidators';
import { generateDisplayId, generateBaseId } from '../utils/babyUtils';
import Sample from '../models/Sample';
import DailyObservation from '../models/DailyObservation';
import { calculateObservationDayAndShift } from '../services/observationService';
import { uploadImage } from '../config/cloudinary';

export const createBaby = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  console.log('\n\n====== LOCAL SERVER HIT: createBaby ======');
  console.log('motherName:', req.body.motherName);
  console.log('gestationalAge:', req.body.gestationalAge);
  console.log('weight:', req.body.weight);
  console.log('gender:', req.body.gender);
  console.log('forceSave:', req.body.forceSave);
  console.log('==========================================\n');
  try {
    // Parse body data, especially handling booleans which come as strings in multipart form data
    const payload = {
      ...req.body,
      isTwin: req.body.isTwin === 'true' || req.body.isTwin === true,
      motherAge: Number(req.body.motherAge),
      weight: req.body.weight ? Number(req.body.weight) : undefined,
      weightA: req.body.weightA ? Number(req.body.weightA) : undefined,
      weightB: req.body.weightB ? Number(req.body.weightB) : undefined,
      skinForehead: req.body.skinForehead ? Number(req.body.skinForehead) : undefined,
      skinSternum: req.body.skinSternum ? Number(req.body.skinSternum) : undefined,
      skinForeheadA: req.body.skinForeheadA ? Number(req.body.skinForeheadA) : undefined,
      skinSternumA: req.body.skinSternumA ? Number(req.body.skinSternumA) : undefined,
      skinForeheadB: req.body.skinForeheadB ? Number(req.body.skinForeheadB) : undefined,
      skinSternumB: req.body.skinSternumB ? Number(req.body.skinSternumB) : undefined,
    };

    const validatedData = babySchema.parse(payload);

    let motherImageUrl = '';
    if (req.file) {
      try {
        motherImageUrl = await uploadImage(req.file.buffer, req.file.mimetype);
      } catch (uploadError) {
        res.status(400).json({ message: 'Image upload failed. Please check your Cloudinary credentials or network connection.' });
        return;
      }
    }

    const forceSave = req.body.forceSave === 'true' || req.body.forceSave === true;

    if (validatedData.isTwin) {
      if (!validatedData.genderA || !validatedData.genderB || !validatedData.gestationalAge) {
        res.status(400).json({ message: 'Missing required fields for twins' });
        return;
      }

      const baseIdA = generateBaseId(validatedData.motherName, validatedData.weightA, validatedData.genderA, validatedData.gestationalAge);
      const baseIdB = generateBaseId(validatedData.motherName, validatedData.weightB, validatedData.genderB, validatedData.gestationalAge);
      const forceSave = req.body.forceSave === 'true' || req.body.forceSave === true;

      if (!forceSave) {
        const existingBabies = await Baby.find({
          $or: [
            { displayId: new RegExp(`^${baseIdA}`) },
            { displayId: new RegExp(`^${baseIdB}`) }
          ]
        }).sort({ registeredAt: -1 });

        if (existingBabies.length > 0) {
          res.status(409).json({
            message: 'Similar baby ID found',
            code: 'DUPLICATE_BABY',
            existingBabies
          });
          return;
        }
      }

      const displayIdA = await generateDisplayId(
        validatedData.motherName,
        validatedData.weightA,
        validatedData.genderA,
        validatedData.gestationalAge
      );
      
      const displayIdB = await generateDisplayId(
        validatedData.motherName,
        validatedData.weightB,
        validatedData.genderB,
        validatedData.gestationalAge
      );

      const formatTwinId = (id: string, num: number) => {
        return `${id}-T${num}`;
      };

      const finalDisplayIdA = formatTwinId(displayIdA, 1);
      const finalDisplayIdB = formatTwinId(displayIdB, 2);

      const babyA = await Baby.create({
        displayId: finalDisplayIdA,
        motherName: validatedData.motherName,
        motherImage: motherImageUrl,
        motherAge: validatedData.motherAge,
        gender: validatedData.genderA,
        weight: validatedData.weightA,
        gestationalAge: validatedData.gestationalAge,
        termStatus: validatedData.termStatus,
        skinForehead: validatedData.skinForeheadA,
        skinSternum: validatedData.skinSternumA,
        dob: validatedData.dob,
        isTwin: true,
        twinLabel: '1',
        createdBy: req.user._id,
      });

      const babyB = await Baby.create({
        displayId: finalDisplayIdB,
        motherName: validatedData.motherName,
        motherImage: motherImageUrl,
        motherAge: validatedData.motherAge,
        gender: validatedData.genderB,
        weight: validatedData.weightB,
        gestationalAge: validatedData.gestationalAge,
        termStatus: validatedData.termStatus,
        skinForehead: validatedData.skinForeheadB,
        skinSternum: validatedData.skinSternumB,
        dob: validatedData.dob,
        isTwin: true,
        twinLabel: '2',
        createdBy: req.user._id,
      });

      res.status(201).json([babyA, babyB]);
    } else {
      if (!validatedData.gender || !validatedData.gestationalAge) {
        res.status(400).json({ message: 'Missing required fields for single baby' });
        return;
      }

      // Single Baby Logic
      const baseId = generateBaseId(validatedData.motherName, validatedData.weight, validatedData.gender, validatedData.gestationalAge);
      
      const forceSave = req.body.forceSave === 'true' || req.body.forceSave === true;

      if (!forceSave) {
        const existingBabies = await Baby.find({ displayId: { $regex: `^${baseId}` } }).sort({ registeredAt: -1 });
        
        if (existingBabies.length > 0) {
          res.status(409).json({
            message: 'Similar baby ID found',
            code: 'DUPLICATE_BABY',
            existingBabies
          });
          return;
        }
      }

      const displayId = await generateDisplayId(
        validatedData.motherName,
        validatedData.weight,
        validatedData.gender,
        validatedData.gestationalAge
      );

      const baby = await Baby.create({
        displayId,
        motherName: validatedData.motherName,
        motherImage: motherImageUrl,
        motherAge: validatedData.motherAge,
        gender: validatedData.gender,
        weight: validatedData.weight,
        gestationalAge: validatedData.gestationalAge,
        termStatus: validatedData.termStatus,
        skinForehead: validatedData.skinForehead,
        skinSternum: validatedData.skinSternum,
        dob: validatedData.dob,
        isTwin: false,
        createdBy: req.user._id,
      });

      res.status(201).json(baby);
    }
  } catch (error) {
    next(error);
  }
};

export const getBabies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search, gender, isTwin, sort } = req.query;

    let query: any = {};

    // Search by motherName or displayId
    if (search) {
      query.$or = [
        { motherName: { $regex: search, $options: 'i' } },
        { displayId: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by gender
    if (gender) {
      // Support comma separated genders if needed, else exact match
      const genders = (gender as string).split(',');
      query.gender = { $in: genders };
    }

    // Filter by twin
    if (isTwin === 'true') {
      query.isTwin = true;
    } else if (isTwin === 'false') {
      query.isTwin = false;
    }

    // Sort options
    let sortOption: any = { registeredAt: -1 }; // Default: Latest
    if (sort === 'oldest') {
      sortOption = { registeredAt: 1 };
    }

    const babies = await Baby.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() for performance as requested

    const total = await Baby.countDocuments(query);

    res.json({
      data: babies,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export const getBabyById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const baby = await Baby.findById(req.params.id)
      .populate('createdBy', 'name employeeId')
      .lean();
    if (baby) {
      res.json(baby);
    } else {
      res.status(404).json({ message: 'Baby not found' });
    }
  } catch (error) {
    next(error);
  }
};

export const deleteBaby = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const baby = await Baby.findById(req.params.id);
    if (!baby) {
      res.status(404).json({ message: 'Baby not found' });
      return;
    }

    // Delete all samples for this baby
    await Sample.deleteMany({ babyId: baby._id });
    
    // Delete all daily observations for this baby
    await DailyObservation.deleteMany({ babyId: baby._id });

    // Delete the baby
    await baby.deleteOne();
    
    res.json({ message: 'Baby removed successfully' });
  } catch (error) {
    next(error);
  }
};

export const createSample = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = createSampleSchema.parse(req.body);

    const baby = await Baby.findById(req.params.id);
    if (!baby) {
      res.status(404).json({ message: 'Baby not found' });
      return;
    }

    const sample = await Sample.create({
      babyId: req.params.id as any,
      weight: validatedData.weight,
      jm103_s: validatedData.jm103_s,
      tsb: validatedData.tsb,
      mbj20_f: validatedData.mbj20_f,
      mbj20_s: validatedData.mbj20_s,
      f1_d4_f: validatedData.f1_d4_f, f2_d4_f: validatedData.f2_d4_f, f3_d4_f: validatedData.f3_d4_f, f4_d4_f: validatedData.f4_d4_f, f5_d4_f: validatedData.f5_d4_f,
      f6_d4_f: validatedData.f6_d4_f, f7_d4_f: validatedData.f7_d4_f, f8_d4_f: validatedData.f8_d4_f, f9_d4_f: validatedData.f9_d4_f, f10_d4_f: validatedData.f10_d4_f,
      f1_d4_s: validatedData.f1_d4_s, f2_d4_s: validatedData.f2_d4_s, f3_d4_s: validatedData.f3_d4_s, f4_d4_s: validatedData.f4_d4_s, f5_d4_s: validatedData.f5_d4_s,
      f6_d4_s: validatedData.f6_d4_s, f7_d4_s: validatedData.f7_d4_s, f8_d4_s: validatedData.f8_d4_s, f9_d4_s: validatedData.f9_d4_s, f10_d4_s: validatedData.f10_d4_s,
      f1_d6_f: validatedData.f1_d6_f, f2_d6_f: validatedData.f2_d6_f, f3_d6_f: validatedData.f3_d6_f, f4_d6_f: validatedData.f4_d6_f, f5_d6_f: validatedData.f5_d6_f,
      f6_d6_f: validatedData.f6_d6_f, f7_d6_f: validatedData.f7_d6_f, f8_d6_f: validatedData.f8_d6_f, f9_d6_f: validatedData.f9_d6_f, f10_d6_f: validatedData.f10_d6_f,
      f1_d6_s: validatedData.f1_d6_s, f2_d6_s: validatedData.f2_d6_s, f3_d6_s: validatedData.f3_d6_s, f4_d6_s: validatedData.f4_d6_s, f5_d6_s: validatedData.f5_d6_s,
      f6_d6_s: validatedData.f6_d6_s, f7_d6_s: validatedData.f7_d6_s, f8_d6_s: validatedData.f8_d6_s, f9_d6_s: validatedData.f9_d6_s, f10_d6_s: validatedData.f10_d6_s,
      remarks: validatedData.remarks,
      createdBy: req.user._id,
    });

    const registrationDate = baby.registeredAt || (baby as any).createdAt || new Date();
    let { day, shift, serverTime } = calculateObservationDayAndShift(registrationDate);
    
    // Use provided day/shift if available, otherwise use calculated values
    if (validatedData.day !== undefined && validatedData.day !== null) {
      day = validatedData.day;
    }
    if (validatedData.shift !== undefined && validatedData.shift !== null) {
      shift = validatedData.shift as 'M' | 'E';
    }

    await DailyObservation.create({
      babyId: baby._id,
      sampleId: sample._id,
      day,
      shift,
      jm103_s: validatedData.jm103_s,
      tsb: validatedData.tsb,
      mbj20_f: validatedData.mbj20_f,
      mbj20_s: validatedData.mbj20_s,
      f1_d4_f: validatedData.f1_d4_f, f2_d4_f: validatedData.f2_d4_f, f3_d4_f: validatedData.f3_d4_f, f4_d4_f: validatedData.f4_d4_f, f5_d4_f: validatedData.f5_d4_f,
      f6_d4_f: validatedData.f6_d4_f, f7_d4_f: validatedData.f7_d4_f, f8_d4_f: validatedData.f8_d4_f, f9_d4_f: validatedData.f9_d4_f, f10_d4_f: validatedData.f10_d4_f,
      f1_d4_s: validatedData.f1_d4_s, f2_d4_s: validatedData.f2_d4_s, f3_d4_s: validatedData.f3_d4_s, f4_d4_s: validatedData.f4_d4_s, f5_d4_s: validatedData.f5_d4_s,
      f6_d4_s: validatedData.f6_d4_s, f7_d4_s: validatedData.f7_d4_s, f8_d4_s: validatedData.f8_d4_s, f9_d4_s: validatedData.f9_d4_s, f10_d4_s: validatedData.f10_d4_s,
      f1_d6_f: validatedData.f1_d6_f, f2_d6_f: validatedData.f2_d6_f, f3_d6_f: validatedData.f3_d6_f, f4_d6_f: validatedData.f4_d6_f, f5_d6_f: validatedData.f5_d6_f,
      f6_d6_f: validatedData.f6_d6_f, f7_d6_f: validatedData.f7_d6_f, f8_d6_f: validatedData.f8_d6_f, f9_d6_f: validatedData.f9_d6_f, f10_d6_f: validatedData.f10_d6_f,
      f1_d6_s: validatedData.f1_d6_s, f2_d6_s: validatedData.f2_d6_s, f3_d6_s: validatedData.f3_d6_s, f4_d6_s: validatedData.f4_d6_s, f5_d6_s: validatedData.f5_d6_s,
      f6_d6_s: validatedData.f6_d6_s, f7_d6_s: validatedData.f7_d6_s, f8_d6_s: validatedData.f8_d6_s, f9_d6_s: validatedData.f9_d6_s, f10_d6_s: validatedData.f10_d6_s,
      recordedBy: req.user._id,
      recordedAt: serverTime
    });

    res.status(201).json(sample);
  } catch (error) {
    next(error);
  }
};

export const getBabySamples = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const samples = await Sample.find({ babyId: req.params.id })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name employeeId')
      .lean();

    const formattedSamples = samples.map((sample, index) => {
      const dateObj = new Date(sample.createdAt);
      return {
        _id: sample._id,
        sampleNumber: samples.length - index,
        weight: sample.weight,
        mbj20_f: sample.mbj20_f,
        mbj20_s: sample.mbj20_s,
        jm103_s: sample.jm103_s,
        tsb: sample.tsb,
        f1_d4_f: sample.f1_d4_f, f2_d4_f: sample.f2_d4_f, f3_d4_f: sample.f3_d4_f, f4_d4_f: sample.f4_d4_f, f5_d4_f: sample.f5_d4_f,
        f6_d4_f: sample.f6_d4_f, f7_d4_f: sample.f7_d4_f, f8_d4_f: sample.f8_d4_f, f9_d4_f: sample.f9_d4_f, f10_d4_f: sample.f10_d4_f,
        f1_d4_s: sample.f1_d4_s, f2_d4_s: sample.f2_d4_s, f3_d4_s: sample.f3_d4_s, f4_d4_s: sample.f4_d4_s, f5_d4_s: sample.f5_d4_s,
        f6_d4_s: sample.f6_d4_s, f7_d4_s: sample.f7_d4_s, f8_d4_s: sample.f8_d4_s, f9_d4_s: sample.f9_d4_s, f10_d4_s: sample.f10_d4_s,
        f1_d6_f: sample.f1_d6_f, f2_d6_f: sample.f2_d6_f, f3_d6_f: sample.f3_d6_f, f4_d6_f: sample.f4_d6_f, f5_d6_f: sample.f5_d6_f,
        f6_d6_f: sample.f6_d6_f, f7_d6_f: sample.f7_d6_f, f8_d6_f: sample.f8_d6_f, f9_d6_f: sample.f9_d6_f, f10_d6_f: sample.f10_d6_f,
        f1_d6_s: sample.f1_d6_s, f2_d6_s: sample.f2_d6_s, f3_d6_s: sample.f3_d6_s, f4_d6_s: sample.f4_d6_s, f5_d6_s: sample.f5_d6_s,
        f6_d6_s: sample.f6_d6_s, f7_d6_s: sample.f7_d6_s, f8_d6_s: sample.f8_d6_s, f9_d6_s: sample.f9_d6_s, f10_d6_s: sample.f10_d6_s,
        remarks: sample.remarks,
        createdDate: dateObj.toLocaleDateString('en-GB').replace(/\//g, '-'),
        createdTime: dateObj.toLocaleTimeString(),
        createdBy: sample.createdBy,
      };
    });

    res.json(formattedSamples);
  } catch (error) {
    next(error);
  }
};

export const updateBaby = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = updateBabySchema.parse(req.body);

    const baby = await Baby.findById(req.params.id);
    if (!baby) {
      res.status(404).json({ message: 'Baby not found' });
      return;
    }

    // Update fields
    if (validatedData.motherName !== undefined) baby.motherName = validatedData.motherName;
    if (validatedData.motherAge !== undefined) baby.motherAge = validatedData.motherAge;
    if (validatedData.dob !== undefined) baby.dob = new Date(validatedData.dob as string);
    if (validatedData.weight !== undefined) baby.weight = validatedData.weight;
    if (validatedData.gender !== undefined) baby.gender = validatedData.gender;
    if (validatedData.gestationalAge !== undefined) baby.gestationalAge = validatedData.gestationalAge;
    if (validatedData.termStatus !== undefined) baby.termStatus = validatedData.termStatus;
    if (validatedData.skinForehead !== undefined) baby.skinForehead = validatedData.skinForehead;
    if (validatedData.skinSternum !== undefined) baby.skinSternum = validatedData.skinSternum;

    if (req.file) {
      try {
        const motherImageUrl = await uploadImage(req.file.buffer, req.file.mimetype);
        baby.motherImage = motherImageUrl;
      } catch (uploadError) {
        res.status(400).json({ message: 'Image upload failed. Please check your Cloudinary credentials or network connection.' });
        return;
      }
    }

    // Recalculate displayId
    let newDisplayId = await generateDisplayId(
      baby.motherName,
      baby.weight,
      baby.gender!,
      baby.gestationalAge!,
      baby._id.toString()
    );

    if (baby.isTwin && baby.twinLabel) {
      newDisplayId = `${newDisplayId}-T${baby.twinLabel}`;
    }

    baby.displayId = newDisplayId;
    await baby.save();

    res.json(baby);
  } catch (error) {
    next(error);
  }
};
