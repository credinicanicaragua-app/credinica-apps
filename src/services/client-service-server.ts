
'use server';

import { query, getNextSequenceValue } from '@/lib/mysql';
import type { Client, AppUser as User, ClientInteraction, CreditDetail } from '@/lib/types';
import { normalizeString, calculateCreditStatusDetails, decodeData, encodeData } from '@/lib/utils';
import { createLog } from './audit-log-service';
import { revalidatePath } from 'next/cache';
import { getCreditsAdmin, getCredit } from './credit-service-server';
import { getPaidCreditsForGestor } from './portfolio-service';

export async function createClient(
  clientData: Omit<Client, 'id' | 'clientNumber' | 'createdAt'>,
  actor: User,
): Promise<{ success: boolean; clientId?: string; error?: string }> {
  try {
    const newClientId = `cli_${Date.now()}`;
    const sequence = await getNextSequenceValue('clientNumber');
    const clientNumber = `CLI-${String(sequence).padStart(4, '0')}`;
    
    const { name, firstName, lastName, cedula, phone, sex, civilStatus, employmentType, sucursal, sucursalName: providedSucursalName, department, municipality, neighborhood, address, references, asalariadoInfo, comercianteInfo, tags, interactions } = clientData;

    // Fetch sucursal name if not provided
    let finalSucursalName = providedSucursalName;
    if (sucursal && !finalSucursalName) {
        const sucursalResult: any = await query('SELECT name FROM sucursales WHERE id = ?', [sucursal]);
        if (sucursalResult.length > 0) {
            finalSucursalName = sucursalResult[0].name;
        }
    }

    const clientSql = `
        INSERT INTO clients (id, clientNumber, name, firstName, lastName, cedula, phone, sex, civilStatus, employmentType, sucursal_id, sucursal_name, department, municipality, neighborhood, address, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await query(clientSql, [
        newClientId, clientNumber, name, firstName, lastName, encodeData(cedula), phone, sex, civilStatus, employmentType, sucursal, finalSucursalName, department, municipality, neighborhood, address, JSON.stringify(tags || [])
    ]);

    if (employmentType === 'asalariado' && asalariadoInfo) {
      await query('INSERT INTO asalariado_info (clientId, companyName, jobAntiquity, companyAddress) VALUES (?, ?, ?, ?)', [newClientId, asalariadoInfo.companyName, asalariadoInfo.jobAntiquity, asalariadoInfo.companyAddress]);
    } else if (employmentType === 'comerciante' && comercianteInfo) {
      await query('INSERT INTO comerciante_info (clientId, businessAntiquity, businessAddress, economicActivity) VALUES (?, ?, ?, ?)', [newClientId, comercianteInfo.businessAntiquity, comercianteInfo.businessAddress, comercianteInfo.economicActivity]);
    }

    if (references && references.length > 0) {
      for (const ref of references) {
        const newRefId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await query('INSERT INTO personal_references (id, clientId, name, phone, address, relationship) VALUES (?, ?, ?, ?, ?, ?)', 
          [newRefId, newClientId, ref.name, ref.phone, ref.address, ref.relationship]
        );
      }
    }
    
    await createLog(actor, 'client:create', `Creó el cliente ${name} con código ${clientNumber}.`, { targetId: newClientId });
    
    revalidatePath('/clients');
    return { success: true, clientId: newClientId };

  } catch (error: any) {
    console.error("Error al crear el cliente en MySQL:", error);
    return { success: false, error: error.message || 'No se pudo crear el cliente.' };
  }
}

export async function updateClient(
    id: string, 
    clientData: Partial<Client>,
    actor: User
): Promise<{ success: boolean; error?: string }> {
    try {
        const { references, asalariadoInfo, comercianteInfo, tags, interactions, sucursal, sucursalName, ...clientFields } = clientData;

        // Build the dynamic UPDATE query for the main 'clients' table
        const fieldsToUpdate: { [key: string]: any } = { ...clientFields };
        if (sucursal !== undefined) fieldsToUpdate.sucursal_id = sucursal;
        if (sucursalName !== undefined) fieldsToUpdate.sucursal_name = sucursalName;
        
        if (tags !== undefined) {
            fieldsToUpdate['tags'] = JSON.stringify(tags || []);
        }

        if (Object.keys(fieldsToUpdate).length > 0) {
            if (fieldsToUpdate.cedula) {
                fieldsToUpdate.cedula = encodeData(fieldsToUpdate.cedula);
            }
            const updateSetClause = Object.keys(fieldsToUpdate).map(key => `${key} = ?`).join(', ');
            const updateValues = Object.values(fieldsToUpdate);
            await query(`UPDATE clients SET ${updateSetClause} WHERE id = ?`, [...updateValues, id]);
        }

      // Handle related tables with a "delete and re-insert" strategy
      await query('DELETE FROM asalariado_info WHERE clientId = ?', [id]);
      if (clientFields.employmentType === 'asalariado' && asalariadoInfo) {
          await query('INSERT INTO asalariado_info (clientId, companyName, jobAntiquity, companyAddress) VALUES (?, ?, ?, ?)', [id, asalariadoInfo.companyName, asalariadoInfo.jobAntiquity, asalariadoInfo.companyAddress]);
      }
      
      await query('DELETE FROM comerciante_info WHERE clientId = ?', [id]);
      if (clientFields.employmentType === 'comerciante' && comercianteInfo) {
          await query('INSERT INTO comerciante_info (clientId, businessAntiquity, businessAddress, economicActivity) VALUES (?, ?, ?, ?)', [id, comercianteInfo.businessAntiquity, comercianteInfo.businessAddress, comercianteInfo.economicActivity]);
      }
      
      await query('DELETE FROM personal_references WHERE clientId = ?', [id]);
      if (references && references.length > 0) {
        for (const ref of references) {
            const newRefId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            await query(
                'INSERT INTO personal_references (id, clientId, name, phone, address, relationship) VALUES (?, ?, ?, ?, ?, ?)',
                [newRefId, id, ref.name, ref.phone, ref.address, ref.relationship]
            );
        }
      }

      await createLog(actor, 'client:update', `Actualizó los datos del cliente ${clientData.name || ''}.`, { targetId: id, details: clientData });
      revalidatePath(`/clients/${id}`);
      revalidatePath('/clients');
      return { success: true };

    } catch (error: any) {
        console.error(`Error al actualizar cliente ${id}:`, error);
        return { success: false, error: 'Ocurrió un error al procesar la solicitud a la base de datos.' };
    }
}


export async function deleteClient(
    clientId: string,
    actor: User,
): Promise<{ success: boolean; error?: string }> {
    try {
        const credits: any = await query('SELECT id FROM credits WHERE clientId = ? LIMIT 1', [clientId]);
        if (credits.length > 0) {
            return { success: false, error: 'No se puede eliminar un cliente con créditos asociados.' };
        }

        // Eliminar de las tablas relacionadas primero para evitar errores de integridad
        await query('DELETE FROM asalariado_info WHERE clientId = ?', [clientId]);
        await query('DELETE FROM comerciante_info WHERE clientId = ?', [clientId]);
        await query('DELETE FROM personal_references WHERE clientId = ?', [clientId]);
        await query('DELETE FROM interactions WHERE clientId = ?', [clientId]);

        await query('DELETE FROM clients WHERE id = ?', [clientId]);
        await createLog(actor, 'client:delete', `Eliminó al cliente con ID ${clientId}.`, { targetId: clientId });

        revalidatePath('/clients');
        return { success: true };

    } catch (error: any) {
        console.error(`Error al eliminar el cliente ${clientId}:`, error);
        return { success: false, error: error.message };
    }
}

export const getClient = async (id: string): Promise<Client | null> => {
    const clientRows: any = await query('SELECT * FROM clients WHERE id = ? LIMIT 1', [id]);
    if (clientRows.length === 0) return null;

    let client = clientRows[0];

    // Decodificar la cédula
    client.cedula = decodeData(client.cedula);

    const [asalariadoRows, comercianteRows, referenceRows, interactionRows]: any = await Promise.all([
        query('SELECT * FROM asalariado_info WHERE clientId = ?', [id]),
        query('SELECT * FROM comerciante_info WHERE clientId = ?', [id]),
        query('SELECT * FROM personal_references WHERE clientId = ?', [id]),
        query('SELECT * FROM interactions WHERE clientId = ? ORDER BY date DESC', [id])
    ]);

    return {
        ...client,
        sucursal: client.sucursal_id,
        sucursalName: client.sucursal_name,
        tags: client.tags && typeof client.tags === 'string' ? JSON.parse(client.tags) : [],
        asalariadoInfo: asalariadoRows[0] || null,
        comercianteInfo: comercianteRows[0] || null,
        references: referenceRows,
        interactions: interactionRows.map((row: any) => ({ ...row, date: new Date(row.date).toISOString() })),
    } as Client;
};

export const getClients = async (options: { searchTerm?: string; user?: User, forSearch?: boolean }): Promise<{ 
    clients: Client[], 
    reloanClients?: Client[], 
    renewalClients?: Client[], 
    allGestorClients?: (Client & { latestCreditId?: string })[] 
}> => {
    const { searchTerm, user, forSearch = false } = options;
    
    // Si es un gestor y está haciendo una búsqueda general, no filtramos por su cartera.
    const isGestorGlobalSearch = user?.role === 'GESTOR' && forSearch;
    
    let baseSql = 'SELECT c.* FROM clients c';
    const params: any[] = [];
    let whereClauses: string[] = [];

    // Lógica de búsqueda principal
    if (searchTerm) {
        whereClauses.push(`(c.name LIKE ? OR c.cedula LIKE ? OR c.clientNumber LIKE ?)`);
        const encodedSearch = encodeData(`%${searchTerm}%`);
        params.push(`%${searchTerm}%`, encodedSearch, `%${searchTerm}%`);
    }

    // Filtrado por rol de usuario
    if (user && !isGestorGlobalSearch) {
        const userRole = user.role.toUpperCase();
        if (userRole === 'GESTOR') {
                const gestorCredits: any[] = await query('SELECT DISTINCT clientId FROM credits WHERE collectionsManager = ?', [user.fullName]);
                const clientIds = gestorCredits.map(c => c.clientId);
                if(clientIds.length > 0) {
                    const placeholders = clientIds.map(() => '?').join(',');
                    whereClauses.push(`c.id IN (${placeholders})`);
                    params.push(...clientIds);
                } else {
                     whereClauses.push('1 = 0');
                }
        } else if (userRole === 'SUPERVISOR') {
            if (user.sucursal) {
                whereClauses.push('c.sucursal_id = ?');
                params.push(user.sucursal);
            }
        }
    }
    
    if (whereClauses.length > 0) {
        baseSql += ' WHERE ' + whereClauses.join(' AND ');
    }
    baseSql += ' ORDER BY c.createdAt DESC';

    const clientRows: any = await query(baseSql, params);
    
    const clients = clientRows.map((c: any) => ({
      ...c,
      sucursal: c.sucursal_id,
      sucursalName: c.sucursal_name,
      cedula: decodeData(c.cedula),
      tags: c.tags && typeof c.tags === 'string' ? JSON.parse(c.tags) : [],
    })) as Client[];
    
    if (user?.role === 'GESTOR' && !forSearch) {
      const { credits: basicActiveCredits } = await getCreditsAdmin({ gestorName: user.fullName, status: 'Active', user });
      const paidCredits = await getPaidCreditsForGestor(user.fullName, 30);

      const activeClientIds = new Set(basicActiveCredits.map(c => c.clientId));
      
      // Obtener créditos completos con pagos para calcular correctamente el porcentaje pagado
      const activeCreditsWithPayments = await Promise.all(
          basicActiveCredits.map(async (credit) => {
              const fullCredit = await getCredit(credit.id);
              return fullCredit;
          })
      );
      
      // Filtrar créditos nulos y luego aplicar la lógica de elegibilidad
      const validCredits = activeCreditsWithPayments.filter((c): c is CreditDetail => c !== null);
      
      const eligibleCredits = validCredits.filter((c) => {
          if (!c) return false;
          const { remainingBalance } = calculateCreditStatusDetails(c);
          const totalPaid = c.totalAmount - remainingBalance;
          const paidPercentage = c.totalAmount > 0 ? (totalPaid / c.totalAmount) * 100 : 0;
          
          // Log para debugging
          console.log(`Cliente ${c.clientName}:`, {
              totalAmount: c.totalAmount,
              remainingBalance: remainingBalance,
              totalPaid: totalPaid,
              paidPercentage: paidPercentage.toFixed(2) + '%',
              eligible: paidPercentage >= 75,
              paymentsCount: c.registeredPayments?.length || 0
          });
          
          return paidPercentage >= 75;
      });

      let reloanClients: Client[] = [];
      if (eligibleCredits.length > 0) {
          const eligibleClientIds = [...new Set(eligibleCredits.map(c => c.clientId))];
          reloanClients = clients.filter(c => eligibleClientIds.includes(c.id));
      }

      const paidClientIds = paidCredits.map((c: any) => c.clientId);
      let renewalClients: Client[] = [];
      if (paidClientIds.length > 0) {
          renewalClients = clients
              .filter(client => paidClientIds.includes(client.id) && !activeClientIds.has(client.id));
      }
          
      const gestorClientIds = new Set(clients.map(c => c.id));
      const allGestorClientsData = clients.filter(c => gestorClientIds.has(c.id)).map(client => {
          const latestCredit = basicActiveCredits.find((ac: any) => ac.clientId === client.id);
          return { ...client, latestCreditId: latestCredit?.id };
      });

      return { clients: [], reloanClients, renewalClients, allGestorClients: allGestorClientsData };
    }

    return { clients };
};

export async function addInteraction(
    clientId: string, 
    interaction: Omit<ClientInteraction, 'id'>, 
    actor: User
): Promise<{success: boolean, error?: string}> {
    try {
        const sql = 'INSERT INTO interactions (clientId, date, user, type, notes) VALUES (?, ?, ?, ?, ?)';
        await query(sql, [clientId, new Date(interaction.date), interaction.user, interaction.type, interaction.notes]);
        
        revalidatePath(`/clients/${clientId}`);
        return { success: true };
    } catch(error: any) {
        console.error(`Error adding interaction for client ${clientId}:`, error);
        return { success: false, error: error.message };
    }
}
