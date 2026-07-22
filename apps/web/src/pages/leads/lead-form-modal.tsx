import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { useCreateLead } from '@/features/leads/hooks';
import { getApiErrorMessage } from '@/lib/api';

const leadSchema = z.object({
  companyName: z.string().min(2, 'Nome da empresa obrigatório'),
  segment: z.string().optional(),
  email: z.union([z.literal(''), z.string().email('E-mail inválido')]).optional(),
  phone: z.string().optional(),
  website: z.union([z.literal(''), z.string().url('URL inválida')]).optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

type LeadForm = z.infer<typeof leadSchema>;

export function LeadFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createLead = useCreateLead();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadForm>({ resolver: zodResolver(leadSchema) });

  const close = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = async (values: LeadForm) => {
    setServerError(null);
    try {
      await createLead.mutateAsync({
        companyName: values.companyName,
        segment: values.segment || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        website: values.website || undefined,
        city: values.city || undefined,
        country: values.country || undefined,
        notes: values.notes || undefined,
        tags: values.tags
          ? values.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : undefined,
      });
      close();
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  return (
    <Modal open={open} onClose={close} title="Novo lead" className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nome da empresa *"
            error={errors.companyName?.message}
            {...register('companyName')}
          />
          <Input label="Segmento" placeholder="Restaurante, clínica…" {...register('segment')} />
          <Input label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Telefone" {...register('phone')} />
          <Input
            label="Website"
            placeholder="https://…"
            error={errors.website?.message}
            {...register('website')}
          />
          <Input label="Cidade" {...register('city')} />
          <Input label="País" {...register('country')} />
          <Input label="Tags (separadas por vírgula)" placeholder="sem-site, prioridade" {...register('tags')} />
        </div>
        <Textarea label="Observações" {...register('notes')} />

        {serverError ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
            {serverError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Criar lead
          </Button>
        </div>
      </form>
    </Modal>
  );
}
