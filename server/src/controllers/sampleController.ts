import { Request, Response, NextFunction } from 'express';
import Sample from '../models/Sample';
import DailyObservation from '../models/DailyObservation';
import { updateSampleSchema } from '../validators/sampleValidators';

export const deleteSample = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sample = await Sample.findById(req.params.id);
    
    if (!sample) {
      const fs = require('fs');
      fs.appendFileSync('C:\\Users\\Lenovo\\.vscode\\Med_Data_Erp\\error.log', new Date().toISOString() + ' Error name: 404 | Error message: Sample not found | URL: ' + req.originalUrl + '\n');
      res.status(404).json({ message: 'Sample not found' });
      return;
    }

    await sample.deleteOne();
    await DailyObservation.deleteOne({ sampleId: sample._id });

    res.json({ message: 'Sample removed' });
  } catch (error) {
    next(error);
  }
};

export const updateSample = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = updateSampleSchema.parse(req.body);

    const sample = await Sample.findById(req.params.id);
    if (!sample) {
      const fs = require('fs');
      fs.appendFileSync('C:\\Users\\Lenovo\\.vscode\\Med_Data_Erp\\error.log', new Date().toISOString() + ' Error name: 404 | Error message: Sample not found | URL: ' + req.originalUrl + '\n');
      res.status(404).json({ message: 'Sample not found' });
      return;
    }

    if (validatedData.weight !== undefined) sample.weight = validatedData.weight;
    
    // For optional measurements, we want to allow unsetting them if explicitly passed as null/undefined in some cases,
    // but here we just update if they are provided in the payload.
    // If the frontend sends an empty string, our preprocess makes it undefined, but we should be able to clear fields.
    // To allow clearing, if a key is present in req.body but its validated value is undefined, we can unset it.
    if ('jm103_s' in req.body) sample.jm103_s = validatedData.jm103_s;
    if ('tsb' in req.body) sample.tsb = validatedData.tsb;
    if ('mbj20_f' in req.body) sample.mbj20_f = validatedData.mbj20_f;
    if ('mbj20_s' in req.body) sample.mbj20_s = validatedData.mbj20_s;
    if ('f1_d4_f' in req.body) sample.f1_d4_f = validatedData.f1_d4_f;
    if ('f2_d4_f' in req.body) sample.f2_d4_f = validatedData.f2_d4_f;
    if ('f3_d4_f' in req.body) sample.f3_d4_f = validatedData.f3_d4_f;
    if ('f4_d4_f' in req.body) sample.f4_d4_f = validatedData.f4_d4_f;
    if ('f5_d4_f' in req.body) sample.f5_d4_f = validatedData.f5_d4_f;
    if ('f6_d4_f' in req.body) sample.f6_d4_f = validatedData.f6_d4_f;
    if ('f7_d4_f' in req.body) sample.f7_d4_f = validatedData.f7_d4_f;
    if ('f8_d4_f' in req.body) sample.f8_d4_f = validatedData.f8_d4_f;
    if ('f9_d4_f' in req.body) sample.f9_d4_f = validatedData.f9_d4_f;
    if ('f10_d4_f' in req.body) sample.f10_d4_f = validatedData.f10_d4_f;
    if ('f1_d4_s' in req.body) sample.f1_d4_s = validatedData.f1_d4_s;
    if ('f2_d4_s' in req.body) sample.f2_d4_s = validatedData.f2_d4_s;
    if ('f3_d4_s' in req.body) sample.f3_d4_s = validatedData.f3_d4_s;
    if ('f4_d4_s' in req.body) sample.f4_d4_s = validatedData.f4_d4_s;
    if ('f5_d4_s' in req.body) sample.f5_d4_s = validatedData.f5_d4_s;
    if ('f6_d4_s' in req.body) sample.f6_d4_s = validatedData.f6_d4_s;
    if ('f7_d4_s' in req.body) sample.f7_d4_s = validatedData.f7_d4_s;
    if ('f8_d4_s' in req.body) sample.f8_d4_s = validatedData.f8_d4_s;
    if ('f9_d4_s' in req.body) sample.f9_d4_s = validatedData.f9_d4_s;
    if ('f10_d4_s' in req.body) sample.f10_d4_s = validatedData.f10_d4_s;
    if ('f1_d6_f' in req.body) sample.f1_d6_f = validatedData.f1_d6_f;
    if ('f2_d6_f' in req.body) sample.f2_d6_f = validatedData.f2_d6_f;
    if ('f3_d6_f' in req.body) sample.f3_d6_f = validatedData.f3_d6_f;
    if ('f4_d6_f' in req.body) sample.f4_d6_f = validatedData.f4_d6_f;
    if ('f5_d6_f' in req.body) sample.f5_d6_f = validatedData.f5_d6_f;
    if ('f6_d6_f' in req.body) sample.f6_d6_f = validatedData.f6_d6_f;
    if ('f7_d6_f' in req.body) sample.f7_d6_f = validatedData.f7_d6_f;
    if ('f8_d6_f' in req.body) sample.f8_d6_f = validatedData.f8_d6_f;
    if ('f9_d6_f' in req.body) sample.f9_d6_f = validatedData.f9_d6_f;
    if ('f10_d6_f' in req.body) sample.f10_d6_f = validatedData.f10_d6_f;
    if ('f1_d6_s' in req.body) sample.f1_d6_s = validatedData.f1_d6_s;
    if ('f2_d6_s' in req.body) sample.f2_d6_s = validatedData.f2_d6_s;
    if ('f3_d6_s' in req.body) sample.f3_d6_s = validatedData.f3_d6_s;
    if ('f4_d6_s' in req.body) sample.f4_d6_s = validatedData.f4_d6_s;
    if ('f5_d6_s' in req.body) sample.f5_d6_s = validatedData.f5_d6_s;
    if ('f6_d6_s' in req.body) sample.f6_d6_s = validatedData.f6_d6_s;
    if ('f7_d6_s' in req.body) sample.f7_d6_s = validatedData.f7_d6_s;
    if ('f8_d6_s' in req.body) sample.f8_d6_s = validatedData.f8_d6_s;
    if ('f9_d6_s' in req.body) sample.f9_d6_s = validatedData.f9_d6_s;
    if ('f10_d6_s' in req.body) sample.f10_d6_s = validatedData.f10_d6_s;
    if ('remarks' in req.body) sample.remarks = validatedData.remarks;

    await sample.save();

    // Observation update logic:
    const obs = await DailyObservation.findOne({ sampleId: sample._id });
    if (obs) {
      if ('jm103_s' in req.body) obs.jm103_s = validatedData.jm103_s;
      if ('tsb' in req.body) obs.tsb = validatedData.tsb;
      if ('mbj20_f' in req.body) obs.mbj20_f = validatedData.mbj20_f;
      if ('mbj20_s' in req.body) obs.mbj20_s = validatedData.mbj20_s;
      if ('f1_d4_f' in req.body) obs.f1_d4_f = validatedData.f1_d4_f;
      if ('f2_d4_f' in req.body) obs.f2_d4_f = validatedData.f2_d4_f;
      if ('f3_d4_f' in req.body) obs.f3_d4_f = validatedData.f3_d4_f;
      if ('f4_d4_f' in req.body) obs.f4_d4_f = validatedData.f4_d4_f;
      if ('f5_d4_f' in req.body) obs.f5_d4_f = validatedData.f5_d4_f;
      if ('f6_d4_f' in req.body) obs.f6_d4_f = validatedData.f6_d4_f;
      if ('f7_d4_f' in req.body) obs.f7_d4_f = validatedData.f7_d4_f;
      if ('f8_d4_f' in req.body) obs.f8_d4_f = validatedData.f8_d4_f;
      if ('f9_d4_f' in req.body) obs.f9_d4_f = validatedData.f9_d4_f;
      if ('f10_d4_f' in req.body) obs.f10_d4_f = validatedData.f10_d4_f;
      if ('f1_d4_s' in req.body) obs.f1_d4_s = validatedData.f1_d4_s;
      if ('f2_d4_s' in req.body) obs.f2_d4_s = validatedData.f2_d4_s;
      if ('f3_d4_s' in req.body) obs.f3_d4_s = validatedData.f3_d4_s;
      if ('f4_d4_s' in req.body) obs.f4_d4_s = validatedData.f4_d4_s;
      if ('f5_d4_s' in req.body) obs.f5_d4_s = validatedData.f5_d4_s;
      if ('f6_d4_s' in req.body) obs.f6_d4_s = validatedData.f6_d4_s;
      if ('f7_d4_s' in req.body) obs.f7_d4_s = validatedData.f7_d4_s;
      if ('f8_d4_s' in req.body) obs.f8_d4_s = validatedData.f8_d4_s;
      if ('f9_d4_s' in req.body) obs.f9_d4_s = validatedData.f9_d4_s;
      if ('f10_d4_s' in req.body) obs.f10_d4_s = validatedData.f10_d4_s;
      if ('f1_d6_f' in req.body) obs.f1_d6_f = validatedData.f1_d6_f;
      if ('f2_d6_f' in req.body) obs.f2_d6_f = validatedData.f2_d6_f;
      if ('f3_d6_f' in req.body) obs.f3_d6_f = validatedData.f3_d6_f;
      if ('f4_d6_f' in req.body) obs.f4_d6_f = validatedData.f4_d6_f;
      if ('f5_d6_f' in req.body) obs.f5_d6_f = validatedData.f5_d6_f;
      if ('f6_d6_f' in req.body) obs.f6_d6_f = validatedData.f6_d6_f;
      if ('f7_d6_f' in req.body) obs.f7_d6_f = validatedData.f7_d6_f;
      if ('f8_d6_f' in req.body) obs.f8_d6_f = validatedData.f8_d6_f;
      if ('f9_d6_f' in req.body) obs.f9_d6_f = validatedData.f9_d6_f;
      if ('f10_d6_f' in req.body) obs.f10_d6_f = validatedData.f10_d6_f;
      if ('f1_d6_s' in req.body) obs.f1_d6_s = validatedData.f1_d6_s;
      if ('f2_d6_s' in req.body) obs.f2_d6_s = validatedData.f2_d6_s;
      if ('f3_d6_s' in req.body) obs.f3_d6_s = validatedData.f3_d6_s;
      if ('f4_d6_s' in req.body) obs.f4_d6_s = validatedData.f4_d6_s;
      if ('f5_d6_s' in req.body) obs.f5_d6_s = validatedData.f5_d6_s;
      if ('f6_d6_s' in req.body) obs.f6_d6_s = validatedData.f6_d6_s;
      if ('f7_d6_s' in req.body) obs.f7_d6_s = validatedData.f7_d6_s;
      if ('f8_d6_s' in req.body) obs.f8_d6_s = validatedData.f8_d6_s;
      if ('f9_d6_s' in req.body) obs.f9_d6_s = validatedData.f9_d6_s;
      if ('f10_d6_s' in req.body) obs.f10_d6_s = validatedData.f10_d6_s;
      await obs.save();
    }

    res.json(sample);
  } catch (error) {
    next(error);
  }
};
