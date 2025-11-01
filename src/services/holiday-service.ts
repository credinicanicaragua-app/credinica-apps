
'use server';

import { query } from '@/lib/mysql';
import type { Holiday, User } from '@/lib/types';
import { format } from 'date-fns';
import { createLog } from './audit-log-service';
import { revalidatePath } from 'next/cache';

export const getHolidays = async (): Promise<Holiday[]> => {
    const rows: any = await query('SELECT * FROM holidays ORDER BY date ASC');
    // Asegurarse de que la fecha se devuelve en formato 'YYYY-MM-DD' para consistencia
    return rows.map((row: any) => ({
        ...row,
        date: format(new Date(row.date), 'yyyy-MM-dd')
    }));
};

export const addHoliday = async (holidayData: Omit<Holiday, 'id'>, actor: User): Promise<{ success: boolean, id?: string, error?: string }> => {
    try {
        const newId = `hol_${Date.now()}`;
        await query('INSERT INTO holidays (id, name, date) VALUES (?, ?, ?)', [newId, holidayData.name, holidayData.date]);
        await createLog(actor, 'settings:holiday_add', `Agregó el feriado ${holidayData.name} para la fecha ${holidayData.date}.`, { targetId: newId });
        revalidatePath('/settings/holidays');
        return { success: true, id: newId };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const deleteHoliday = async (id: string, actor: User): Promise<{ success: boolean, error?: string }> => {
    try {
        await query('DELETE FROM holidays WHERE id = ?', [id]);
        await createLog(actor, 'settings:holiday_delete', `Eliminó el feriado con ID ${id}.`, { targetId: id });
        revalidatePath('/settings/holidays');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};
