import { Search } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

export function SearchPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pesquisa de empresas</h1>
        <p className="text-sm text-slate-500">
          Encontre negócios locais com oportunidades de melhoria digital
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <Search className="h-10 w-10 text-slate-300" aria-hidden />
          <h2 className="text-base font-semibold text-slate-800">Disponível na Fase 3</h2>
          <p className="max-w-md text-sm text-slate-500">
            Pesquisa com provedor mock, Google Places, OpenStreetMap e Yelp, com importação direta
            dos resultados para a base de leads.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
