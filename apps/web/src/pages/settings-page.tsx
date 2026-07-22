import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
}

export function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const members = useQuery({
    queryKey: ['organizations', 'members'],
    queryFn: async () => {
      const { data } = await api.get<Member[]>('/organizations/members');
      return data;
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500">{user?.organizationName}</p>
      </div>

      <Card>
        <CardHeader title="Usuários e permissões" description="Membros da organização" />
        <CardContent>
          {members.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {(members.data ?? []).map((member) => (
                <li key={member.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{member.user.name}</p>
                    <p className="text-xs text-slate-500">{member.user.email}</p>
                  </div>
                  <Badge tone={member.role === 'OWNER' ? 'brand' : 'slate'}>{member.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Scoring" description="Configuração de pontuação por organização" />
        <CardContent>
          <p className="text-sm text-slate-500">
            Regras de scoring configuráveis disponíveis na Fase 4, junto com a análise automática
            de websites.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
