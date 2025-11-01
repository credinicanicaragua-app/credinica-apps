
'use server';

import 'server-only';
import mysql from 'mysql2/promise';
import { unstable_noStore as noStore } from 'next/cache';
import { queryLimiter } from './rate-limiter';

// --- IMPLEMENTACIÓN DE SINGLETON PARA EL POOL DE CONEXIONES ---

// 1. Definir una interfaz para la variable global
interface GlobalWithPool {
  mysqlPool?: mysql.Pool;
}

// 2. Usar un alias para el objeto global para asegurar el tipado
const globalWithPool = globalThis as typeof globalThis & GlobalWithPool;

let pool: mysql.Pool;

// 3. Crear o reutilizar el pool
if (process.env.NODE_ENV === 'production') {
  // En producción, es seguro crear el pool una sola vez.
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    maxIdle: 3,
    idleTimeout: 60000,
    decimalNumbers: true,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
} else {
  // En desarrollo, reutilizamos la conexión a través del objeto global para evitar
  // que el Hot Module Replacement (HMR) cree múltiples pools.
  if (!globalWithPool.mysqlPool) {
    globalWithPool.mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      maxIdle: 3,
      idleTimeout: 60000,
      decimalNumbers: true,
      ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
  }
  pool = globalWithPool.mysqlPool;
}

/**
 * Función genérica para ejecutar consultas SQL.
 * Utiliza un pool de conexiones para manejar las conexiones de manera eficiente.
 * `unstable_noStore` se usa para asegurar que los resultados no se almacenen en caché
 * en el Data Cache de Next.js, garantizando datos frescos en cada solicitud.
 */
export async function query(sql: string, params: any[] = []): Promise<any[]> {
  noStore(); // Previene el cacheo de los resultados de la consulta
  
  return queryLimiter.execute(async () => {
    const startTime = Date.now();
    let connection: mysql.PoolConnection | null = null;
    
    try {
      // Obtener conexión del pool con timeout
      connection = await pool.getConnection();
      const [rows] = await connection.execute(sql, params);
      
      const duration = Date.now() - startTime;
      if (duration > 5000) { // Log consultas lentas (>5s)
        console.warn(`Consulta lenta detectada (${duration}ms):`, sql.substring(0, 100));
      }
      
      return rows as any[];
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const limiterStats = queryLimiter.getStats();
      
      console.error('Error en la consulta a MySQL:', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        sql: sql.substring(0, 100),
        duration: `${duration}ms`,
        poolStats: 'Connection pool info not available',
        rateLimiter: limiterStats
      });
      
      // Manejar errores específicos de conexión
      if (error.code === 'ER_CON_COUNT_ERROR' || error.code === 'ECONNREFUSED') {
        throw new Error('El servidor de base de datos está sobrecargado. Intente nuevamente en unos momentos.');
      }
      
      // En desarrollo, lanza el error real para debugging; en producción, usa el genérico
      if (process.env.APP_DEBUG === 'true') {
        throw error;
      } else {
        throw new Error('Ocurrió un error al procesar la solicitud a la base de datos.');
      }
    } finally {
      // Asegurar que la conexión se libere
      if (connection) {
        connection.release();
      }
    }
  });
}


/**
 * Obtiene el siguiente valor de un contador de secuencia de la tabla `counters`.
 * Esta función usa una transacción para asegurar incrementos atómicos y prevenir condiciones de carrera.
 * @param sequenceName El nombre del campo contador (ej., 'clientNumber' o 'creditNumber').
 * @returns Una promesa que se resuelve con el siguiente número en la secuencia.
 */
export async function getNextSequenceValue(sequenceName: 'clientNumber' | 'creditNumber'): Promise<number> {
    // Obtiene una conexión única del pool para la transacción.
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Bloquea la fila para evitar que otros la lean o modifiquen hasta que la transacción termine.
        const [rows]: any = await connection.execute('SELECT * FROM counters WHERE id = ? FOR UPDATE', ['main']);

        let currentValue = 0;
        if (rows.length === 0) {
            // Si el contador no existe, lo crea.
            await connection.execute('INSERT INTO counters (id, clientNumber, creditNumber) VALUES (?, ?, ?)', ['main', 1, 1]);
            currentValue = 1;
        } else {
            currentValue = rows[0][sequenceName] || 0;
            currentValue++;
            await connection.execute(`UPDATE counters SET ${sequenceName} = ? WHERE id = ?`, [currentValue, 'main']);
        }
        
        await connection.commit();
        return currentValue;

    } catch (error) {
        await connection.rollback();
        console.error(`Error en la transacción para getNextSequenceValue (${sequenceName}):`, error);
        throw new Error('No se pudo obtener el siguiente valor de la secuencia.');
    } finally {
        // Asegura que la conexión siempre se libere de vuelta al pool.
        connection.release();
    }
}
