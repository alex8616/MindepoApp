import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'http://192.168.68.214:8000';

const getDeviceId = async () => {
    let id = await SecureStore.getItemAsync('device_id');

    if (!id) {
        id = Crypto.randomUUID();
        await SecureStore.setItemAsync('device_id', id);
    }

    return id;
};

export const login = async (email: string, password: string) => {

    const device_id = await getDeviceId();

    const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            email,
            password,
            device_id,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Credenciales incorrectas');
    }

    await AsyncStorage.setItem('user', JSON.stringify(data.user));

    return data.user;
};

export const getUser = async () => {
    const user = await AsyncStorage.getItem('user');

    console.log('📦 STORAGE USER:', user);

    return user ? JSON.parse(user) : null;
};

export const logout = async () => {
    console.log('🚪 LOGOUT');
    await AsyncStorage.removeItem('user');
};