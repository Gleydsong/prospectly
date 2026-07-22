import { Badge } from './badge';

export function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 80 ? 'green' : score >= 60 ? 'blue' : score >= 30 ? 'amber' : 'slate';
  const label =
    score >= 80 ? 'Alta prioridade' : score >= 60 ? 'Boa' : score >= 30 ? 'Média' : 'Baixa';
  return (
    <Badge tone={tone} title={label}>
      {score} pts
    </Badge>
  );
}
