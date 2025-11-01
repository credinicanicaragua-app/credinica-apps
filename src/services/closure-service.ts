
'use server';

import { query } from '@/lib/mysql';
import type { User } from '@/lib/types';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export interface DailyTransaction {
  id: string;
  type: 'Payment' | 'Disbursement';
  amount: number;
  description: string;
  timestamp: string; // ISO string
}

export interface DailyActivitySummary {
    totalActivityAmount: number;
    transactions: DailyTransaction[];
}

export interface DailyActivityReport {
    collections: DailyActivitySummary;
    disbursements: DailyActivitySummary;
}

export async function generateDailyActivityReport(userId: string): Promise<DailyActivityReport> {
    const userResult: any = await query('SELECT fullName FROM users WHERE id = ?', [userId]);
    if (userResult.length === 0) {
        throw new Error('Usuario no encontrado para generar el reporte de actividad.');
    }
    const userName = userResult[0].fullName;

    const timeZone = 'America/Managua';
    const nowInManagua = toZonedTime(new Date(), timeZone);
    const startOfDayInManagua = startOfDay(nowInManagua);
    const endOfDayInManagua = endOfDay(nowInManagua);
    
    // Convertir a UTC para la consulta a la base de datos (MySQL suele trabajar mejor con UTC)
    const startOfDayUTC = fromZonedTime(startOfDayInManagua, timeZone);
    const endOfDayUTC = fromZonedTime(endOfDayInManagua, timeZone);

    const collections: DailyActivitySummary = { totalActivityAmount: 0, transactions: [] };
    const disbursements: DailyActivitySummary = { totalActivityAmount: 0, transactions: [] };

    // Obtener pagos (collections)
    const paymentsSql = `
        SELECT rp.id, rp.amount, c.clientName, rp.paymentDate 
        FROM payments_registered rp
        JOIN credits c ON rp.creditId = c.id
        WHERE rp.managedBy = ? AND rp.paymentDate >= ? AND rp.paymentDate <= ? AND rp.status != 'ANULADO'
    `;
    const paymentRows: any = await query(paymentsSql, [userName, startOfDayUTC, endOfDayUTC]);

    paymentRows.forEach((p: any) => {
        collections.totalActivityAmount += p.amount;
        collections.transactions.push({
            id: p.id,
            type: 'Payment',
            amount: p.amount,
            description: p.clientName,
            timestamp: new Date(p.paymentDate).toISOString(),
        });
    });

    // Obtener desembolsos (disbursements) - CORREGIDO
    // Se usa 'userName' (fullName) para buscar en la columna `disbursedBy`.
    const disbursementsSql = `
        SELECT id, creditNumber, clientName, disbursedAmount, deliveryDate 
        FROM credits 
        WHERE disbursedBy = ? AND deliveryDate >= ? AND deliveryDate <= ? AND status = 'Active'
    `;
    const disbursementRows: any = await query(disbursementsSql, [userName, startOfDayUTC, endOfDayUTC]);

    disbursementRows.forEach((d: any) => {
        disbursements.totalActivityAmount += d.disbursedAmount || 0;
        disbursements.transactions.push({
            id: d.creditNumber,
            type: 'Disbursement',
            amount: d.disbursedAmount || 0,
            description: d.clientName,
            timestamp: new Date(d.deliveryDate).toISOString(),
        });
    });

    return {
        collections,
        disbursements,
    };
}
