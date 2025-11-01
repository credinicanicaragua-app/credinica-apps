
'use server';

import * as React from 'react';
import { cookies } from 'next/headers';
import { decrypt } from '@/app/(auth)/login/actions';
import { getUser as getUserServerSide } from '@/services/user-service-server';
import { getPortfolioForGestor } from '@/services/portfolio-service';
import { getSucursales } from '@/services/sucursal-service';
import { generateColocacionVsRecuperacionReport } from '@/services/report-service';
import { GlobalDashboard } from '@/app/dashboard/components/AdminDashboard';
import { DefaultDashboard } from '@/app/dashboard/components/DefaultDashboard';
import { GestorDashboard } from './components/GestorDashboard';
import { format } from 'date-fns';

async function getUserFromSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return null;

    try {
        const decryptedSession = await decrypt(sessionCookie);
        if (!decryptedSession?.userId) return null;
        const user = await getUserServerSide(decryptedSession.userId);
        return user;
    } catch (error) {
        console.error("Error getting user from session:", error);
        return null;
    }
}

export default async function DashboardPage() {
    const user = await getUserFromSession();

    if (!user) {
        return <DefaultDashboard user={{ fullName: 'Invitado', role: '' } as any} />;
    }

    const userRole = user.role.toUpperCase();
    const todayNicaragua = format(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Managua' })), 'yyyy-MM-dd');

    switch (userRole) {
        case 'GESTOR': {
            const { portfolio, dailySummary } = await getPortfolioForGestor(user.id);
            return <GestorDashboard user={user} initialPortfolio={portfolio} initialSummary={dailySummary} />;
        }
        case 'SUPERVISOR':
        case 'ADMINISTRADOR':
        case 'GERENTE':
        case 'FINANZAS':
        case 'OPERATIVO': {
            const initialSucursales = await getSucursales();
            
            const sucursalesFilter = (user.role === 'ADMINISTRADOR' || user.role === 'FINANZAS') ? undefined : [user.sucursal || ''];
            
            const initialReportData = await generateColocacionVsRecuperacionReport({
                sucursales: sucursalesFilter,
                dateFrom: todayNicaragua,
                dateTo: todayNicaragua,
            });

            return <GlobalDashboard user={user} initialSucursales={initialSucursales} initialReportData={initialReportData} />;
        }
        default:
            return <DefaultDashboard user={user} />;
    }
}
