'use client';

import * as React from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, FilterX, Calendar as CalendarIcon, Search, Eye } from 'lucide-react';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { CashClosure, Sucursal, UserRole } from '@/lib/types';
import { AccessDenied } from '@/components/AccessDenied';
import { getSucursales } from '@/services/sucursal-service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatDate } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useDebounce } from 'use-debounce';
import { Input } from '@/components/ui/input';
import { ClosureDetailDialog } from './components/ClosureDetailDialog';
import { format } from 'date-fns';

const ALLOWED_ROLES: UserRole[] = ['ADMINISTRADOR', 'OPERATIVO', 'FINANZAS', 'GERENTE'];

const formatCurrency = (amount: number) => `C$${amount.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ClosuresHistoryPage() {
    const { user } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [closures, setClosures] = React.useState<CashClosure[]>([]);
    const [filteredClosures, setFilteredClosures] = React.useState<CashClosure[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [sucursales, setSucursales] = React.useState<Sucursal[]>([]);
    const [selectedClosure, setSelectedClosure] = React.useState<CashClosure | null>(null);
    
    // Filtros
    const [selectedSucursal, setSelectedSucursal] = React.useState('all');
    const [dateFrom, setDateFrom] = React.useState<Date | undefined>();
    const [dateTo, setDateTo] = React.useState<Date | undefined>();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [debouncedSearchTerm] = useDebounce(searchTerm, 500);

    const canView = user && ALLOWED_ROLES.includes(user.role.toUpperCase() as UserRole);

    React.useEffect(() => {
        if (!canView) {
            setIsLoading(false);
            return;
        }

        const fetchClosures = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/reports/closures');
                if (!response.ok) {
                    throw new Error('No se pudo obtener el historial de arqueos.');
                }
                const data: CashClosure[] = await response.json();
                setClosures(data);
            } catch (error) {
                console.error("Error fetching closures:", error);
                toast({ title: 'Error', description: 'No se pudieron cargar los arqueos.', variant: 'destructive'});
            } finally {
                setIsLoading(false);
            }
        };

        fetchClosures();
        getSucursales().then(setSucursales);

    }, [toast, canView]);
    
     React.useEffect(() => {
        let filtered = closures;

        if (selectedSucursal !== 'all') {
            filtered = filtered.filter(c => c.sucursalId === selectedSucursal);
        }
        if (dateFrom) {
            filtered = filtered.filter(c => new Date(c.closureDate) >= dateFrom);
        }
        if (dateTo) {
            filtered = filtered.filter(c => new Date(c.closureDate) <= endOfDay(dateTo));
        }
        if (debouncedSearchTerm) {
            const lowercasedFilter = debouncedSearchTerm.toLowerCase();
            filtered = filtered.filter(c =>
                c.userName.toLowerCase().includes(lowercasedFilter) ||
                c.closedByUserName.toLowerCase().includes(lowercasedFilter)
            );
        }
        setFilteredClosures(filtered);
    }, [closures, selectedSucursal, dateFrom, dateTo, debouncedSearchTerm]);


    if (!canView) return <AccessDenied />;
    
    if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <>
        <div className="space-y-6">
             <PageHeader title="Historial de Arqueos de Caja">
                <Button variant="outline" onClick={() => router.push('/arqueo')}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                </Button>
             </PageHeader>
             <Card>
                <CardHeader>
                    <CardTitle>Arqueos Guardados</CardTitle>
                    <CardDescription>Aquí puedes ver todos los arqueos de caja que se han realizado en el sistema.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-2 mb-4">
                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar por usuario..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <Select value={selectedSucursal} onValueChange={setSelectedSucursal}>
                            <SelectTrigger className="w-full md:w-[220px]"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="all">Todas las Sucursales</SelectItem>{sucursales.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full md:w-[180px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateFrom ? format(dateFrom, 'dd/MM/yy') : <span>Desde</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} /></PopoverContent></Popover>
                        <Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full md:w-[180px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateTo ? format(dateTo, 'dd/MM/yy') : <span>Hasta</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} /></PopoverContent></Popover>
                        <Button variant="ghost" size="icon" title="Limpiar filtros" onClick={() => { setSearchTerm(''); setDateFrom(undefined); setDateTo(undefined); setSelectedSucursal('all');}}><FilterX className="h-4 w-4"/></Button>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Usuario Arqueado</TableHead>
                                <TableHead>Sistema</TableHead>
                                <TableHead>Físico</TableHead>
                                <TableHead>Diferencia</TableHead>
                                <TableHead>Cerrado Por</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                           {filteredClosures.length > 0 ? (
                               filteredClosures.map(c => (
                                   <TableRow key={c.id}>
                                       <TableCell>{formatDate(c.closureDate, 'dd/MM/yyyy HH:mm')}</TableCell>
                                       <TableCell>{c.userName}</TableCell>
                                       <TableCell>{formatCurrency(c.systemBalance)}</TableCell>
                                       <TableCell>{formatCurrency(c.physicalBalance)}</TableCell>
                                       <TableCell className={cn('font-bold', c.difference < 0 ? 'text-destructive' : c.difference > 0 ? 'text-green-600' : '')}>
                                            {formatCurrency(c.difference)}
                                       </TableCell>
                                       <TableCell>{c.closedByUserName}</TableCell>
                                       <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => setSelectedClosure(c)}>
                                                <Eye className="mr-2 h-4 w-4" /> Ver Detalles
                                            </Button>
                                       </TableCell>
                                   </TableRow>
                               ))
                           ) : (
                               <TableRow><TableCell colSpan={7} className="h-24 text-center">No se encontraron arqueos con los filtros seleccionados.</TableCell></TableRow>
                           )}
                        </TableBody>
                    </Table>
                </CardContent>
             </Card>
        </div>

        <ClosureDetailDialog
            isOpen={!!selectedClosure}
            onClose={() => setSelectedClosure(null)}
            closure={selectedClosure}
        />
        </>
    );
}

const endOfDay = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setHours(23, 59, 59, 999);
    return newDate;
};