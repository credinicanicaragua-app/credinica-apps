

'use client';

import type { CreditDetail, User } from '@/lib/types';
import { getCredit as getCreditServer, updateCredit as updateCreditServer, getClientCredits as getClientCreditsServer } from '@/services/credit-service-server';

/**
 * Obtiene los detalles completos de un crédito, incluyendo los del cliente.
 * Llama a una Server Action que consulta la base de datos.
 */
export const getCredit = async (id: string): Promise<CreditDetail | null> => {
    try {
        const credit = await getCreditServer(id);
        return credit;
    } catch (error) {
        console.error("Error fetching credit (client-side service):", error);
        return null;
    }
};

/**
 * Obtiene todos los créditos asociados a un ID de cliente.
 * Llama a una Server Action.
 */
export async function getClientCredits(clientId: string): Promise<CreditDetail[]> {
    try {
        return await getClientCreditsServer(clientId);
    } catch (error) {
        console.error(`Error fetching credits for client ${clientId}:`, error);
        return [];
    }
}

/**
 * Actualiza un crédito. Llama a una Server Action.
 */
export async function updateCredit(id: string, creditData: Partial<CreditDetail>, actor: User): Promise<{ success: boolean; error?: string }> {
    return updateCreditServer(id, creditData, actor);
}

    
