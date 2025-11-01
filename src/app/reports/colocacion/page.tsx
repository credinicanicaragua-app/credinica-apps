'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ReportHeader } from '@/app/reports/components/ReportHeader';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Printer, FileSpreadsheet } from 'lucide-react';
import type { ColocacionRecuperacionItem } from '@/services/report-service';
import { generateColocacionVsRecuperacionReport, exportColocacionToExcel } from '@/services/report-service';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';


const formatCurrency = (amount: number) => `C$${amount.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ColocacionReportPage() {
  const searchParams = useSearchParams();
  const [reportData, setReportData] = React.useState<ColocacionRecuperacionItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);
  const [dateFrom, setDateFrom] = React.useState<string | null>(null);
  const [dateTo, setDateTo] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const filters = {
        sucursales: searchParams.getAll('sucursal'),
        users: searchParams.getAll('user'), // Use the new 'user' parameter
        dateFrom: searchParams.get('from') || undefined,
        dateTo: searchParams.get('to') || undefined,
      };
      setDateFrom(filters.dateFrom || null);
      setDateTo(filters.dateTo || undefined);
      
      const data = await generateColocacionVsRecuperacionReport(filters);
      setReportData(data);
      setIsLoading(false);
    };
    fetchData();
  }, [searchParams]);

  const handleExportToExcel = async () => {
    if (!reportData) return;
    setIsExporting(true);
    try {
      const { base64 } = await exportColocacionToExcel(reportData);
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
        a.download = `Colocacion_vs_Recuperacion_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
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
        <p className="ml-2">Generando reporte de colocación...</p>
      </div>
    );
  }

  // Group data by Sucursal and then by Supervisor (or 'OFICINA')
  const groupedData = reportData.reduce((acc, item) => {
    const sucKey = item.sucursalName || 'Sin Sucursal';
    if (!acc[sucKey]) {
        acc[sucKey] = {};
    }
    const supKey = item.supervisorName || 'OFICINA'; // Agrupar usuarios sin supervisor en "OFICINA"
    if (!acc[sucKey][supKey]) {
        acc[sucKey][supKey] = [];
    }
    acc[sucKey][supKey].push(item);
    return acc;
  }, {} as Record<string, Record<string, ColocacionRecuperacionItem[]>>);

  const grandTotalColocacion = reportData.reduce((sum, item) => sum + item.colocacion, 0);
  const grandTotalRecuperacion = reportData.reduce((sum, item) => sum + item.recuperacion, 0);
  const grandTotalDiferencia = reportData.reduce((sum, item) => sum + item.diferencia, 0);
  const grandTotalDesembolsos = reportData.reduce((sum, item) => sum + item.desembolsos, 0);

  return (
    <div className="p-4 sm:p-6 print-container bg-white text-black">
      <div className="report-container mx-auto">
        <ReportHeader title="Reporte Colocación vs Recuperación" dateFrom={dateFrom} dateTo={dateTo} />
        <div className="flex justify-end mb-4 no-print gap-2">
            <Button onClick={handleExportToExcel} variant="outline" disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              {isExporting ? 'Exportando...' : 'Exportar a Excel'}
            </Button>
            <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
        </div>
        <div className="space-y-6">
        {Object.keys(groupedData).length > 0 ? (
          Object.entries(groupedData).map(([sucursalName, supervisorGroup]) => {
            const sucursalTotalColocacion = Object.values(supervisorGroup).flat().reduce((sum, item) => sum + item.colocacion, 0);
            const sucursalTotalRecuperacion = Object.values(supervisorGroup).flat().reduce((sum, item) => sum + item.recuperacion, 0);
            const sucursalTotalDiferencia = Object.values(supervisorGroup).flat().reduce((sum, item) => sum + item.diferencia, 0);
            const sucursalTotalDesembolsos = Object.values(supervisorGroup).flat().reduce((sum, item) => sum + item.desembolsos, 0);

            return (
              <div key={sucursalName} className="break-inside-avoid">
                <h2 className="font-bold text-sm mb-2 uppercase">{`<< SUC. ${sucursalName} >>`}</h2>
                {Object.entries(supervisorGroup).map(([supervisorName, userList]) => (
                  <div key={supervisorName} className="mb-4">
                    <h3 className="font-semibold text-xs mb-1 uppercase">{`SUP. >> ${supervisorName}`}</h3>
                    <Table className="report-table-condensed">
                      <TableHeader>
                          <TableRow>
                              <TableHead>Nombre del Usuario</TableHead>
                              <TableHead className="text-right">Colocación</TableHead>
                              <TableHead className="text-right">Recuperación</TableHead>
                              <TableHead className="text-right">Diferencia</TableHead>
                              <TableHead className="text-right">Desembolsos</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {userList.map(item => (
                              <TableRow key={item.userName}>
                                  <TableCell>{item.userName}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(item.colocacion)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(item.recuperacion)}</TableCell>
                                  <TableCell className={`text-right font-bold ${item.diferencia > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.diferencia)}</TableCell>
                                  <TableCell className="text-right">{item.desembolsos}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                 </div>
                ))}
                 <Table>
                    <TableFooter>
                        <TableRow className="font-bold bg-gray-200">
                            <TableCell>TOTALES DE LA SUCURSAL</TableCell>
                            <TableCell className="text-right">{formatCurrency(sucursalTotalColocacion)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(sucursalTotalRecuperacion)}</TableCell>
                            <TableCell className={`text-right font-bold ${sucursalTotalDiferencia > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(sucursalTotalDiferencia)}</TableCell>
                            <TableCell className="text-right">{sucursalTotalDesembolsos}</TableCell>
                        </TableRow>
                    </TableFooter>
                 </Table>
              </div>
            )
          })
        ) : (
            <div className="text-center py-10 text-muted-foreground">
               <p>No se encontraron datos para los filtros seleccionados.</p>
            </div>
        )}
        </div>
        
        {Object.keys(groupedData).length > 0 && (
          <div className="mt-8 pt-6 border-t-2 border-black">
              <h2 className="text-center text-lg font-bold mb-4">Montos Totales de las Sucursales</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-4 bg-gray-100 rounded-lg">
                      <p className="text-sm font-normal text-gray-600">Total Colocación:</p>
                      <p className="font-bold text-lg">{formatCurrency(grandTotalColocacion)}</p>
                  </div>
                   <div className="p-4 bg-gray-100 rounded-lg">
                      <p className="text-sm font-normal text-gray-600">Total Recuperación:</p>
                      <p className="font-bold text-lg">{formatCurrency(grandTotalRecuperacion)}</p>
                  </div>
                   <div className="p-4 bg-gray-100 rounded-lg">
                      <p className="text-sm font-normal text-gray-600">Total Diferencia:</p>
                      <p className={`font-bold text-lg ${grandTotalDiferencia > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(grandTotalDiferencia)}</p>
                  </div>
                   <div className="p-4 bg-gray-100 rounded-lg">
                      <p className="text-sm font-normal text-gray-600">Total Desembolsos:</p>
                      <p className="font-bold text-lg">{grandTotalDesembolsos}</p>
                  </div>
              </div>
          </div>
        )}
      </div>
    </div>
  );
}
