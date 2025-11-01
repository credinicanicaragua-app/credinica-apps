
'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ReportHeader } from '@/app/reports/components/ReportHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Printer, FileSpreadsheet } from 'lucide-react';
import type { RejectionAnalysisItem } from '@/services/report-service';
import { generateRejectionAnalysisReport, exportRejectionsToExcel } from '@/services/report-service';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

const formatCurrency = (amount: number) => `C$${amount.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (dateString?: string) => dateString ? format(parseISO(dateString), 'dd/MM/yyyy', { locale: es }) : 'N/A';

export default function RejectionAnalysisReportPage() {
  const searchParams = useSearchParams();
  const [reportData, setReportData] = React.useState<RejectionAnalysisItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);
  const [dateFrom, setDateFrom] = React.useState<string | null>(null);
  const [dateTo, setDateTo] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const filters = {
        sucursales: searchParams.getAll('sucursal'),
        dateFrom: searchParams.get('from') || undefined,
        dateTo: searchParams.get('to') || undefined,
      };
      setDateFrom(filters.dateFrom || null);
      setDateTo(filters.dateTo || null);
      
      const data = await generateRejectionAnalysisReport(filters);
      setReportData(data);
      setIsLoading(false);
    };
    fetchData();
  }, [searchParams]);

  const handleExportToExcel = async () => {
    if (!reportData) return;
    setIsExporting(true);
    try {
      const { base64 } = await exportRejectionsToExcel(reportData);
       if (base64) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Rechazos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to export to Excel:", error);
    } finally {
      setIsExporting(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Generando reporte...</p>
      </div>
    );
  }

  const totalRejectedAmount = reportData.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="p-4 sm:p-6 print-container bg-white text-black">
      <div className="report-container mx-auto">
        <ReportHeader title="Análisis de Créditos Rechazados" dateFrom={dateFrom} dateTo={dateTo} />
        <div className="flex justify-end mb-4 no-print gap-2">
             <Button onClick={handleExportToExcel} variant="outline" disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              {isExporting ? 'Exportando...' : 'Exportar a Excel'}
            </Button>
            <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
        </div>
        <Table className="report-table-condensed">
            <TableHeader>
                <TableRow>
                    <TableHead>Fecha Solicitud</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Rechazado por</TableHead>
                    <TableHead className="text-right">Monto Solicitado</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {reportData.length > 0 ? (
                reportData.map((item) => (
                    <TableRow key={item.creditId}>
                        <TableCell>{formatDate(item.applicationDate)}</TableCell>
                        <TableCell>{item.clientName}</TableCell>
                        <TableCell>{item.reason}</TableCell>
                        <TableCell>{item.rejectedBy}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                ))
                ) : (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">No se encontraron créditos rechazados para los filtros seleccionados.</TableCell>
                </TableRow>
                )}
            </TableBody>
        </Table>
         <div className="mt-4 text-right font-bold text-base pr-4">
            Monto Total Rechazado: {formatCurrency(totalRejectedAmount)}
        </div>
      </div>
    </div>
  );
}
