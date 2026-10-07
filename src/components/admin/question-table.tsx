import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { QuestionStats } from "@/types/domain";

export function QuestionTable({ questions }: { questions: QuestionStats[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Questão</TableHead>
          <TableHead className="text-right">Respostas</TableHead>
          <TableHead className="text-right">Acertos</TableHead>
          <TableHead className="text-right">Erros</TableHead>
          <TableHead className="text-right">% acerto</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {questions.map((q) => (
          <TableRow key={`${q.question_id}-${q.exam_id}`}>
            <TableCell className="max-w-md">
              <Link href={`/admin/avaliacoes/questoes/${q.question_id}`} className="line-clamp-2 hover:underline">
                <span className="font-mono text-xs text-muted-foreground">Q-{String(q.number).padStart(3, "0")} </span>
                {q.statement}
              </Link>
            </TableCell>
            <TableCell className="text-right tabular-nums">{q.total_answers}</TableCell>
            <TableCell className="text-right tabular-nums text-success">{q.correct}</TableCell>
            <TableCell className="text-right tabular-nums text-destructive">{q.wrong}</TableCell>
            <TableCell className={cn("text-right font-semibold tabular-nums", Number(q.pct_correct) < 60 && "text-destructive")}>{formatPercent(q.pct_correct)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
