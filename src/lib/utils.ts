import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Payment, CalculatedPayment, PaymentScheduleArgs, PaymentFrequency, RegisteredPayment, CreditDetail, CreditStatus, CreditStatusDetails } from '@/lib/types';
import { addWeeks, addDays, parseISO, startOfDay, isBefore, differenceInDays, format, isAfter, endOfDay, isEqual, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { TIMEZONE } from './constants';
import { formatDateForUser, formatDateTimeForUser, toISOString } from './date-utils';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCedula(value: string): string {
    if (!value) return '';
    const cleaned = value.replace(/[^0-9A-Z]/gi, '').toUpperCase();
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    if (cleaned.length <= 13) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 9)}-${cleaned.slice(9)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 9)}-${cleaned.slice(9, 13)}${cleaned.slice(13, 14)}`;
}

export function formatPhone(value: string): string {
    if (!value) return '';
    const cleaned = value.replace(/\D/g, ''); // Remover todos los caracteres no numéricos
    if (cleaned.length <= 4) {
        return cleaned;
    }
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
}

export function formatCedulaForPagare(cedula: string): string {
  if (!cedula) return '';
  const lastHyphenIndex = cedula.lastIndexOf('-');
  if (lastHyphenIndex !== -1 && cedula.includes('-')) {
    return cedula;
  }
  return formatCedula(cedula);
}

// Funciones universales de codificación/decodificación que funcionan en cliente y servidor
export const encodeData = (data: string): string => {
  if (typeof window !== 'undefined') {
    // Lado del cliente
    return window.btoa(data);
  } else {
    // Lado del servidor
    return Buffer.from(data).toString('base64');
  }
};

export const decodeData = (encodedData: string): string => {
  try {
    if (typeof window !== 'undefined') {
      // Lado del cliente
      return window.atob(encodedData);
    }
     else {
      // Lado del servidor
      return Buffer.from(encodedData, 'base64').toString('utf-8');
    }
  } catch (e) {
      // Fallback: Si la decodificación falla, es probable que el dato ya esté en texto plano.
      return encodedData;
  }
};

export const normalizeString = (str: string = ''): string => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

/**
 * Ajusta una fecha al próximo día hábil, saltando fines de semana y feriados según la frecuencia.
 * @param date La fecha a ajustar.
 * @param frequency La frecuencia de pago para aplicar las reglas correctas.
 * @param holidays Un arreglo de fechas de feriados en formato 'YYYY-MM-DD'.
 * @returns El objeto Date ajustado.
 */
export const adjustToNextBusinessDay = (date: Date, frequency: PaymentFrequency, holidays: string[] = []): Date => {
    let newDate = new Date(date);

    const isHoliday = (d: Date) => {
        const dateString = format(d, 'yyyy-MM-dd');
        return holidays.includes(dateString);
    };

    let adjusted = true;
    while(adjusted) {
        adjusted = false;
        const dayOfWeek = newDate.getDay(); // 0 = Domingo, 6 = Sábado

        // Regla para Domingo (aplica a todos)
        if (dayOfWeek === 0) {
            newDate = addDays(newDate, 1);
            adjusted = true;
            continue;
        }

        // Regla para Sábado
        if (dayOfWeek === 6) {
            if (frequency === 'Diario') { // Para diarios, saltar sábado a lunes
                newDate = addDays(newDate, 2);
                adjusted = true;
                continue;
            }
            // Para otros, el sábado es un día de cobro válido si se movió de un feriado.
            // Si la fecha original cae en sábado, Quincenal se queda, otros se mueven.
            if (frequency === 'Semanal' || frequency === 'Catorcenal') {
                 // Si el día pactado es sábado (poco probable pero posible), lo dejamos,
                 // si se movió a un sábado, está bien. La lógica principal se encarga.
            }
        }
        
        // Regla para Feriados (aplica a todos, después de ajustar fines de semana)
        if (isHoliday(newDate)) {
            newDate = addDays(newDate, 1);
            adjusted = true;
        }
    }
    
    return newDate;
};


export function generatePaymentSchedule(data: PaymentScheduleArgs): CalculatedPayment | null {
  const loanAmount = Number(data.loanAmount);
  const monthlyInterestRate = Number(data.monthlyInterestRate);
  const termMonths = Number(data.termMonths);
  let { paymentFrequency, startDate: dateInput, holidays = [] } = data;

  if (!dateInput || isNaN(loanAmount) || loanAmount <= 0 || isNaN(monthlyInterestRate) || monthlyInterestRate < 0 || isNaN(termMonths) || termMonths <= 0) {
    return null;
  }

  // --- MANEJO SEGURO DE FECHAS (FIX) ---
  // Usar las funciones de fecha de Nicaragua para evitar problemas de zona horaria
  let initialDate: Date;
  try {
    if (dateInput.includes('T')) {
      // Si ya es ISO, parsearlo directamente
      initialDate = parseISO(dateInput);
    } else {
      // Si es solo fecha (YYYY-MM-DD), crear fecha local de Nicaragua
      const nicaraguaDate = new Date(`${dateInput}T00:00:00`);
      initialDate = nicaraguaDate;
    }
    
    if (isNaN(initialDate.getTime())) return null;
  } catch (error) {
    console.error('Error parsing date in generatePaymentSchedule:', error);
    return null;
  }

  let numberOfPayments: number;
  
  switch (paymentFrequency) {
    case 'Diario': numberOfPayments = Math.round(termMonths * 20); break;
    case 'Semanal': numberOfPayments = Math.round(termMonths * 4); break;
    case 'Catorcenal': numberOfPayments = Math.round(termMonths * 2); break;
    case 'Quincenal': numberOfPayments = Math.round(termMonths * 2); break;
    default: return null;
  }

  if (numberOfPayments <= 0) return null;

  const totalInterest = loanAmount * (monthlyInterestRate / 100) * termMonths;
  const totalPayment = loanAmount + totalInterest;
  const periodicPayment = totalPayment / numberOfPayments;
  
  const periodicInterest = totalInterest / numberOfPayments;
  const periodicPrincipal = loanAmount / numberOfPayments;

  const schedule: Payment[] = [];
  let remainingBalance = totalPayment;
  
  // --- LÓGICA DE CÁLCULO REESTRUCTURADA ---
  let theoreticalDate = initialDate;
  let extensionDays = 0; // Para créditos diarios

  for (let i = 1; i <= numberOfPayments; i++) {
    // 1. Ajusta la fecha TEÓRICA para esta cuota específica
    let adjustedDate = adjustToNextBusinessDay(theoreticalDate, paymentFrequency, holidays);

    // Si es crédito diario y el ajuste causó un salto de días, se cuenta para extender el vencimiento.
    if(paymentFrequency === 'Diario') {
      const daysDiff = differenceInDays(adjustedDate, theoreticalDate);
      if(daysDiff > 0) {
        extensionDays += daysDiff;
      }
    }
    
    remainingBalance -= periodicPayment;
    
    schedule.push({
      id: `payment_${i}`,
      creditId: 'calc',
      paymentNumber: i,
      paymentDate: format(adjustedDate, 'yyyy-MM-dd'), // Guardar la fecha ajustada
      amount: periodicPayment,
      principal: periodicPrincipal,
      interest: periodicInterest,
      balance: Math.max(0, remainingBalance),
    });

    // 2. Avanza la fecha TEÓRICA para la siguiente iteración, sin contaminarla con el ajuste.
    switch (paymentFrequency) {
      case 'Diario':
        // Siempre avanza al siguiente día hábil desde la fecha ajustada anterior para mantener la secuencia
        theoreticalDate = adjustToNextBusinessDay(addDays(adjustedDate, 1), 'Diario', holidays);
        break;
      case 'Semanal':
        theoreticalDate = addWeeks(theoreticalDate, 1);
        break;
      case 'Catorcenal':
        theoreticalDate = addDays(theoreticalDate, 14);
        break;
      case 'Quincenal':
        theoreticalDate = addDays(theoreticalDate, 15);
        break;
    }
  }

  // Si es diario y hubo extensiones, ajusta la fecha de la última cuota.
  if(paymentFrequency === 'Diario' && extensionDays > 0) {
      const lastPayment = schedule[schedule.length-1];
      if(lastPayment) {
          let finalDate = parseISO(lastPayment.paymentDate);
          for(let i=0; i<extensionDays; i++){
              finalDate = adjustToNextBusinessDay(addDays(finalDate, 1), 'Diario', holidays);
          }
          lastPayment.paymentDate = format(finalDate, 'yyyy-MM-dd');
      }
  }

  return {
    periodicPayment,
    totalPayment,
    totalInterest: totalInterest,
    schedule
  };
}


export const cleanDataForDatabase = (data: any) => {
  const cleanedData: { [key: string]: any } = {};
  for (const key in data) {
    if (data[key] !== undefined) {
      cleanedData[key] = data[key];
    }
  }
  return cleanedData;
};

export function generateReceiptText(
  credit: CreditDetail,
  payment: RegisteredPayment,
  copyType: 'CLIENTE' | 'CONTROL INTERNO',
  isReprint: boolean = false
): string {
    const TOTAL_WIDTH = 42;

    // --- Funciones de Ayuda ---
    const sanitize = (text: string = ''): string => {
        if (!text) return '';
        return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    };

    const formatCurrencyNoSymbol = (amount: number): string => {
        if (isNaN(amount)) return '0.00';
        return amount.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const center = (text: string): string => {
        if (text.length >= TOTAL_WIDTH) return text.substring(0, TOTAL_WIDTH);
        const padding = Math.floor((TOTAL_WIDTH - text.length) / 2);
        return ' '.repeat(Math.max(0, padding)) + text;
    };

    const alignLeftRight = (left: string, right: string): string => {
        const padding = ' '.repeat(Math.max(1, TOTAL_WIDTH - left.length - right.length));
        return left + padding + right;
    };
    
    const lineSeparator = '-'.repeat(TOTAL_WIDTH);

    // --- Cálculo de Datos ---
    const paymentsBeforeCurrent = (credit.registeredPayments || []).filter(p => p.id !== payment.id);
    const creditStateBefore = { ...credit, registeredPayments: paymentsBeforeCurrent };
    
    const statusBeforePayment = calculateCreditStatusDetails(creditStateBefore);
    const statusAfterPayment = calculateCreditStatusDetails(credit);

    const cuotaDelDia = statusBeforePayment.dueTodayAmount || 0;
    const montoAtrasado = statusBeforePayment.overdueAmount;
    const diasMora = statusBeforePayment.lateDays;
    const totalAPagar = cuotaDelDia + montoAtrasado;
    const saldoAnterior = statusBeforePayment.remainingBalance;
    const totalCobrado = payment.amount;
    const nuevoSaldo = statusAfterPayment.remainingBalance;
    const sucursalName = (credit.branchName || 'Sucursal').split(' ')[0].toUpperCase();

    // --- Ensamblaje del Recibo ---
    const lines = [];

    if (isReprint) {
        lines.push(center('*** REIMPRESION ***'));
        lines.push('');
    }
    
    lines.push(center('CrediNica'));
    lines.push(center(`COPIA: ${copyType}`));
    lines.push(lineSeparator);
    lines.push(`Recibo: ${payment.transactionNumber}`);
    lines.push(`Credito: ${credit.creditNumber}`);
    lines.push(`Fecha/Hora: ${formatDate(payment.paymentDate, 'dd/MM/yyyy HH:mm:ss')}`);
    lines.push(`Transaccion: ${payment.transactionNumber}`);
    lines.push(lineSeparator);

    lines.push('Cliente:');
    lines.push(sanitize(credit.clientName));
    lines.push(credit.clientDetails?.clientNumber || 'N/A');
    lines.push(lineSeparator);

    lines.push(alignLeftRight('Cuota del dia:', formatCurrencyNoSymbol(cuotaDelDia)));
    lines.push(alignLeftRight('Monto atrasado:', formatCurrencyNoSymbol(montoAtrasado)));
    lines.push(alignLeftRight('Dias mora:', diasMora.toString()));
    lines.push(alignLeftRight('Total a pagar:', formatCurrencyNoSymbol(totalAPagar)));
    lines.push(lineSeparator);
    
    lines.push(alignLeftRight('Monto de cancelacion:', formatCurrencyNoSymbol(saldoAnterior)));
    lines.push(lineSeparator);
    lines.push(alignLeftRight('Total cobrado:', formatCurrencyNoSymbol(totalCobrado)));
    lines.push(lineSeparator);
    
    lines.push('Concepto:');
    lines.push('ABONO DE CREDITO');
    lines.push(alignLeftRight('Saldo anterior:', formatCurrencyNoSymbol(saldoAnterior)));
    lines.push(alignLeftRight('Nuevo saldo:', formatCurrencyNoSymbol(nuevoSaldo)));
    lines.push(lineSeparator);
    
    lines.push('');
    lines.push('');
    lines.push(center(sanitize(sucursalName)));
    lines.push('');
    lines.push(center(sanitize(payment.managedBy)));
    lines.push(center('GESTOR DE COBRO'));
    lines.push('');

    if (isReprint) {
        lines.push(center('*** REIMPRESION ***'));
    }

    lines.push('\n\n\n'); 

    return lines.join('\n');
}

export const PROVISION_RULES = {
  'A': { min: 1, max: 15, rate: 0.01, label: 'A (Riesgo Normal)' },
  'B': { min: 16, max: 30, rate: 0.05, label: 'B (Riesgo Potencial)' },
  'C': { min: 31, max: 60, rate: 0.20, label: 'C (Riesgo Real)' },
  'D': { min: 61, max: 90, rate: 0.60, label: 'D (Dudosa Recuperación)' },
  'E': { min: 91, max: Infinity, rate: 1.00, label: 'E (Irrecuperable)' },
};
export type ProvisionBucket = keyof typeof PROVISION_RULES;

export const getProvisionCategory = (lateDays: number): { category: ProvisionBucket } => {
  if (lateDays >= 1 && lateDays <= 15) return { category: 'A' };
  if (lateDays >= 16 && lateDays <= 30) return { category: 'B' };
  if (lateDays >= 31 && lateDays <= 60) return { category: 'C' };
  if (lateDays >= 61 && lateDays <= 90) return { category: 'D' };
  if (lateDays > 90) return { category: 'E' };
  // Por defecto, categoría A para 0 días de atraso
  return { category: 'A' };
};

export const getRiskCategoryVariant = (category?: string) => {
    switch (category) {
        case 'A': return 'success';
        case 'B': case 'C': return 'warning';
        case 'D': case 'E': return 'destructive';
        default: return 'secondary';
    }
};

const toISOStringSafe = (date: any): string | undefined => {
    return toISOString(date) || undefined;
};

export function calculateCreditStatusDetails(credit: CreditDetail, asOfDateStr?: string | Date): CreditStatusDetails {
    const defaultReturn: CreditStatusDetails = {
        remainingBalance: 0,
        overdueAmount: 0,
        lateDays: 0,
        currentLateFee: 0,
        paidToday: 0,
        isExpired: false,
        isDueToday: false,
        lastPaymentDate: undefined,
        firstUnpaidDate: undefined,
        conamiCategory: getProvisionCategory(0).category,
        totalInstallmentAmount: credit.totalInstallmentAmount,
        dueTodayAmount: 0
    };

    if (!credit || credit.status === 'Rejected' || credit.status === 'Pending' || credit.status === 'Fallecido') {
      return defaultReturn;
    }

    // Ensure paymentPlan and registeredPayments are arrays
    const paymentPlan = Array.isArray(credit.paymentPlan) ? credit.paymentPlan : [];
    const registeredPayments = Array.isArray(credit.registeredPayments) ? credit.registeredPayments : [];

    const sortedValidPayments = [...registeredPayments]
        .filter(p => p.status !== 'ANULADO' && toISOStringSafe(p.paymentDate))
        .sort((a,b) => parseISO(toISOStringSafe(b.paymentDate)!).getTime() - parseISO(toISOStringSafe(a.paymentDate)!).getTime());
    
    if (credit.status === 'Paid') {
        const lastPayment = sortedValidPayments[0];
        if (lastPayment?.paymentDate) {
            defaultReturn.lastPaymentDate = toISOStringSafe(lastPayment.paymentDate)!;
        }
        return defaultReturn;
    }
    
    // Continuar para créditos Activos
    const asOfDate = asOfDateStr ? startOfDay(new Date(asOfDateStr)) : startOfDay(new Date());

    const totalToPay = credit.totalAmount || 0;
    const validPayments = registeredPayments.filter(p => p.status !== 'ANULADO');
    const totalPaid = validPayments.reduce((sum, p) => sum + p.amount, 0);

    let remainingBalance = Math.max(0, totalToPay - totalPaid);

    if (remainingBalance < 0.01) {
        const lastPayment = sortedValidPayments[0];
        if (lastPayment?.paymentDate) {
            defaultReturn.lastPaymentDate = toISOStringSafe(lastPayment.paymentDate)!;
        }
        defaultReturn.remainingBalance = 0;
        return defaultReturn;
    }

    const paidToday = validPayments
        .filter(p => {
             const safeDateString = toISOStringSafe(p.paymentDate);
             return safeDateString && isEqual(startOfDay(new Date(safeDateString)), asOfDate);
        })
        .reduce((sum, p) => sum + p.amount, 0);


    const lastPayment = sortedValidPayments[0];
    const safeDueDate = toISOStringSafe(credit.dueDate);
    const isExpired = safeDueDate ? isBefore(parseISO(safeDueDate), asOfDate) : false;

    // Encontrar la cuota para "hoy" (asOfDate)
    // Calcular lo que se debía *antes* de hoy
    const installmentsDueBeforeToday = paymentPlan
      .filter(p => {
          const safePDate = toISOStringSafe(p.paymentDate);
          return safePDate && isBefore(startOfDay(parseISO(safePDate)), asOfDate);
      });

    const amountDueBeforeToday = installmentsDueBeforeToday.reduce((sum, p) => sum + p.amount, 0);

    const totalPaidBeforeToday = validPayments
      .filter(p => {
          const safeDateString = toISOStringSafe(p.paymentDate);
          return safeDateString && isBefore(new Date(safeDateString), asOfDate);
      })
      .reduce((sum, p) => sum + p.amount, 0);

    // El excedente de pagos anteriores se calcula aquí
    const surplusFromPast = Math.max(0, totalPaidBeforeToday - amountDueBeforeToday);
    
    // El monto en mora es la deuda de cuotas pasadas menos el total pagado en el pasado.
    let overdueAmount = Math.max(0, amountDueBeforeToday - totalPaidBeforeToday);

    // Encontrar la cuota para "hoy" (asOfDate)
    const installmentDueToday = paymentPlan.find(p => {
        const safePDate = toISOStringSafe(p.paymentDate);
        if (!safePDate) return false;
        const installmentDate = startOfDay(parseISO(safePDate));
        return isEqual(installmentDate, asOfDate);
    });
    const isDueToday = !!installmentDueToday;
    const originalDueTodayAmount = isDueToday ? (installmentDueToday?.amount || 0) : 0;

    // La cuota del día se ajusta con el excedente de pagos anteriores.
    const dueTodayAmount = Math.max(0, originalDueTodayAmount - surplusFromPast);

    let lateDays = 0;
    let firstUnpaidDate: string | undefined = undefined;

    if (overdueAmount > 0.01) {
        let cumulativeDue = 0;
        const firstUnpaidInstallment = paymentPlan.find(p => {
            const safePDate = toISOStringSafe(p.paymentDate);
            if (!safePDate || isAfter(startOfDay(parseISO(safePDate)), asOfDate)) return false;
            cumulativeDue += p.amount;
            return totalPaid < cumulativeDue - 0.01;
        });

        if (firstUnpaidInstallment?.paymentDate) {
            firstUnpaidDate = toISOStringSafe(firstUnpaidInstallment.paymentDate)!;
            lateDays = differenceInDays(asOfDate, startOfDay(parseISO(firstUnpaidDate)));
        }
    }
    
    const currentLateFee = 0; // Se establece en 0 según solicitud del usuario
    const { category: conamiCategory } = getProvisionCategory(lateDays);
    const lastPaymentDate = lastPayment?.paymentDate ? toISOStringSafe(lastPayment.paymentDate)! : undefined;

    return {
        remainingBalance,
        overdueAmount,
        lateDays: Math.max(0, lateDays),
        currentLateFee,
        lastPaymentDate,
        isExpired,
        isDueToday,
        paidToday,
        firstUnpaidDate,
        conamiCategory,
        totalInstallmentAmount: credit.totalInstallmentAmount,
        dueTodayAmount,
    };
}


// --- Nueva función para estado de cuenta detallado ---

export interface ProcessedStatementInstallment extends Payment {
  lateDays: number;
  lateFee: number;
  paidAmount: number;
  status: 'PAGADA' | 'ATRASADA' | 'PENDIENTE';
}

export interface ProcessedStatementPayment extends RegisteredPayment {
  principalApplied: number;
  interestApplied: number;
  lateFeeApplied: number;
}

export interface FullStatement {
  installments: ProcessedStatementInstallment[];
  payments: ProcessedStatementPayment[];
  totals: {
    plan: { cuota: number; mora: number; pagado: number; saldo: number; };
    abonos: { total: number; capital: number; interes: number; mora: number; };
  }
}

/**
 * Genera un estado de cuenta detallado, procesando cada cuota y pago.
 * @param credit El objeto de detalle del crédito.
 * @returns Un objeto `FullStatement` con los datos procesados.
 */
export function generateFullStatement(credit: CreditDetail): FullStatement {
  const LATE_FEE_RATE_PER_DAY = 0; // Establecido en 0 según solicitud
  const today = startOfDay(new Date());

  // Ensure paymentPlan and registeredPayments are arrays
  const paymentPlan = Array.isArray(credit.paymentPlan) ? credit.paymentPlan : [];
  const registeredPayments = Array.isArray(credit.registeredPayments) ? credit.registeredPayments : [];

  const sortedPayments = [...registeredPayments].filter(p => p.status !== 'ANULADO' && toISOStringSafe(p.paymentDate)).sort((a, b) => parseISO(toISOStringSafe(a.paymentDate)!).getTime() - parseISO(toISOStringSafe(b.paymentDate)!).getTime());
  const totalPaid = sortedPayments.reduce((sum, p) => sum + p.amount, 0);

  // --- Procesa el desglose de los abonos ---
  const totalPrincipalOwed = credit.principalAmount || 0;
  const totalInterestOwed = credit.totalInterest || 0;
  const totalLoanValue = totalPrincipalOwed + totalInterestOwed;

  const principalRatio = totalLoanValue > 0 ? totalPrincipalOwed / totalLoanValue : 0;
  const interestRatio = totalLoanValue > 0 ? totalInterestOwed / totalLoanValue : 0;

  const processedPayments: ProcessedStatementPayment[] = sortedPayments.map(p => {
    // Para simplificar, distribuimos el pago entre capital e interés según la proporción original del crédito.
    const remainingAmountAfterMora = p.amount;
    const principalComponent = remainingAmountAfterMora * principalRatio;
    const interestComponent = remainingAmountAfterMora * interestRatio;

    return {
      ...p,
      principalApplied: principalComponent,
      interestApplied: interestComponent,
      lateFeeApplied: 0, // El cálculo de mora se hace por cuota, no por pago.
    };
  });

  // --- Procesa los detalles de cada cuota del plan ---
  let cumulativeDueForPlan = 0;
  let cumulativePaidForPlan = 0;

  const processedInstallments: ProcessedStatementInstallment[] = paymentPlan.map(installment => {
    const amountDuePreviously = cumulativeDueForPlan;
    cumulativeDueForPlan += installment.amount;
    
    // Calcula cuánto de lo pagado hasta ahora se aplica a esta cuota.
    const paidForThisInstallment = Math.max(0, Math.min(installment.amount, totalPaid - amountDuePreviously));
    cumulativePaidForPlan += paidForThisInstallment;
    
    const isPaidInFull = paidForThisInstallment >= installment.amount - 0.01;
    const safeInstallmentDate = toISOStringSafe(installment.paymentDate);
    if (!safeInstallmentDate) {
        // Manejar caso de fecha de cuota inválida
        return {
            ...installment, paidAmount: 0, lateDays: 0, lateFee: 0, status: 'PENDIENTE'
        }
    }
    const installmentDate = parseISO(safeInstallmentDate);

    let lateDays = 0;
    if (isPaidInFull) {
        // Si la cuota está pagada, encuentra qué pago la completó para calcular los días de atraso.
        let tempCumulativePaid = 0;
        let clearingPaymentDateStr: string | undefined = undefined;
        for (const payment of sortedPayments) {
            tempCumulativePaid += payment.amount;
            if (tempCumulativePaid >= cumulativeDueForPlan - 0.01) {
                clearingPaymentDateStr = toISOStringSafe(payment.paymentDate);
                break;
            }
        }
        
        if (clearingPaymentDateStr) {
            const dateItWasPaid = parseISO(clearingPaymentDateStr);
            const startOfPaidDate = startOfDay(dateItWasPaid);
            const startOfDueDate = startOfDay(installmentDate);

            if (isAfter(startOfPaidDate, startOfDueDate)) {
                lateDays = differenceInDays(startOfPaidDate, startOfDueDate);
            }
        }
    } else { 
        // Si no está pagada y ya venció, calcula el atraso hasta hoy.
        if (isBefore(installmentDate, today)) {
             const startOfTodayDate = startOfDay(today);
             const startOfDueDate = startOfDay(installmentDate);
             lateDays = differenceInDays(startOfTodayDate, startOfDueDate);
        }
    }
    
    const lateFee = 0; // Establecido en 0 según solicitud
    
    const installmentWithDetails: ProcessedStatementInstallment = {
        ...installment,
        paidAmount: paidForThisInstallment,
        lateDays: lateDays,
        lateFee: lateFee,
        status: isPaidInFull ? 'PAGADA' : (isBefore(installmentDate, today) ? 'ATRASADA' : 'PENDIENTE'),
    };
    return installmentWithDetails;
  });

  // --- Calcular Totales ---
  const totalCuota = processedInstallments.reduce((sum, i) => sum + i.amount, 0);
  const totalPagado = processedInstallments.reduce((sum, i) => sum + i.paidAmount, 0);
  const planTotals = {
    cuota: totalCuota,
    mora: processedInstallments.reduce((sum, i) => sum + i.lateFee, 0),
    pagado: totalPagado,
    saldo: totalCuota - totalPagado,
  };
  
  const abonosTotals = {
    total: processedPayments.reduce((sum, p) => sum + p.amount, 0),
    capital: processedPayments.reduce((sum, p) => sum + p.principalApplied, 0),
    interes: processedPayments.reduce((sum, p) => sum + p.interestApplied, 0),
    mora: processedPayments.reduce((sum, p) => sum + p.lateFeeApplied, 0),
  };

  return {
    installments: processedInstallments,
    payments: processedPayments,
    totals: { plan: planTotals, abonos: abonosTotals },
  };
}

/**
 * Calcula el promedio de días de atraso para un crédito específico.
 * Lógica: Suma de todos los días de atraso de cada cuota / Número total de cuotas.
 * @param credit El objeto de detalle del crédito.
 * @returns Un objeto con `avgLateDaysForCredit` y `totalLateDaysForCredit`.
 */
export function calculateAveragePaymentDelay(credit: CreditDetail): { avgLateDaysForCredit: number; totalLateDaysForCredit: number } {
  const paymentPlan = Array.isArray(credit.paymentPlan) ? credit.paymentPlan : [];
  if (!paymentPlan || paymentPlan.length === 0) {
    return { avgLateDaysForCredit: 0, totalLateDaysForCredit: 0 };
  }

  // Usar el estado de cuenta completo para obtener los días de atraso precisos por cuota.
  const { installments } = generateFullStatement(credit);

  // Sumar los días de atraso de todas las cuotas de este crédito.
  // Esto incluye correctamente las cuotas pagadas a tiempo (lateDays: 0).
  const totalLateDaysForCredit = installments.reduce((sum, i) => sum + i.lateDays, 0);

  // El promedio es el total de días de atraso dividido por el número total de cuotas en el plan.
  const avgLateDaysForCredit = paymentPlan.length > 0 ? totalLateDaysForCredit / paymentPlan.length : 0;

  return { avgLateDaysForCredit, totalLateDaysForCredit };
}


// --- Nueva función para convertir número a letras ---

export const numeroALetras = (num: number): string => {
  const unidades: { [key: number]: string } = {
    0: 'CERO', 1: 'UNO', 2: 'DOS', 3: 'TRES', 4: 'CUATRO', 5: 'CINCO',
    6: 'SEIS', 7: 'SIETE', 8: 'OCHO', 9: 'NUEVE', 10: 'DIEZ',
    11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
    16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
    20: 'VEINTE', 21: 'VEINTIUNO', 22: 'VEINTIDOS', 23: 'VEINTITRES',
    24: 'VEINTICUATRO', 25: 'VEINTICINCO', 26: 'VEINTISEIS', 27: 'VEINTISIETE',
    28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
  };

  const decenas: { [key: number]: string } = {
    10: 'DIEZ', 20: 'VEINTE', 30: 'TREINTA', 40: 'CUARENTA', 50: 'CINCUENTA',
    60: 'SESENTA', 70: 'SETENTA', 80: 'OCHENTA', 90: 'NOVENTA'
  };

  const centenas: { [key: number]: string } = {
    100: 'CIEN', 200: 'DOSCIENTOS', 300: 'TRESCIENTOS', 400: 'CUATROCIENTOS',
    500: 'QUINIENTOS', 600: 'SEISCIENTOS', 700: 'SETECIENTOS', 800: 'OCHOCIENTOS',
    900: 'NOVECIENTOS'
  };

  const convertir = (n: number): string => {
    if (n < 30) return unidades[n];
    if (n < 100) {
      const d = Math.floor(n / 10) * 10;
      const u = n % 10;
      return u === 0 ? decenas[d] : `${decenas[d]} Y ${unidades[u]}`;
    }
    if (n < 1000) {
      const c = Math.floor(n / 100) * 100;
      const r = n % 100;
      if (r === 0) return centenas[c];
      if (c === 100) return `CIENTO ${convertir(r)}`;
      return `${centenas[c]} ${convertir(r)}`;
    }
    if (n < 2000) return `MIL ${convertir(n % 1000)}`;
    if (n < 1000000) return `${convertir(Math.floor(n / 1000))} MIL ${convertir(n % 1000)}`;
    if (n < 2000000) return `UN MILLÓN ${convertir(n % 1000000)}`;
    return `${convertir(Math.floor(n / 1000000))} MILLONES ${convertir(n % 1000000)}`;
  };
  
  if (num === null || num === undefined) return '';
  const entero = Math.floor(num);
  const centavos = Math.round((num - entero) * 100);
  
  if (entero === 0) {
      return `CERO CÓRDOBAS NETOS CON ${String(centavos).padStart(2, '0')}/100`;
  }
  
  let texto = convertir(entero);
  
  return `${texto} CÓRDOBAS NETOS CON ${String(centavos).padStart(2, '0')}/100`;
}


export const translateCreditStatus = (status?: CreditStatus): string => {
    if (!status) return 'Desconocido';
    const statusMap: Record<CreditStatus, string> = {
        'Active': 'Activo',
        'Approved': 'Aprobado',
        'Pending': 'Pendiente',
        'Paid': 'Cancelado',
        'Rejected': 'Rechazado',
        'Expired': 'Expirado',
        'Fallecido': 'Fallecido'
    };
    return statusMap[status] || status;
};

// Robust date formatting function to be used across the app
export const formatDate = (dateInput?: string | Date | number, formatStr: string = 'dd/MM/yyyy'): string => {
    if (!dateInput) return 'N/A';
    
    try {
        // Convertir number a Date si es necesario
        if (typeof dateInput === 'number') {
            return formatDateForUser(new Date(dateInput), formatStr);
        }
        return formatDateForUser(dateInput as string | Date, formatStr);
    } catch (error) {
        console.error('Error in formatDate:', error, 'Input:', dateInput);
        return 'N/A';
    }
};

export const formatTime = (dateInput?: string | Date | number, formatStr: string = 'h:mm a'): string => {
    if (!dateInput) return 'N/A';
    
    try {
        // Convertir number a Date si es necesario
        if (typeof dateInput === 'number') {
            return formatDateForUser(new Date(dateInput), formatStr);
        }
        return formatDateForUser(dateInput as string | Date, formatStr);
    } catch (error) {
        console.error('Error in formatTime:', error, 'Input:', dateInput);
        return 'N/A';
    }
};
