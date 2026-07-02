import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../services/api';
import PageHeader from '../components/layout/PageHeader';
import FormCard from '../components/common/FormCard';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import ImageUploader from '../components/common/ImageUploader';
import GenderSelector from '../components/common/GenderSelector';
import TwinSelector from '../components/common/TwinSelector';
import TermSelector from '../components/common/TermSelector';
import ModalWrapper from '../components/common/ModalWrapper';

// Zod schema based on requirements
const newBabySchema = z.object({
  motherName: z.string().min(2, 'Mother Name must be at least 2 characters'),
  motherAge: z.preprocess((val) => Number(val), z.number().min(18, 'Minimum age is 18').max(60, 'Maximum age is 60')) as z.ZodType<number, any, any>,
  dob: z.string().min(1, 'Date of Birth is required'),
  termStatus: z.enum(['Term', 'Preterm']),
  isTwin: z.boolean(),
  
  // Single baby fields
  weight: z.preprocess((val) => val === '' ? undefined : Number(val), z.number().min(0.5).max(5000).optional()) as z.ZodType<number | undefined, any, any>,
  gender: z.enum(['Male', 'Female']).optional(),
  skinForehead: z.preprocess((val) => val === '' ? undefined : Number(val), z.number().min(1, 'Minimum 1').optional()) as z.ZodType<number | undefined, any, any>,
  skinSternum: z.preprocess((val) => val === '' ? undefined : Number(val), z.number().min(1, 'Minimum 1').optional()) as z.ZodType<number | undefined, any, any>,
  gestationalAgeWeeks: z.preprocess((val) => val === '' ? undefined : Number(val), z.number().max(42, 'Max 42W').optional()) as z.ZodType<number | undefined, any, any>,
  gestationalAgeDays: z.preprocess((val) => val === '' ? undefined : Number(val), z.number().min(0).max(6).optional()) as z.ZodType<number | undefined, any, any>,
  
  // Twin fields
  weightA: z.preprocess((val) => val === '' ? undefined : Number(val), z.number().min(0.5).max(5000).optional()) as z.ZodType<number | undefined, any, any>,
  genderA: z.enum(['Male', 'Female']).optional(),
  skinForeheadA: z.preprocess((val) => val === '' ? undefined : Number(val), z.number().min(1, 'Minimum 1').optional()) as z.ZodType<number | undefined, any, any>,
  skinSternumA: z.preprocess((val) => val === '' ? undefined : Number(val), z.number().min(1, 'Minimum 1').optional()) as z.ZodType<number | undefined, any, any>,
  weightB: z.preprocess((val) => val === '' ? undefined : Number(val), z.number().min(0.5).max(5000).optional()) as z.ZodType<number | undefined, any, any>,
  genderB: z.enum(['Male', 'Female']).optional(),
  skinForeheadB: z.preprocess((val) => val === '' ? undefined : Number(val), z.number().min(1, 'Minimum 1').optional()) as z.ZodType<number | undefined, any, any>,
  skinSternumB: z.preprocess((val) => val === '' ? undefined : Number(val), z.number().min(1, 'Minimum 1').optional()) as z.ZodType<number | undefined, any, any>,
}).superRefine((data, ctx) => {
  const checkWeight = (w: number | undefined, path: string) => {
    if (w === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: [path] });
      return;
    }
    const finalW = w < 15 ? w * 1000 : w;
    if (finalW < 500 || finalW > 5000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be 500g - 5000g', path: [path] });
    }
  };

  if (!data.isTwin) {
    checkWeight(data.weight, 'weight');
    if (!data.gender) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['gender'] });
    if (!data.gestationalAgeWeeks) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['gestationalAgeWeeks'] });
  } else {
    checkWeight(data.weightA, 'weightA');
    if (!data.genderA) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['genderA'] });
    
    checkWeight(data.weightB, 'weightB');
    if (!data.genderB) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['genderB'] });
    if (!data.gestationalAgeWeeks) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['gestationalAgeWeeks'] });
  }
});

type NewBabyFormValues = z.infer<typeof newBabySchema>;

const NewBaby: React.FC = () => {
  const navigate = useNavigate();
  const [motherImage, setMotherImage] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [conflictBabies, setConflictBabies] = useState<any[] | null>(null);


  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<NewBabyFormValues>({
    resolver: zodResolver(newBabySchema),
    defaultValues: {
      isTwin: false,
      termStatus: 'Term',
    }
  });

  const isTwin = watch('isTwin');

  const createBabyMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await api.post('/babies', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      navigate('/dashboard');
    },
    onError: (error: any) => {
      console.error('[NewBaby] API Error:', error);
      console.error('[NewBaby] Status:', error.response?.status);
      console.error('[NewBaby] Data:', error.response?.data);
      if (error.response?.status === 409 && error.response?.data?.code === 'DUPLICATE_BABY') {
        setConflictBabies(error.response.data.existingBabies);
      } else {
        setErrorMsg(error.response?.data?.message || 'Failed to register baby');
      }
    }
  });

  const onSubmit = (data: NewBabyFormValues, forceSave: boolean = false) => {
    setErrorMsg('');
    const formData = new FormData();
    
    if (forceSave) {
      formData.append('forceSave', 'true');
    }
    
    // Append standard fields
    formData.append('motherName', data.motherName);
    formData.append('motherAge', data.motherAge.toString());
    formData.append('isTwin', data.isTwin.toString());
    formData.append('dob', data.dob);
    formData.append('termStatus', data.termStatus);
    
    if (data.gestationalAgeWeeks) {
      let ga = `${data.gestationalAgeWeeks}W`;
      if (data.gestationalAgeDays) {
        ga += `+${data.gestationalAgeDays}D`;
      }
      formData.append('gestationalAge', ga);
    }
    
    const normalizeWeight = (w: number | undefined) => w !== undefined ? (w < 15 ? Math.round(w * 1000) : w) : 0;

    // Append conditional fields
    if (!data.isTwin) {
      const w = normalizeWeight(data.weight);
      if (w > 0) formData.append('weight', w.toString());
      if (data.gender) formData.append('gender', data.gender);
      if (data.skinForehead) formData.append('skinForehead', data.skinForehead.toString());
      if (data.skinSternum) formData.append('skinSternum', data.skinSternum.toString());
    } else {
      const wa = normalizeWeight(data.weightA);
      if (wa > 0) formData.append('weightA', wa.toString());
      if (data.genderA) formData.append('genderA', data.genderA);
      if (data.skinForeheadA) formData.append('skinForeheadA', data.skinForeheadA.toString());
      if (data.skinSternumA) formData.append('skinSternumA', data.skinSternumA.toString());
      
      const wb = normalizeWeight(data.weightB);
      if (wb > 0) formData.append('weightB', wb.toString());
      if (data.genderB) formData.append('genderB', data.genderB);
      if (data.skinForeheadB) formData.append('skinForeheadB', data.skinForeheadB.toString());
      if (data.skinSternumB) formData.append('skinSternumB', data.skinSternumB.toString());
    }

    // Append image if exists
    if (motherImage) {
      formData.append('motherImage', motherImage);
    }

    createBabyMutation.mutate(formData);
  };

  const handleAddAnyway = () => {
    setConflictBabies(null);
    handleSubmit((data) => onSubmit(data as any, true))();
  };

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <PageHeader 
        title="Register New Baby" 
        description="Fill in the required information to register a new baby or twins."
        showBack
      />

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit((data) => onSubmit(data as any, false))} className="space-y-6">
        
        {/* MOTHER INFO CARD */}
        <FormCard title="Mother's Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Mother's Full Name"
              type="text"
              placeholder="e.g. Riya Sharma"
              {...register('motherName')}
              error={errors.motherName?.message}
            />
            <Input
              label="Mother's Age"
              type="number"
              placeholder="e.g. 28"
              {...register('motherAge')}
              error={errors.motherAge?.message as string}
            />
          </div>
          
          <div className="mt-6">
            <ImageUploader
              label="Mother's Photo (Optional)"
              onChange={setMotherImage}
            />
          </div>
        </FormCard>

        {/* BABY CONFIG CARD */}
        <FormCard title="Baby Configuration">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Controller
              name="isTwin"
              control={control}
              render={({ field }) => (
                <TwinSelector
                  label="Are they twins?"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Gestational Age (Weeks)"
                type="number"
                placeholder="e.g. 36"
                step="any"
                {...register('gestationalAgeWeeks')}
                error={errors.gestationalAgeWeeks?.message as string}
              />
              <Input
                label="Days (Optional)"
                type="number"
                placeholder="0-6"
                step="any"
                {...register('gestationalAgeDays')}
                error={errors.gestationalAgeDays?.message as string}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Date of Birth"
                type="date"
                max={new Date().toISOString().split('T')[0]}
                {...register('dob')}
                error={errors.dob?.message}
              />
              <Controller
                name="termStatus"
                control={control}
                render={({ field }) => (
                  <TermSelector
                    label="Term Status"
                    value={field.value || 'Term'}
                    onChange={field.onChange}
                    error={errors.termStatus?.message}
                  />
                )}
              />
            </div>
          </div>

          {!isTwin ? (
            // SINGLE BABY
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 border border-slate-100 rounded-xl">
              <Input
                label="Weight"
                type="number"
                step="any"
                placeholder="e.g. 2.5 or 2500"
                {...register('weight')}
                error={errors.weight?.message as string}
              />
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <GenderSelector
                    label="Gender"
                    value={field.value || ''}
                    onChange={field.onChange}
                    error={errors.gender?.message}
                  />
                )}
              />
              <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
                <Input
                  label="Skin Forehead"
                  type="number"
                  min="1"
                  placeholder="e.g. 1"
                  {...register('skinForehead')}
                  error={errors.skinForehead?.message as string}
                />
                <Input
                  label="Skin Sternum"
                  type="number"
                  min="1"
                  placeholder="e.g. 1"
                  {...register('skinSternum')}
                  error={errors.skinSternum?.message as string}
                />
              </div>
            </div>
          ) : (
            // TWINS
            <div className="space-y-6">
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                <h4 className="text-sm font-semibold text-purple-800 mb-4 uppercase tracking-wider">Twin 1</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Weight"
                    type="number"
                    step="any"
                    placeholder="e.g. 2.5 or 2500"
                    {...register('weightA')}
                    error={errors.weightA?.message as string}
                  />
                  <Controller
                    name="genderA"
                    control={control}
                    render={({ field }) => (
                      <GenderSelector
                        label="Gender"
                        value={field.value || ''}
                        onChange={field.onChange}
                        error={errors.genderA?.message}
                      />
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
                    <Input
                      label="Skin Forehead"
                      type="number"
                      min="1"
                      placeholder="e.g. 1"
                      {...register('skinForeheadA')}
                      error={errors.skinForeheadA?.message as string}
                    />
                    <Input
                      label="Skin Sternum"
                      type="number"
                      min="1"
                      placeholder="e.g. 1"
                      {...register('skinSternumA')}
                      error={errors.skinSternumA?.message as string}
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                <h4 className="text-sm font-semibold text-purple-800 mb-4 uppercase tracking-wider">Twin 2</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Weight"
                    type="number"
                    step="any"
                    placeholder="e.g. 2.5 or 2500"
                    {...register('weightB')}
                    error={errors.weightB?.message as string}
                  />
                  <Controller
                    name="genderB"
                    control={control}
                    render={({ field }) => (
                      <GenderSelector
                        label="Gender"
                        value={field.value || ''}
                        onChange={field.onChange}
                        error={errors.genderB?.message}
                      />
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
                    <Input
                      label="Skin Forehead"
                      type="number"
                      min="1"
                      placeholder="e.g. 1"
                      {...register('skinForeheadB')}
                      error={errors.skinForeheadB?.message as string}
                    />
                    <Input
                      label="Skin Sternum"
                      type="number"
                      min="1"
                      placeholder="e.g. 1"
                      {...register('skinSternumB')}
                      error={errors.skinSternumB?.message as string}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </FormCard>

        {/* SUBMIT */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/dashboard')}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createBabyMutation.isPending}
              className="flex-1"
            >
              Register Baby
            </Button>
          </div>
        </form>

        <ModalWrapper
          isOpen={!!conflictBabies}
          onClose={() => setConflictBabies(null)}
          title="Similar Babies Found"
        >
          {conflictBabies && (
            <div className="flex flex-col items-center text-center space-y-4 max-h-[80vh]">
              <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-sm w-full border border-amber-200">
                The following babies match the Mother Name, Gender, Weight, and Gestational Age:
              </div>
              
              <div className="w-full overflow-y-auto max-h-[40vh] space-y-3">
                {conflictBabies.map((baby, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-white border rounded-xl">
                    {baby.motherImage ? (
                      <img src={baby.motherImage} alt="Mother" className="w-16 h-16 rounded-full object-cover shadow-sm" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center shadow-sm">
                        <span className="text-xl text-slate-400 font-bold">{baby.motherName.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="text-left flex-1">
                      <h4 className="text-md font-bold text-slate-800">{baby.motherName}</h4>
                      <p className="text-slate-500 text-sm font-medium">{baby.displayId}</p>
                    </div>
                    <Button 
                      variant="secondary" 
                      onClick={() => navigate(`/babies/${baby._id}`)}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 w-full mt-6">
                <Button 
                  variant="secondary" 
                  className="flex-1"
                  onClick={() => setConflictBabies(null)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleAddAnyway}
                >
                  Add Anyway
                </Button>
              </div>
            </div>
          )}
        </ModalWrapper>
      </div>
  );
};

export default NewBaby;
