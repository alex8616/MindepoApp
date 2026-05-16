import AsyncStorage from '@react-native-async-storage/async-storage';

const TIME_KEY = 'server_time_base';
const DEVICE_TIME_KEY = 'device_time_base';

const API_URL = 'http://192.168.68.214:8000/hora-servidor';

export const syncServerTime = async () => {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    const serverTime = new Date(data.datetime).getTime();
    const deviceTime = Date.now();

    await AsyncStorage.setItem(TIME_KEY, serverTime.toString());
    await AsyncStorage.setItem(DEVICE_TIME_KEY, deviceTime.toString());

    console.log('✅ Hora sincronizada con servidor');
  } catch (error) {
    console.log('⚠️ No se pudo sincronizar, usando modo offline');
  }
};

export const getCurrentAppTime = async () => {
  const serverTime = await AsyncStorage.getItem(TIME_KEY);
  const deviceTime = await AsyncStorage.getItem(DEVICE_TIME_KEY);

  if (!serverTime || !deviceTime) {
    return new Date(); // fallback
  }

  const now = Date.now();
  const diff = now - parseInt(deviceTime);

  const current = parseInt(serverTime) + diff;

  return new Date(current);
};