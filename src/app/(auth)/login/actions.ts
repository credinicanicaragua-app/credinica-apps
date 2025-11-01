
'use server';

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { AppUser } from '@/lib/types';
import { query } from '@/lib/mysql';
import * as bcrypt from 'bcryptjs';

const secretKey = process.env.JWT_SECRET || 'fallback-secret-key-debe-ser-larga-y-segura';
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // Sesión de 1 día
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    // Se espera esto para tokens expirados, así que devolvemos null.
    return null;
  }
}

export async function loginUser(credentials: {email: string; password: string;}): Promise<{success: boolean; error?: string}> {
  const { email, password } = credentials;

  try {
    const rows: any = await query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    
    if (rows.length === 0) {
      console.error(`[Login Fallido] Usuario no encontrado para el email: ${email.toLowerCase()}`);
      return { success: false, error: 'Credenciales incorrectas.' };
    }

    const user = rows[0];

    if (!user.active) {
       console.error(`[Login Fallido] La cuenta de usuario ${email.toLowerCase()} está inactiva.`);
       return { success: false, error: 'La cuenta de usuario está inactiva.' };
    }

    if (!user.hashed_password) {
        console.error(`[Login Fallido] El usuario ${email.toLowerCase()} no tiene una contraseña (hashed_password) en la base de datos.`);
        return { success: false, error: 'Cuenta de usuario corrupta. Contacte al administrador.' };
    }
    
    const passwordsMatch = await bcrypt.compare(password, user.hashed_password);

    if (!passwordsMatch) {
      console.error(`[Login Fallido] La contraseña proporcionada para ${email.toLowerCase()} no coincide con el hash almacenado.`);
      return { success: false, error: 'Credenciales incorrectas.' };
    }
    
    // En este punto, el inicio de sesión es exitoso.
    console.log(`[Login Exitoso] Usuario autenticado: ${email.toLowerCase()}`);
    
    const sessionPayload = {
        userId: user.id,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        mustChangePassword: user.mustChangePassword
    };

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
    const session = await encrypt(sessionPayload);

    (await cookies()).set('session', session, { expires, httpOnly: true });

    return { success: true };

  } catch (error) {
    console.error('[Login Action Error] Error inesperado en el servidor:', error);
    return { success: false, error: 'Error del servidor al intentar iniciar sesión.' };
  }
}

export async function logoutUser() {
  // Invalidar la cookie de sesión
  (await cookies()).set('session', '', { expires: new Date(0) });
}

export async function getSession(): Promise<AppUser | null> {
  const sessionCookie = (await cookies()).get('session')?.value;
  if (!sessionCookie) return null;

  const decryptedSession = await decrypt(sessionCookie);
  if (!decryptedSession?.userId) return null;

  // Obtener el perfil de usuario completo y actualizado de la base de datos
  const userProfile = await getUserProfileFromDatabase(decryptedSession.userId);
  return userProfile;
}

/**
 * Obtiene el perfil de usuario completo de la base de datos.
 * Esto debería usarse para obtener los datos de usuario más actuales, especialmente después de actualizaciones.
 * @param userId El ID del usuario a obtener.
 * @returns El objeto AppUser completo o null si no se encuentra.
 */
async function getUserProfileFromDatabase(userId: string): Promise<AppUser | null> {
    const rows: any = await query('SELECT * FROM users WHERE id = ?', [userId]);
    if(rows.length > 0) {
        // Excluir la contraseña hasheada del objeto devuelto a la sesión del cliente
        const { hashed_password, ...user } = rows[0];
        return user as AppUser;
    }
    return null;
}
