
'use server';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { getClients as getClientsServer } from '@/services/client-service-server';
import { ClientList } from './components/ClientList';
import { getUser as getUserFromSession } from '@/services/user-service-server';
import { cookies } from 'next/headers';
import { AccessDenied } from '@/components/AccessDenied';
import { decrypt } from '@/app/(auth)/login/actions';

const CREATE_ROLES = ['ADMINISTRADOR', 'OPERATIVO'];

async function getCurrentUser() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return null;

    try {
        const decryptedSession = await decrypt(sessionCookie);
        if (!decryptedSession?.userId) return null;
        const user = await getUserFromSession(decryptedSession.userId);
        return user;
    } catch (error) {
        console.error("Error getting user from session:", error);
        return null;
    }
}


export default async function ClientsPage({ searchParams }: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const searchTerm = typeof params?.search === 'string' ? params.search : '';

  if (!user) {
    return <AccessDenied />;
  }

  const { clients, reloanClients = [], renewalClients = [], allGestorClients = [] } = await getClientsServer({ user, searchTerm });

  const isGestorRole = user.role === 'GESTOR';
  const canCreate = CREATE_ROLES.includes(user.role.toUpperCase());
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">
            {isGestorRole ? `Mi Cartera (${allGestorClients.length})` : `Cartera de Clientes (${clients.length})`}
        </h2>
        {canCreate && !isGestorRole && (
            <Button asChild>
              <Link href="/clients/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Agregar Cliente
              </Link>
            </Button>
        )}
      </div>
      <ClientList 
        initialClients={isGestorRole ? allGestorClients : clients}
        initialReloanClients={reloanClients}
        initialRenewalClients={renewalClients}
        isGestor={isGestorRole}
        user={user}
      />
    </div>
  );
}
