import { zodResolver } from '@hookform/resolvers/zod';
import { Building2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { register as registerUser } from '@/features/auth/api';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const registerSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Deve conter letra e número'),
  organizationName: z.string().min(2, 'Nome da organização obrigatório'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterForm) => {
    setServerError(null);
    try {
      const response = await registerUser(values);
      setAuth(response);
      navigate('/', { replace: true });
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Building2 className="h-10 w-10 text-brand-600" aria-hidden />
          <h1 className="text-2xl font-bold text-slate-900">Criar conta</h1>
          <p className="text-sm text-slate-500">Comece a prospectar em minutos</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input label="Nome" autoComplete="name" error={errors.name?.message} {...register('name')} />
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Nome da organização"
            error={errors.organizationName?.message}
            {...register('organizationName')}
          />

          {serverError ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {serverError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Criar conta
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
