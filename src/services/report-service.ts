'use server';

import { query } from '@/lib/mysql';
import type { CreditDetail, AppUser, RegisteredPayment, Client, Payment, PercentPaidItem, CreditStatus, RejectionAnalysisItem, ProvisionCredit } from '@/lib/types';
import { format, isAfter } from 'date-fns';
import { toISOString, nowInNicaragua, todayInNicaragua, isoToMySQLDateTime, formatDateForUser } from '@/lib/date-utils';
import * as XLSX from 'xlsx';
import { calculateAveragePaymentDelay, calculateCreditStatusDetails, getProvisionCategory, PROVISION_RULES } from '@/lib/utils';
import { getCredit } from './credit-service-server';

export interface ReportFilters {
    sucursales?: string[];
    users?: string[];
    dateFrom?: string;
    dateTo?: string;
    viewType?: 'summary' | 'detailed';
}

// --- Funciones auxiliares para manejo de fechas en reportes ---
const getReportDateStart = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        // Asegurar que la fecha se interprete como local de Nicaragua
        return `${dateStr} 00:00:00`;
    } catch (error) {
        console.error('Error parsing start date:', error);
        return '';
    }
};

const getReportDateEnd = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        // Asegurar que la fecha se interprete como local de Nicaragua
        return `${dateStr} 23:59:59`;
    } catch (error) {
        console.error('Error parsing end date:', error);
        return '';
    }
};

// --- Type Definitions ---
export interface DisbursementItem {
    creditId: string;
    creditNumber: string;
    clientName: string;
    deliveryDate: string;
    disbursedBy: string;
    amount: number;
    interestRate: number;
    termMonths: number;
}

export interface RecoveryReportItem {
    gestorName: string;
    creditCount: number;
    expectedAmount: number;
    collectedAmount: number;
    recoveryPercentage: number;
}

export interface FutureInstallmentsReportData {
    detailed: {
        creditId: string;
        creditNumber: string;
        clientName: string;
        gestorName: string;
        installmentsInRange: number;
        capitalInRange: number;
        interestInRange: number;
        totalAmountInRange: number;
    }[];
    summary: {
        gestorName: string;
        creditCount: number;
        totalAmount: number;
    }[];
}


export interface SaldosCarteraItem {
    creditId: string; creditNumber: string; clientName: string; clientNumber?: string; remainingBalance: number; remainingPrincipal: number; remainingInterest: number; installmentAmount: number; sucursalName: string; supervisorName: string; gestorName: string;
}
export interface SaldosCarteraSummaryItem {
    gestorName: string; creditCount: number; totalBalance: number; totalInstallment: number;
}
export interface ColocacionRecuperacionItem {
    userName: string; recuperacion: number; colocacion: number; diferencia: number; desembolsos: number; sucursalName: string; supervisorName: string; ultimaCuota?: string;
}
export interface PaymentDetailItem {
    transactionNumber: string;
    paymentDate: string;
    clientName: string;
    clientCode: string;
    gestorName: string;
    paidAmount: number;
    capitalPaid: number;
    interestPaid: number;
    currency: string;
}

export interface PaymentDetailSummaryItem {
    gestorName: string;
    paymentCount: number;
    totalPaid: number;
}

export interface PaymentDetailReportData {
    detailed: PaymentDetailItem[];
    summary: PaymentDetailSummaryItem[];
    stats: {
        totalPaid: number;
        dueTodayCapital: number;
        dueTodayInterest: number;
        overdue: number;
        expired: number;
        advance: number;
        totalClients: number;
    };
}

export interface ExpiredCreditItem {
    creditId: string;
    clientName: string;
    clientPhone: string;
    disbursedAmount: number;
    deliveryDate: string;
    dueDate: string;
    overdueAmount: number;
    pendingBalance: number;
    totalBalance: number;
    avgLateDaysForCredit: number;
    globalAvgLateDays: number;
    sucursalName: string;
    supervisorName: string;
    gestorName: string;
}

export interface ConsolidatedStatementData {
    client: Client;
    credits: CreditDetail[];
    creditCount: number;
    averageCreditAmount: number;
    globalAverageLateDays: number;
    economicActivity: string;
}

export interface OverdueCreditItem {
    creditId: string;
    creditNumber: string;
    clientName: string;
    clientAddress: string;
    clientPhone: string;
    deliveryDate: string;
    dueDate: string;
    installmentAmount: number; // La cuota del día para tipo 'D'
    overdueAmount: number; // El atraso acumulado de días anteriores
    lateDays: number;
    lateFee: number;
    totalToPay: number; // La suma que se debe cobrar (Cuota + Atraso)
    lastPaymentDate?: string;
    remainingBalance: number;
    type: 'D' | 'M' | 'V'; // Diario, Mora, Vencido
    gestorName: string;
}

export interface NonRenewedCreditItem {
    clientCode: string;
    clientName: string;
    creditId: string;
    creditNumber: string;
    currencyType: string;
    amount: number;
    totalAmount: number;
    interestRate: number;
    paymentFrequency: string;
    termMonths: number;
    cancellationDate: string; // dueDate del crédito pagado
    dueDate: string;
    avgLateDaysMora?: number;
    avgLateDaysGlobal?: number;
    gestorName: string;
}


export async function generateSaldosCarteraReport(filters: ReportFilters): Promise<{ detailed: SaldosCarteraItem[], summary: SaldosCarteraSummaryItem[] }> {
    let sql = `
        SELECT 
            c.id as creditId, c.creditNumber, c.clientName, 
            (SELECT cl.clientNumber FROM clients cl WHERE cl.id = c.clientId) as clientNumber,
            (c.totalAmount - IFNULL(p.totalPaid, 0)) as remainingBalance,
            c.totalInstallmentAmount as installmentAmount,
            c.branchName as sucursalName, c.supervisor as supervisorName, c.collectionsManager as gestorName,
            c.principalAmount, c.totalAmount
        FROM credits c
        LEFT JOIN (
            SELECT creditId, SUM(amount) as totalPaid 
            FROM payments_registered 
            WHERE status != 'ANULADO' 
            GROUP BY creditId
        ) p ON c.id = p.creditId
        WHERE c.status = 'Active'
    `;
    const params: any[] = [];

    if (filters.sucursales && filters.sucursales.length > 0) {
        const sucursalPlaceholders = filters.sucursales.map(() => '?').join(',');
        const sucursalNamesResult: any = await query(`SELECT name FROM sucursales WHERE id IN (${sucursalPlaceholders})`, filters.sucursales);
        if (Array.isArray(sucursalNamesResult) && sucursalNamesResult.length > 0) {
            const sucursalNames = sucursalNamesResult.map(s => s.name);
            const namePlaceholders = sucursalNames.map(() => '?').join(',');
            sql += ` AND c.branchName IN (${namePlaceholders})`;
            params.push(...sucursalNames);
        }
    }

    if (filters.users && filters.users.length > 0) {
        const userPlaceholders = filters.users.map(() => '?').join(',');
        const userNamesResult: any = await query(`SELECT fullName FROM users WHERE id IN (${userPlaceholders})`, filters.users);
        if (Array.isArray(userNamesResult) && userNamesResult.length > 0) {
            const userNames = userNamesResult.map(u => u.fullName);
            const namePlaceholders = userNames.map(() => '?').join(',');
            sql += ` AND c.collectionsManager IN (${namePlaceholders})`;
            params.push(...userNames);
        }
    }

    const credits: any[] = await query(sql, params);

    const detailed: SaldosCarteraItem[] = credits.map((row: any) => {
        const principalRatio = row.totalAmount > 0 ? row.principalAmount / row.totalAmount : 0;
        return {
            ...row,
            gestorName: row.gestorName || 'Sin Asignar',
            supervisorName: row.supervisorName || 'Sin Asignar',
            sucursalName: row.sucursalName || 'Sin Asignar',
            remainingPrincipal: row.remainingBalance * principalRatio,
            remainingInterest: row.remainingBalance * (1 - principalRatio),
        };
    });

    const summaryMap: Record<string, SaldosCarteraSummaryItem> = {};
    detailed.forEach(item => {
        const key = item.gestorName;
        if (!summaryMap[key]) {
            summaryMap[key] = { gestorName: key, creditCount: 0, totalBalance: 0, totalInstallment: 0 };
        }
        summaryMap[key].creditCount++;
        summaryMap[key].totalBalance += item.remainingBalance;
        summaryMap[key].totalInstallment += item.installmentAmount;
    });

    return { detailed, summary: Object.values(summaryMap) };
}


export async function generateColocacionVsRecuperacionReport(filters: ReportFilters): Promise<ColocacionRecuperacionItem[]> {
    const { dateFrom, dateTo, sucursales, users } = filters;

    let userNamesToFilter: string[] = [];
    if (users && users.length > 0) {
        const placeholders = users.map(() => '?').join(',');
        const userNamesResult: any[] = await query(`SELECT fullName FROM users WHERE id IN (${placeholders})`, users);
        userNamesToFilter = userNamesResult.map(u => u.fullName);
    }

    const allUsersSql = `SELECT id, fullName, sucursal_name, supervisor_name FROM users WHERE active = true`;
    let userRows: any[] = await query(allUsersSql, []);

    if (sucursales && sucursales.length > 0) {
        const placeholders = sucursales.map(() => '?').join(',');
        const sucursalNamesResult: any[] = await query(`SELECT name FROM sucursales WHERE id IN (${placeholders})`, sucursales);
        const sucursalNamesToFilter = sucursalNamesResult.map(s => s.name);
        userRows = userRows.filter(u => sucursalNamesToFilter.includes(u.sucursal_name));
    }

    const reportMap: Record<string, ColocacionRecuperacionItem> = {};
    userRows.forEach(u => {
        reportMap[u.fullName] = {
            userName: u.fullName,
            sucursalName: u.sucursal_name || 'Sin Sucursal',
            supervisorName: u.supervisor_name || 'OFICINA',
            recuperacion: 0,
            colocacion: 0,
            diferencia: 0,
            desembolsos: 0,
            ultimaCuota: undefined
        };
    });

    let recuperacionSql = `SELECT pr.managedBy, SUM(pr.amount) as total, MAX(pr.paymentDate) as lastDate FROM payments_registered pr WHERE pr.status != 'ANULADO'`;
    const recuperacionParams: any[] = [];
    if (dateFrom) { recuperacionSql += ' AND pr.paymentDate >= ?'; recuperacionParams.push(getReportDateStart(dateFrom)); }
    if (dateTo) { recuperacionSql += ' AND pr.paymentDate <= ?'; recuperacionParams.push(getReportDateEnd(dateTo)); }
    recuperacionSql += ' GROUP BY pr.managedBy';
    const recuperacionRows: any[] = await query(recuperacionSql, recuperacionParams);

    recuperacionRows.forEach(row => {
        if (reportMap[row.managedBy]) {
            reportMap[row.managedBy].recuperacion = row.total;
            reportMap[row.managedBy].ultimaCuota = toISOString(row.lastDate) || '';
        }
    });

    let colocacionSql = `SELECT collectionsManager, SUM(principalAmount) as total, COUNT(id) as count FROM credits WHERE status IN ('Active', 'Paid')`;
    const colocacionParams: any[] = [];
    if (dateFrom) { colocacionSql += ' AND deliveryDate >= ?'; colocacionParams.push(getReportDateStart(dateFrom)); }
    if (dateTo) { colocacionSql += ' AND deliveryDate <= ?'; colocacionParams.push(getReportDateEnd(dateTo)); }
    colocacionSql += ' GROUP BY collectionsManager';
    const colocacionRows: any[] = await query(colocacionSql, colocacionParams);

    colocacionRows.forEach(row => {
        if (reportMap[row.collectionsManager]) {
            reportMap[row.collectionsManager].colocacion = row.total;
            reportMap[row.collectionsManager].desembolsos = row.count;
        }
    });

    let finalReport = Object.values(reportMap);
    finalReport.forEach(item => item.diferencia = item.colocacion - item.recuperacion);

    if (userNamesToFilter.length > 0) {
        finalReport = finalReport.filter(item => userNamesToFilter.includes(item.userName));
    }

    return finalReport.filter(item => item.recuperacion > 0 || item.colocacion > 0 || Object.keys(reportMap).includes(item.userName));
}


export async function generatePercentPaidReport(filters: ReportFilters): Promise<PercentPaidItem[]> {
    let sql = `
    SELECT
      c.id as creditId,
      c.creditNumber,
      c.clientName,
      c.branchName as sucursalName,
      c.supervisor as supervisorName,
      c.collectionsManager as gestorName,
      c.totalAmount,
      IFNULL(p.totalPaid, 0) as paidAmount,
      (IFNULL(p.totalPaid, 0) / c.totalAmount * 100) as paidPercentage
    FROM credits c
    LEFT JOIN (
      SELECT creditId, SUM(amount) as totalPaid
      FROM payments_registered
      WHERE status != 'ANULADO'
      GROUP BY creditId
    ) p ON c.id = p.creditId
    WHERE c.status = 'Active' AND c.totalAmount > 0
  `;
    const params: any[] = [];

    if (filters.sucursales && filters.sucursales.length > 0) {
        const sucursalPlaceholders = filters.sucursales.map(() => '?').join(',');
        const sucursalNamesResult: any = await query(`SELECT name FROM sucursales WHERE id IN (${sucursalPlaceholders})`, filters.sucursales);
        if (Array.isArray(sucursalNamesResult) && sucursalNamesResult.length > 0) {
            const sucursalNames = sucursalNamesResult.map(s => s.name);
            const namePlaceholders = sucursalNames.map(() => '?').join(',');
            sql += ` AND c.branchName IN (${namePlaceholders})`;
            params.push(...sucursalNames);
        }
    }

    if (filters.users && filters.users.length > 0) {
        const userPlaceholders = filters.users.map(() => '?').join(',');
        const userNamesResult: any = await query(`SELECT fullName FROM users WHERE id IN (${userPlaceholders})`, filters.users);
        if (Array.isArray(userNamesResult) && userNamesResult.length > 0) {
            const userNames = userNamesResult.map(u => u.fullName);
            const namePlaceholders = userNames.map(() => '?').join(',');
            sql += ` AND c.collectionsManager IN (${namePlaceholders})`;
            params.push(...userNames);
        }
    }

    const results = await query(sql, params);
    return results as PercentPaidItem[];
}

export async function generateNonRenewedReport(filters: ReportFilters): Promise<NonRenewedCreditItem[]> {
    let paidCreditsSql = `
        SELECT 
            c.id as creditId,
            c.creditNumber,
            c.clientId,
            c.clientName,
            cl.clientNumber as clientCode,
            c.currencyType,
            c.amount,
            c.totalAmount,
            c.interestRate,
            c.paymentFrequency,
            c.termMonths,
            c.dueDate,
            c.collectionsManager as gestorName,
            MAX(pr.paymentDate) as cancellationDate
        FROM credits c
        JOIN clients cl ON c.clientId = cl.id
        LEFT JOIN payments_registered pr ON c.id = pr.creditId AND pr.status != 'ANULADO'
        WHERE c.status = 'Paid'
    `;
    const params: any[] = [];
    if (filters.dateFrom) {
        paidCreditsSql += ` AND pr.paymentDate >= ?`;
        params.push(`${filters.dateFrom} 00:00:00`);
    }
    if (filters.dateTo) {
        paidCreditsSql += ` AND pr.paymentDate <= ?`;
        params.push(`${filters.dateTo} 23:59:59`);
    }
    paidCreditsSql += ` GROUP BY c.id`;

    const paidCredits = await query(paidCreditsSql, params) as any[];

    if (paidCredits.length === 0) return [];

    const clientIds = [...new Set(paidCredits.map(c => c.clientId))];

    if (clientIds.length === 0) return [];

    const placeholders = clientIds.map(() => '?').join(',');
    const activeCreditsSql = `SELECT clientId FROM credits WHERE status = 'Active' AND clientId IN (${placeholders})`;
    const activeCreditsResult = await query(activeCreditsSql, [...clientIds]) as any[];
    const renewedClientIds = new Set(activeCreditsResult.map(c => c.clientId));

    const nonRenewedCredits = paidCredits
        .filter(c => !renewedClientIds.has(c.clientId))
        .map(c => ({
            ...c,
            cancellationDate: c.cancellationDate ? toISOString(c.cancellationDate) || c.dueDate : c.dueDate,
        }));

    return nonRenewedCredits as NonRenewedCreditItem[];
}

export async function generateProvisioningReport(): Promise<ProvisionCredit[]> {
    const credits: any[] = await query(`
        SELECT 
            c.id, c.creditNumber, c.clientName, c.totalAmount, c.collectionsManager as gestorName
        FROM credits c
        WHERE c.status = 'Active'
    `);

    const results: ProvisionCredit[] = [];

    for (const credit of credits) {
        const payments: any[] = await query(`SELECT * FROM payments_registered WHERE creditId = ? AND status != 'ANULADO'`, [credit.id]);
        const paymentPlan: any[] = await query(`SELECT * FROM payment_plan WHERE creditId = ?`, [credit.id]);

        const fullCreditDetails: CreditDetail = {
            ...credit,
            paymentPlan,
            registeredPayments: payments,
        };

        const statusDetails = calculateCreditStatusDetails(fullCreditDetails);
        const { category } = getProvisionCategory(statusDetails.lateDays);
        const provisionRate = PROVISION_RULES[category].rate;
        const provisionAmount = statusDetails.remainingBalance * provisionRate;

        results.push({
            id: credit.id,
            creditNumber: credit.creditNumber,
            clientName: credit.clientName,
            gestorName: credit.gestorName,
            remainingBalance: statusDetails.remainingBalance,
            lateDays: statusDetails.lateDays,
            provisionCategory: category,
            provisionAmount,
        });
    }

    return results;
}

export async function generateOverdueCreditsReport(filters: ReportFilters): Promise<OverdueCreditItem[]> {
    const { sucursales, users, dateTo } = filters;
    const timeZone = 'America/Managua';

    // Si se proporciona dateTo, usa el final de ese día.
    // De lo contrario, usa la fecha y hora actual.
    const asOfDate = dateTo ? `${dateTo} 23:59:59` : nowInNicaragua();

    let creditsSql = `
        SELECT 
            c.id, c.creditNumber, c.clientId, c.clientName, c.deliveryDate, c.dueDate, c.totalInstallmentAmount, c.totalAmount, c.principalAmount,
            c.collectionsManager as gestorName,
            cl.department, cl.municipality, cl.neighborhood, cl.address, cl.phone as clientPhone,
            c.branchName
        FROM credits c
        JOIN clients cl ON c.clientId = cl.id
        WHERE c.status = 'Active'
    `;
    const params: any[] = [];

    if (sucursales && sucursales.length > 0) {
        const sucursalNamesResult: any[] = await query(`SELECT name FROM sucursales WHERE id IN (${sucursales.map(() => '?').join(',')})`, [...sucursales]);
        if (sucursalNamesResult.length > 0) {
            const sucursalNames = sucursalNamesResult.map(s => s.name);
            creditsSql += ` AND c.branchName IN (${sucursalNames.map(() => '?').join(',')})`;
            params.push(...sucursalNames);
        }
    }

    if (users && users.length > 0) {
        const userNamesResult: any[] = await query(`SELECT fullName FROM users WHERE id IN (${users.map(() => '?').join(',')})`, [...users]);
        if (userNamesResult.length > 0) {
            const userNames = userNamesResult.map(u => u.fullName);
            creditsSql += ` AND c.collectionsManager IN (${userNames.map(() => '?').join(',')})`;
            params.push(...userNames);
        }
    }

    const activeCredits: any[] = await query(creditsSql, params);

    const overdueItems: OverdueCreditItem[] = [];

    for (const credit of activeCredits) {
        const [paymentPlan, registeredPayments]: [any, any] = await Promise.all([
            query('SELECT * FROM payment_plan WHERE creditId = ?', [credit.id]),
            query('SELECT * FROM payments_registered WHERE creditId = ? AND status != "ANULADO"', [credit.id]),
        ]);

        const fullCreditDetails = { ...credit, paymentPlan, registeredPayments };
        const statusDetails = calculateCreditStatusDetails(fullCreditDetails, asOfDate);

        if (statusDetails.remainingBalance <= 0.01) continue;

        let type: 'D' | 'M' | 'V' | null = null;
        let installmentAmountForReport = 0;
        let overdueAmountForReport = 0;

        // Corrected classification logic
        if (statusDetails.isExpired) {
            type = 'V';
            installmentAmountForReport = 0;
            overdueAmountForReport = statusDetails.remainingBalance;
        } else if (statusDetails.isDueToday) {
            type = 'D';
            installmentAmountForReport = statusDetails.dueTodayAmount;
            overdueAmountForReport = statusDetails.overdueAmount;
        } else if (statusDetails.overdueAmount > 0) {
            type = 'M';
            installmentAmountForReport = 0;
            overdueAmountForReport = statusDetails.overdueAmount;
        }

        if (type) {
            overdueItems.push({
                creditId: credit.id,
                creditNumber: credit.creditNumber,
                clientName: credit.clientName,
                clientAddress: [credit.department, credit.municipality, credit.neighborhood, credit.address].filter(Boolean).join(', '),
                clientPhone: credit.clientPhone,
                deliveryDate: toISOString(credit.deliveryDate) || '',
                dueDate: toISOString(credit.dueDate) || '',
                installmentAmount: installmentAmountForReport,
                overdueAmount: overdueAmountForReport,
                lateDays: statusDetails.lateDays,
                lateFee: statusDetails.currentLateFee,
                totalToPay: installmentAmountForReport + overdueAmountForReport + statusDetails.currentLateFee,
                lastPaymentDate: statusDetails.lastPaymentDate,
                remainingBalance: statusDetails.remainingBalance,
                type,
                gestorName: credit.gestorName || 'Sin Asignar',
            });
        }
    }

    return overdueItems;
}
export async function generateExpiredCreditsReport(filters: ReportFilters): Promise<ExpiredCreditItem[]> {
    const { dateFrom, dateTo, sucursales, users } = filters;

    let sql = `
        SELECT 
            c.id as creditId, c.clientName, cl.phone as clientPhone, c.disbursedAmount,
            c.deliveryDate, c.dueDate, c.totalAmount, c.branchName as sucursalName,
            c.supervisor as supervisorName, c.collectionsManager as gestorName, c.principalAmount
        FROM credits c
        JOIN clients cl ON c.clientId = cl.id
        WHERE c.status = 'Active'
    `;
    const params: any[] = [];

    if (dateFrom) {
        sql += ` AND DATE(c.dueDate) >= ?`;
        params.push(dateFrom);
    }
    if (dateTo) {
        sql += ` AND DATE(c.dueDate) <= ?`;
        params.push(dateTo);
    }
    // If no date range is given, find all credits that are already expired as of today (in Managua).
    if (!dateFrom && !dateTo) {
        const todayInManagua = todayInNicaragua();
        sql += ` AND DATE(c.dueDate) < ?`;
        params.push(todayInManagua);
    }

    if (sucursales && sucursales.length > 0) {
        const sucursalNamesResult: any = await query(`SELECT name FROM sucursales WHERE id IN (${sucursales.map(() => '?').join(',')})`, [...sucursales]);
        if (sucursalNamesResult.length > 0) {
            const sucursalNames = sucursalNamesResult.map((s: { name: string }) => s.name);
            sql += ` AND c.branchName IN (${sucursalNames.map(() => '?').join(',')})`;
            params.push(...sucursalNames);
        }
    }

    if (users && users.length > 0) {
        const userNamesResult: any = await query(`SELECT fullName FROM users WHERE id IN (${users.map(() => '?').join(',')})`, [...users]);
        if (userNamesResult.length > 0) {
            const userNames = userNamesResult.map((u: { fullName: string }) => u.fullName);
            sql += ` AND c.collectionsManager IN (${userNames.map(() => '?').join(',')})`;
            params.push(...userNames);
        }
    }

    const credits: any[] = await query(sql, params);

    const detailedResults: ExpiredCreditItem[] = [];

    for (const credit of credits) {
        const [paymentPlan, registeredPayments]: [any, any] = await Promise.all([
            query('SELECT * FROM payment_plan WHERE creditId = ?', [credit.creditId]),
            query('SELECT * FROM payments_registered WHERE creditId = ?', [credit.creditId]),
        ]);

        const fullCreditDetails: CreditDetail = { ...credit, paymentPlan, registeredPayments };
        const statusDetails = calculateCreditStatusDetails(fullCreditDetails);
        const { avgLateDaysForCredit } = calculateAveragePaymentDelay(fullCreditDetails);

        detailedResults.push({
            ...credit,
            deliveryDate: credit.deliveryDate ? new Date(credit.deliveryDate).toISOString() : null,
            dueDate: credit.dueDate ? new Date(credit.dueDate).toISOString() : null,
            overdueAmount: statusDetails.overdueAmount,
            pendingBalance: statusDetails.remainingBalance,
            totalBalance: statusDetails.remainingBalance,
            avgLateDaysForCredit: avgLateDaysForCredit,
            globalAvgLateDays: 0, // Placeholder
        });
    }

    return detailedResults;
}

export async function generateConsolidatedStatement(clientId: string): Promise<ConsolidatedStatementData | null> {
    const clientResult: any[] = await query('SELECT * FROM clients WHERE id = ?', [clientId]);
    if (!clientResult.length) {
        return null;
    }
    const client: Client = clientResult[0];

    const credits: CreditDetail[] = await query('SELECT id, clientId, amount, status, deliveryDate, firstPaymentDate FROM credits WHERE clientId = ? LIMIT 50', [clientId]);

    const creditCount = credits.length;
    const totalCreditAmount = credits.reduce((sum, credit) => sum + credit.amount, 0);
    const averageCreditAmount = creditCount > 0 ? totalCreditAmount / creditCount : 0;

    // This is a simplified calculation for demonstration. A real implementation would be more complex.
    const globalAverageLateDays = 0;

    const comercianteInfo: any[] = await query('SELECT economicActivity FROM comerciante_info WHERE clientId = ?', [clientId]);
    const economicActivity = comercianteInfo.length > 0 ? comercianteInfo[0].economicActivity : 'No especificada';


    const formattedCredits = credits.map(credit => {
        const { deliveryDate, dueDate, applicationDate, approvalDate, firstPaymentDate, ...rest } = credit;
        return {
            ...rest,
            deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : '',
            dueDate: dueDate ? new Date(dueDate).toISOString() : '',
            applicationDate: applicationDate ? new Date(applicationDate).toISOString() : '',
            approvalDate: approvalDate ? new Date(approvalDate).toISOString() : null,
            firstPaymentDate: firstPaymentDate ? new Date(firstPaymentDate).toISOString() : '',
        };
    });

    return {
        client,
        credits: formattedCredits,
        creditCount,
        averageCreditAmount,
        globalAverageLateDays,
        economicActivity,
    };
}

export async function generateDisbursementsReport(filters: ReportFilters): Promise<DisbursementItem[]> {
    let sql = `
        SELECT 
            c.id as creditId,
            c.creditNumber,
            c.clientName,
            c.deliveryDate,
            c.disbursedBy,
            c.disbursedAmount as amount,
            c.interestRate,
            c.termMonths
        FROM credits c
        WHERE c.status IN ('Active', 'Paid', 'Expired', 'Fallecido') AND c.disbursedAmount > 0
    `;
    const params: any[] = [];

    if (filters.dateFrom) {
        sql += ' AND c.deliveryDate >= ?';
        params.push(getReportDateStart(filters.dateFrom));
    }
    if (filters.dateTo) {
        sql += ' AND c.deliveryDate <= ?';
        params.push(getReportDateEnd(filters.dateTo));
    }

    if (filters.sucursales && filters.sucursales.length > 0) {
        const placeholders = filters.sucursales.map(() => '?').join(',');
        const sucursalNamesResult: any = await query(`SELECT name FROM sucursales WHERE id IN (${placeholders})`, filters.sucursales);
        if (Array.isArray(sucursalNamesResult) && sucursalNamesResult.length > 0) {
            const sucursalNames = sucursalNamesResult.map(s => s.name);
            const namePlaceholders = sucursalNames.map(() => '?').join(',');
            sql += ` AND c.branchName IN (${namePlaceholders})`;
            params.push(...sucursalNames);
        }
    }

    if (filters.users && filters.users.length > 0) {
        const placeholders = filters.users.map(() => '?').join(',');
        const userNamesResult: any = await query(`SELECT fullName FROM users WHERE id IN (${placeholders})`, filters.users);
        if (Array.isArray(userNamesResult) && userNamesResult.length > 0) {
            const userNames = userNamesResult.map(u => u.fullName);
            const namePlaceholders = userNames.map(() => '?').join(',');
            sql += ` AND c.disbursedBy IN (${namePlaceholders})`;
            params.push(...userNames);
        }
    }

    sql += ' ORDER BY c.deliveryDate DESC';

    const results = await query(sql, params);

    return results.map((row: any) => ({
        ...row,
        deliveryDate: row.deliveryDate ? new Date(row.deliveryDate).toISOString() : null,
    })) as DisbursementItem[];
}

export async function generatePaymentsDetailReport(filters: ReportFilters): Promise<PaymentDetailReportData> {
    const { sucursales, users, dateFrom, dateTo } = filters;
    let sql = `
        SELECT
            pr.transactionNumber,
            pr.paymentDate,
            cr.clientName,
            cl.clientNumber as clientCode,
            pr.managedBy as gestorName,
            pr.amount as paidAmount,
            cr.principalAmount,
            cr.totalAmount,
            cr.currencyType as currency,
            u.sucursal_name,
            cr.id as creditId
        FROM payments_registered pr
        JOIN credits cr ON pr.creditId = cr.id
        JOIN clients cl ON cr.clientId = cl.id
        LEFT JOIN users u ON pr.managedBy = u.fullName
        WHERE pr.status != 'ANULADO'
    `;
    const params: any[] = [];

    if (dateFrom) { sql += ` AND pr.paymentDate >= ?`; params.push(`${dateFrom} 00:00:00`); }
    if (dateTo) { sql += ` AND pr.paymentDate <= ?`; params.push(`${dateTo} 23:59:59`); }

    sql += ' ORDER BY pr.paymentDate DESC LIMIT 1000'; // Limitar a 1000 registros para evitar sobrecarga

    let payments = await query(sql, params) as any[];

    if (sucursales && sucursales.length > 0) {
        const sucursalNamesResult: any = await query(`SELECT name FROM sucursales WHERE id IN (${sucursales.map(() => '?').join(',')})`, [...sucursales]);
        if (sucursalNamesResult.length > 0) {
            const names = sucursalNamesResult.map((s: { name: string }) => s.name);
            payments = payments.filter(p => names.includes(p.sucursal_name));
        }
    }

    if (users && users.length > 0) {
        const userNamesResult: any = await query(`SELECT fullName FROM users WHERE id IN (${users.map(() => '?').join(',')})`, [...users]);
        if (userNamesResult.length > 0) {
            const names = userNamesResult.map((u: { fullName: string }) => u.fullName);
            payments = payments.filter(p => names.includes(p.gestorName));
        }
    }

    // Stats calculation - Optimizado para evitar múltiples consultas
    let totalPaid = 0, dueTodayCapital = 0, dueTodayInterest = 0, overdue = 0, expired = 0, advance = 0;
    const clientsPaid = new Set<string>();

    // Obtener todos los créditos únicos de una sola vez
    const uniqueCreditIds = [...new Set(payments.map(p => p.creditId))];
    const creditsMap = new Map<string, any>();

    // Limitar el número de créditos procesados para evitar sobrecarga
    const limitedCreditIds = uniqueCreditIds.slice(0, 100);

    for (const creditId of limitedCreditIds) {
        try {
            const credit = await getCredit(creditId);
            if (credit) {
                creditsMap.set(creditId, credit);
            }
        } catch (error) {
            console.error(`Error loading credit ${creditId}:`, error);
            // Continuar con el siguiente crédito en caso de error
        }
    }

    for (const p of payments) {
        totalPaid += p.paidAmount;
        clientsPaid.add(p.clientCode);

        const credit = creditsMap.get(p.creditId);
        if (!credit) continue;

        const paymentsBeforeThis = (credit.registeredPayments || []).filter((rp: { paymentDate: string }) => new Date(rp.paymentDate) < new Date(p.paymentDate));
        const creditStateBefore = { ...credit, registeredPayments: paymentsBeforeThis };
        const statusBefore = calculateCreditStatusDetails(creditStateBefore, p.paymentDate);

        let remainingPayment = p.paidAmount;

        if (statusBefore.isExpired) {
            expired += remainingPayment;
            continue;
        }

        const paidToOverdue = Math.min(remainingPayment, statusBefore.overdueAmount);
        overdue += paidToOverdue;
        remainingPayment -= paidToOverdue;

        if (remainingPayment > 0) {
            const paidToDueToday = Math.min(remainingPayment, statusBefore.dueTodayAmount);
            const principalRatio = credit.totalAmount > 0 ? credit.principalAmount / credit.totalAmount : 0;
            dueTodayCapital += paidToDueToday * principalRatio;
            dueTodayInterest += paidToDueToday * (1 - principalRatio);
            remainingPayment -= paidToDueToday;
        }

        if (remainingPayment > 0) {
            advance += remainingPayment;
        }
    }

    const detailed: PaymentDetailItem[] = payments.map(p => {
        const principalRatio = p.totalAmount > 0 ? p.principalAmount / p.totalAmount : 0;
        return {
            transactionNumber: p.transactionNumber,
            paymentDate: new Date(p.paymentDate).toISOString(),
            clientName: p.clientName,
            clientCode: p.clientCode,
            gestorName: p.gestorName,
            paidAmount: p.paidAmount,
            capitalPaid: p.paidAmount * principalRatio,
            interestPaid: p.paidAmount * (1 - principalRatio),
            currency: p.currency,
        };
    });

    const summaryMap: Record<string, PaymentDetailSummaryItem> = {};
    detailed.forEach(item => {
        if (!summaryMap[item.gestorName]) {
            summaryMap[item.gestorName] = { gestorName: item.gestorName, paymentCount: 0, totalPaid: 0 };
        }
        summaryMap[item.gestorName].paymentCount++;
        summaryMap[item.gestorName].totalPaid += item.paidAmount;
    });

    return {
        detailed,
        summary: Object.values(summaryMap),
        stats: { totalPaid, dueTodayCapital, dueTodayInterest, overdue, expired, advance, totalClients: clientsPaid.size }
    };
}
export async function generateRecoveryReport(filters: ReportFilters): Promise<RecoveryReportItem[]> {
    const { sucursales, users, dateFrom, dateTo } = filters;
    let userFilterSql = '';
    const userParams: any[] = [];

    if (users && users.length > 0) {
        userFilterSql = `AND u.id IN (${users.map(() => '?').join(',')})`;
        userParams.push(...users);
    } else if (sucursales && sucursales.length > 0) {
        userFilterSql = `AND u.sucursal_id IN (${sucursales.map(() => '?').join(',')})`;
        userParams.push(...sucursales);
    }

    const userRows: any[] = await query(`SELECT id, fullName FROM users u WHERE u.active = true ${userFilterSql}`, userParams);

    const report: RecoveryReportItem[] = [];

    for (const user of userRows) {
        // Meta de Cobro
        let expectedAmountSql = `
            SELECT SUM(pp.amount) as total
            FROM payment_plan pp
            JOIN credits c ON pp.creditId = c.id
            WHERE c.collectionsManager = ? AND c.status = 'Active'
        `;
        const expectedParams: any[] = [user.fullName];
        if (dateFrom) { expectedAmountSql += ` AND pp.paymentDate >= ?`; expectedParams.push(dateFrom); }
        if (dateTo) { expectedAmountSql += ` AND pp.paymentDate <= ?`; expectedParams.push(dateTo); }

        const expectedResult: any[] = await query(expectedAmountSql, expectedParams);
        const expectedAmount = expectedResult[0]?.total || 0;

        // Monto Recuperado
        let collectedAmountSql = `SELECT SUM(amount) as total FROM payments_registered WHERE managedBy = ? AND status != 'ANULADO'`;
        const collectedParams: any[] = [user.fullName];
        if (dateFrom) { collectedAmountSql += ` AND paymentDate >= ?`; collectedParams.push(`${dateFrom} 00:00:00`); }
        if (dateTo) { collectedAmountSql += ` AND paymentDate <= ?`; collectedParams.push(`${dateTo} 23:59:59`); }

        const collectedResult: any[] = await query(collectedAmountSql, collectedParams);
        const collectedAmount = collectedResult[0]?.total || 0;

        // # Créditos
        const creditCountResult: any[] = await query(`SELECT COUNT(id) as total FROM credits WHERE collectionsManager = ? AND status = 'Active'`, [user.fullName]);
        const creditCount = creditCountResult[0]?.total || 0;

        if (creditCount > 0 || collectedAmount > 0) {
            report.push({
                gestorName: user.fullName,
                creditCount,
                expectedAmount,
                collectedAmount,
                recoveryPercentage: expectedAmount > 0 ? (collectedAmount / expectedAmount) * 100 : 0,
            });
        }
    }

    return report;
}
export async function generateFutureInstallmentsReport(filters: ReportFilters): Promise<FutureInstallmentsReportData> {
    const { dateFrom, dateTo, sucursales, users } = filters;

    let sql = `
        SELECT 
            c.id as creditId, 
            c.creditNumber, 
            c.clientName, 
            c.collectionsManager as gestorName,
            c.branchName as sucursalName,
            p.paymentDate,
            p.principal,
            p.interest,
            p.amount
        FROM credits c
        JOIN payment_plan p ON c.id = p.creditId
        WHERE c.status = 'Active'
    `;
    const params: any[] = [];

    if (dateFrom) {
        sql += ` AND p.paymentDate >= ?`;
        params.push(dateFrom);
    }
    if (dateTo) {
        sql += ` AND p.paymentDate <= ?`;
        params.push(dateTo);
    }

    if (sucursales && sucursales.length > 0) {
        const sucursalNamesResult: any = await query(`SELECT name FROM sucursales WHERE id IN (${sucursales.map(() => '?').join(',')})`, [...sucursales]);
        if (Array.isArray(sucursalNamesResult) && sucursalNamesResult.length > 0) {
            const sucursalNames = sucursalNamesResult.map(s => s.name);
            sql += ` AND c.branchName IN (${sucursalNames.map(() => '?').join(',')})`;
            params.push(...sucursalNames);
        }
    }

    if (users && users.length > 0) {
        const userNamesResult: any = await query(`SELECT fullName FROM users WHERE id IN (${users.map(() => '?').join(',')})`, [...users]);
        if (Array.isArray(userNamesResult) && userNamesResult.length > 0) {
            const userNames = userNamesResult.map(u => u.fullName);
            sql += ` AND c.collectionsManager IN (${userNames.map(() => '?').join(',')})`;
            params.push(...userNames);
        }
    }

    const installments = await query(sql, params);

    const detailedMap: Record<string, any> = {};
    installments.forEach((inst: any) => {
        if (!detailedMap[inst.creditId]) {
            detailedMap[inst.creditId] = {
                creditId: inst.creditId,
                creditNumber: inst.creditNumber,
                clientName: inst.clientName,
                gestorName: inst.gestorName || 'Sin Asignar',
                installmentsInRange: 0,
                capitalInRange: 0,
                interestInRange: 0,
                totalAmountInRange: 0,
            };
        }
        detailedMap[inst.creditId].installmentsInRange++;
        detailedMap[inst.creditId].capitalInRange += inst.principal;
        detailedMap[inst.creditId].interestInRange += inst.interest;
        detailedMap[inst.creditId].totalAmountInRange += inst.amount;
    });

    const detailed = Object.values(detailedMap);

    const summaryMap: Record<string, any> = {};
    detailed.forEach(item => {
        const key = item.gestorName;
        if (!summaryMap[key]) {
            summaryMap[key] = {
                gestorName: key,
                creditCount: 0,
                totalAmount: 0,
            };
        }
        summaryMap[key].creditCount++;
        summaryMap[key].totalAmount += item.totalAmountInRange;
    });

    return { detailed, summary: Object.values(summaryMap) };
}

export async function generateRejectionAnalysisReport(filters: ReportFilters): Promise<RejectionAnalysisItem[]> {
    const { sucursales, users, dateFrom, dateTo } = filters;

    let sql = `
        SELECT 
            c.id as creditId,
            c.applicationDate,
            c.clientName,
            c.branchName as sucursalName,
            c.amount,
            c.rejectionReason as reason,
            c.rejectedBy
        FROM credits c
        WHERE c.status = 'Rejected'
    `;
    const params: any[] = [];

    if (dateFrom) {
        sql += ` AND c.applicationDate >= ?`;
        params.push(getReportDateStart(dateFrom));
    }
    if (dateTo) {
        sql += ` AND c.applicationDate <= ?`;
        params.push(getReportDateEnd(dateTo));
    }

    if (sucursales && sucursales.length > 0) {
        const sucursalPlaceholders = sucursales.map(() => '?').join(',');
        const sucursalNamesResult: any = await query(`SELECT name FROM sucursales WHERE id IN (${sucursalPlaceholders})`, sucursales);
        if (Array.isArray(sucursalNamesResult) && sucursalNamesResult.length > 0) {
            const sucursalNames = sucursalNamesResult.map(s => s.name);
            const namePlaceholders = sucursalNames.map(() => '?').join(',');
            sql += ` AND c.branchName IN (${namePlaceholders})`;
            params.push(...sucursalNames);
        }
    }

    if (users && users.length > 0) {
        const userPlaceholders = users.map(() => '?').join(',');
        const userNamesResult: any = await query(`SELECT fullName FROM users WHERE id IN (${userPlaceholders})`, users);
        if (Array.isArray(userNamesResult) && userNamesResult.length > 0) {
            const userNames = userNamesResult.map(u => u.fullName);
            const namePlaceholders = userNames.map(() => '?').join(',');
            sql += ` AND c.rejectedBy IN (${namePlaceholders})`;
            params.push(...userNames);
        }
    }

    sql += ' ORDER BY c.applicationDate DESC';

    const results = await query(sql, params);

    return results.map((row: any) => ({
        ...row,
        applicationDate: row.applicationDate ? new Date(row.applicationDate).toISOString() : null,
    })) as RejectionAnalysisItem[];
}


// --- Excel export functions ---

const createExcelFile = (data: any[], sheetName: string, columns?: { wch: number }[]) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    if (columns) {
        worksheet['!cols'] = columns;
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    return { base64: buffer.toString('base64') };
}

export async function exportSaldosCarteraToExcel(detailedData: SaldosCarteraItem[]): Promise<{ base64: string }> {
    const dataToExport = detailedData.map(c => ({ 'Sucursal': c.sucursalName, 'Gestor': c.gestorName, 'Cliente': c.clientName, 'Saldo Total': c.remainingBalance }));
    return createExcelFile(dataToExport, 'SaldosCartera');
}
export async function exportColocacionToExcel(data: any[]): Promise<{ base64: string }> {
    return createExcelFile(data, 'ColocacionVsRecuperacion');
}
export async function exportDisbursementsToExcel(data: DisbursementItem[]): Promise<{ base64: string }> {
    return createExcelFile(data, 'Desembolsos');
}
export async function exportPaymentsToExcel(data: any[], viewType: 'detailed' | 'summary'): Promise<{ base64: string }> {
    return createExcelFile(data, 'Abonos');
}
export async function exportRejectionsToExcel(data: any[]): Promise<{ base64: string }> {
    return createExcelFile(data, 'Rechazos');
}
export async function exportRecoveryToExcel(data: any[]): Promise<{ base64: string }> {
    return createExcelFile(data, 'MetaCobranza');
}
export async function exportOverdueCreditsToExcel(data: any[]): Promise<{ base64: string }> {
    return createExcelFile(data, 'CarteraEnMora');
}
export async function exportPercentPaidToExcel(data: PercentPaidItem[]): Promise<{ base64: string }> {
    const dataToExport = data.map(item => ({
        'Cliente': item.clientName,
        'Credito No.': item.creditNumber,
        'Monto Total': item.totalAmount,
        'Total Pagado': item.paidAmount,
        '% Pagado': item.paidPercentage.toFixed(2)
    }));
    return createExcelFile(dataToExport, 'PorcentajePagado');
}
export async function exportProvisioningToExcel(data: ProvisionCredit[]): Promise<{ base64: string }> {
    const dataToExport = data.map(item => ({
        'Credito No.': item.creditNumber,
        'Cliente': item.clientName,
        'Gestor': item.gestorName,
        'Saldo': item.remainingBalance,
        'Dias Atraso': item.lateDays,
        'Categoria': item.provisionCategory,
        'Monto Provisionado': item.provisionAmount
    }));
    return createExcelFile(dataToExport, 'Provisiones');
}
