import uuid from 'react-native-uuid';
import db from '../database/db';

export const guardarAsistencia = async ({ email, tipo, lat, lng, observacion = '' }) => {
    const fecha = new Date().toISOString().split('T')[0];
    const hora = new Date().toLocaleTimeString();

    const id = uuid.v4();

    await db.runAsync(
        `INSERT INTO asistencia 
    (uuid, email, fecha, hora, tipo, lat, lng, estado_sync)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, email, fecha, hora, tipo, lat, lng, 'pendiente']
    );

    console.log('✅ Asistencia guardada');
};
