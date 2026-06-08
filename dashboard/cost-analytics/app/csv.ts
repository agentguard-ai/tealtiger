import type {
  BudgetUtilization,
  CostEvent,
  ExpensiveCall,
  ExportView,
  ProviderCost,
  TimelineRow,
  ToolCost,
} from './types';

interface CsvPayload {
  raw: CostEvent[];
  timeline: TimelineRow[];
  budgets: BudgetUtilization[];
  providers: ProviderCost[];
  tools: ToolCost[];
  calls: ExpensiveCall[];
}

export function exportCsv(view: ExportView, payload: CsvPayload): void {
  const rows = rowsForView(view, payload);
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tealtiger-cost-${view}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function rowsForView(view: ExportView, payload: CsvPayload): Record<string, string | number>[] {
  switch (view) {
    case 'timeline':
      return payload.timeline;
    case 'budgets':
      return payload.budgets.map((budget) => ({
        ...budget,
        utilization_pct: Number((budget.utilization * 100).toFixed(2)),
      }));
    case 'providers':
      return payload.providers;
    case 'tools':
      return payload.tools;
    case 'calls':
      return payload.calls;
    case 'raw':
    default:
      return payload.raw;
  }
}

function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

function escapeCell(value: string | number | undefined): string {
  const serialized = String(value ?? '');
  if (/["\n,]/.test(serialized)) {
    return `"${serialized.replace(/"/g, '""')}"`;
  }
  return serialized;
}
