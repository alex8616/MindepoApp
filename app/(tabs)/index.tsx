import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { initDB } from '../../database/db';
import { guardarAsistencia } from '../../services/asistenciaService';
import { getCurrentAppTime, syncServerTime } from '../../services/timeService';

export default function Home() {
    const [email, setEmail] = useState('');
    const [tipo, setTipo] = useState('Ingreso');
    const [observacion, setObservacion] = useState('');
    const [location, setLocation] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [locationLoading, setLocationLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState('');
    const [locationError, setLocationError] = useState<string | null>(null);
    const [usingBalancedMode, setUsingBalancedMode] = useState(false);
    
    const locationRetryCount = useRef(0);
    const maxRetries = 3;

    useEffect(() => {
        initDB().catch(console.log);
        getLocationWithRetry();
        initializeTime();

        const interval = setInterval(() => {
            updateCurrentTime();
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const initializeTime = async () => {
        try {
            await syncServerTime();
            await updateCurrentTime();
        } catch (error) {
            console.log('Error inicializando hora:', error);
        }
    };

    const updateCurrentTime = async () => {
        try {
            const now = await getCurrentAppTime();
            const formatted = formatDateTime(now);
            setCurrentTime(formatted);
        } catch (error) {
            console.log('Error actualizando hora:', error);
        }
    };

    const formatDateTime = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const getLocationWithRetry = async () => {
        setLocationLoading(true);
        setLocationError(null);
        locationRetryCount.current = 0;
        
        await attemptGetLocation();
    };

    const attemptGetLocation = async () => {
        try {
            // Primero intentar con alta precisión
            console.log('Intentando obtener ubicación con alta precisión...');
            const location = await getLocationWithAccuracy(Location.Accuracy.High);
            
            if (location) {
                console.log('✅ Ubicación obtenida con alta precisión');
                setLocation(location);
                setUsingBalancedMode(false);
                setLocationError(null);
                setLocationLoading(false);
                return;
            }
        } catch (error: any) {
            console.log('GPS de alta precisión falló:', error.message);
            
            // Si falla, intentar con modo balanceado
            if (locationRetryCount.current < maxRetries) {
                locationRetryCount.current++;
                console.log(`Reintento ${locationRetryCount.current}/${maxRetries} con modo balanceado...`);
                
                try {
                    const balancedLocation = await getLocationWithAccuracy(Location.Accuracy.Balanced);
                    
                    if (balancedLocation) {
                        console.log('✅ Ubicación obtenida con modo balanceado');
                        setLocation(balancedLocation);
                        setUsingBalancedMode(true);
                        setLocationError(null);
                        setLocationLoading(false);
                        
                        // Mostrar alerta informativa solo una vez
                        if (locationRetryCount.current === 1) {
                            Alert.alert(
                                '⚠️ Precisión reducida',
                                'Usando ubicación aproximada. La precisión puede ser menor.',
                                [{ text: 'Entendido' }]
                            );
                        }
                        return;
                    }
                } catch (balancedError: any) {
                    console.log('Modo balanceado también falló:', balancedError.message);
                }
            }
        }
        
        // Si todos los intentos fallaron
        setLocation(null);
        setLocationLoading(false);
        setLocationError('No se pudo obtener la ubicación. Verifica que los servicios de ubicación estén activados.');
        
        Alert.alert(
            '❌ Error de Ubicación',
            'No se pudo obtener tu ubicación. Por favor:\n\n' +
            '1. Activa el GPS de tu dispositivo\n' +
            '2. Permite el acceso a la ubicación\n' +
            '3. Verifica que tengas señal GPS\n\n' +
            '¿Quieres reintentar?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { 
                    text: 'Reintentar', 
                    onPress: () => getLocationWithRetry()
                }
            ]
        );
    };

    const getLocationWithAccuracy = async (accuracy: Location.Accuracy) => {
        try {
            // Solicitar permisos
            const { status } = await Location.requestForegroundPermissionsAsync();
            
            if (status !== 'granted') {
                throw new Error('Permiso de ubicación denegado');
            }

            // Configurar opciones según precisión
            const options: Location.LocationOptions = {
                accuracy: accuracy,
                timeout: accuracy === Location.Accuracy.High ? 15000 : 10000, // 15s para GPS, 10s para balanceado
                maximumAge: accuracy === Location.Accuracy.High ? 1000 : 5000, // 1s para GPS, 5s para balanceado
            };

            // Intentar obtener ubicación
            const location = await Location.getCurrentPositionAsync(options);
            
            // Validar que la ubicación sea razonable
            if (location && location.coords) {
                // Verificar que las coordenadas no sean cero
                if (location.coords.latitude === 0 && location.coords.longitude === 0) {
                    throw new Error('Coordenadas inválidas (0,0)');
                }
                
                // Verificar precisión si es modo GPS
                if (accuracy === Location.Accuracy.High && location.coords.accuracy > 100) {
                    console.log(`Precisión baja en modo GPS: ${location.coords.accuracy}m`);
                    // Aún así la devolvemos, pero con advertencia
                }
                
                return location.coords;
            }
            
            throw new Error('No se recibieron coordenadas válidas');
            
        } catch (error: any) {
            console.log(`Error en getLocationWithAccuracy (${accuracy}):`, error.message);
            
            // Errores específicos
            if (error.message.includes('LOCATION_UNAVAILABLE')) {
                throw new Error('GPS no disponible');
            } else if (error.message.includes('TIMEOUT')) {
                throw new Error('Tiempo de espera agotado');
            }
            
            throw error;
        }
    };

    const saveAttendance = async () => {
        try {
            setLoading(true);

            const [fecha, hora] = currentTime.split(' ');

            await guardarAsistencia({
                email,
                tipo,
                observacion,
                fecha,
                hora,
                lat: location?.latitude?.toString() || '',
                lng: location?.longitude?.toString() || '',
            });

            const precisionMsg = usingBalancedMode ? 
                '\n⚠️ Ubicación con precisión reducida' : 
                '\n✅ Ubicación precisa (GPS)';

            Alert.alert(
                '✅ Éxito',
                `Asistencia registrada\n\n` +
                `Hora: ${currentTime}\n` +
                `Latitud: ${location?.latitude}\n` +
                `Longitud: ${location?.longitude}\n` +
                `Precisión: ${location?.accuracy?.toFixed(1) || 'N/A'}m${precisionMsg}`
            );

            setEmail('');
            setObservacion('');
            
            // Opcional: refrescar ubicación después de guardar
            setTimeout(() => {
                getLocationWithRetry();
            }, 1000);
            
        } catch (error) {
            console.log('Error guardando asistencia:', error);
            Alert.alert(
                '❌ Error',
                'No se pudo guardar la asistencia. Intenta nuevamente.'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleGuardar = async () => {
        if (!email) {
            Alert.alert('Error', 'Ingresa un email');
            return;
        }

        if (!email.includes('@')) {
            Alert.alert('Error', 'Email inválido');
            return;
        }

        if (!location) {
            Alert.alert(
                'Error', 
                locationError || 'No hay ubicación disponible. Espera a que se obtenga o toca el botón de reintentar.'
            );
            return;
        }

        saveAttendance();
    };

    const handleRefreshLocation = () => {
        getLocationWithRetry();
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.header}>
                    <Ionicons name="calendar-outline" size={50} color="#4A90E2" />
                    <Text style={styles.title}>MindepoApp</Text>
                    <Text style={styles.subtitle}>Registro de Asistencia</Text>
                </View>

                <View style={styles.formContainer}>
                    <View style={styles.serverBanner}>
                        <Ionicons name="cloud-done-outline" size={22} color="#27AE60" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.serverTitle}>Hora del servidor</Text>
                            <Text style={styles.serverText}>La app NO usa la hora del celular</Text>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="usuario@correo.com"
                                placeholderTextColor="#999"
                                style={styles.input}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Hora Servidor</Text>
                        <View style={styles.timeWrapper}>
                            <Ionicons name="time-outline" size={20} color="#4A90E2" style={styles.inputIcon} />
                            <Text style={styles.timeText}>{currentTime || 'Cargando...'}</Text>
                            <Ionicons name="checkmark-circle" size={20} color="#27AE60" style={styles.timeIcon} />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Tipo</Text>
                        <View style={styles.tipoContainer}>
                            <TouchableOpacity
                                style={[styles.tipoButton, tipo === 'Ingreso' && styles.tipoButtonIngreso]}
                                onPress={() => setTipo('Ingreso')}
                            >
                                <Text style={[styles.tipoButtonText, tipo === 'Ingreso' && styles.tipoButtonTextActive]}>
                                    Ingreso
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.tipoButton, tipo === 'Salida' && styles.tipoButtonSalida]}
                                onPress={() => setTipo('Salida')}
                            >
                                <Text style={[styles.tipoButtonText, tipo === 'Salida' && styles.tipoButtonTextActive]}>
                                    Salida
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Observación</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="document-text-outline" size={20} color="#999" style={styles.inputIcon} />
                            <TextInput
                                value={observacion}
                                onChangeText={setObservacion}
                                placeholder="Opcional"
                                placeholderTextColor="#999"
                                style={styles.input}
                            />
                        </View>
                    </View>

                    <View style={styles.locationInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="location-outline" size={20} color="#4A90E2" />
                                <Text style={styles.locationTitle}>Ubicación</Text>
                            </View>
                            <TouchableOpacity onPress={handleRefreshLocation}>
                                <Ionicons name="refresh-outline" size={20} color="#4A90E2" />
                            </TouchableOpacity>
                        </View>

                        {locationLoading ? (
                            <View style={{ alignItems: 'center', padding: 20 }}>
                                <ActivityIndicator size="large" color="#4A90E2" />
                                <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
                            </View>
                        ) : location ? (
                            <View style={{ flex: 1 }}>
                                {usingBalancedMode && (
                                    <View style={styles.warningBadge}>
                                        <Ionicons name="warning-outline" size={14} color="#E67E22" />
                                        <Text style={styles.warningText}>Precisión reducida</Text>
                                    </View>
                                )}
                                
                                <Text style={styles.locationText}>📍 Ubicación obtenida</Text>
                                <Text style={styles.coords}>LAT: {location.latitude.toFixed(6)}</Text>
                                <Text style={styles.coords}>LNG: {location.longitude.toFixed(6)}</Text>
                                {location.accuracy && (
                                    <Text style={styles.coords}>Precisión: ±{location.accuracy.toFixed(1)}m</Text>
                                )}

                                <TouchableOpacity
                                    onPress={() => {
                                        const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
                                        Linking.openURL(url);
                                    }}
                                    style={styles.mapButton}
                                >
                                    <Ionicons name="map-outline" size={18} color="#FFF" />
                                    <Text style={styles.mapButtonText}>Ver en Google Maps</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.locationError}>❌ {locationError || 'Sin ubicación'}</Text>
                                <TouchableOpacity onPress={handleRefreshLocation} style={styles.retryButton}>
                                    <Ionicons name="refresh" size={16} color="#4A90E2" />
                                    <Text style={styles.retryButtonText}>Reintentar</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[styles.submitButton, (loading || locationLoading) && styles.submitButtonDisabled]}
                        onPress={handleGuardar}
                        disabled={loading || locationLoading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle-outline" size={24} color="#FFF" />
                                <Text style={styles.submitButtonText}>Registrar</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2C3E50',
        marginTop: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#7F8C8D',
        marginTop: 5,
    },
    formContainer: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 24,
        elevation: 5,
    },
    serverBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FFF4',
        borderWidth: 1,
        borderColor: '#27AE60',
        padding: 14,
        borderRadius: 12,
        marginBottom: 20,
        gap: 10,
    },
    serverTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#27AE60',
    },
    serverText: {
        fontSize: 12,
        color: '#229954',
        marginTop: 2,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2C3E50',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E1E8ED',
        borderRadius: 12,
        backgroundColor: '#F8F9FA',
    },
    inputIcon: {
        paddingLeft: 12,
    },
    input: {
        flex: 1,
        padding: 12,
        fontSize: 16,
        color: '#2C3E50',
    },
    timeWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#4A90E2',
        borderRadius: 12,
        backgroundColor: '#F0F7FF',
    },
    timeText: {
        flex: 1,
        padding: 12,
        fontSize: 16,
        fontWeight: '600',
        color: '#2C3E50',
    },
    timeIcon: {
        paddingRight: 12,
    },
    tipoContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    tipoButton: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 2,
    },
    tipoButtonIngreso: {
        backgroundColor: '#4A90E2',
        borderColor: '#4A90E2',
    },
    tipoButtonSalida: {
        backgroundColor: '#E74C3C',
        borderColor: '#E74C3C',
    },
    tipoButtonText: {
        fontWeight: '600',
        color: '#4A90E2',
    },
    tipoButtonTextActive: {
        color: '#FFF',
    },
    locationInfo: {
        backgroundColor: '#F0F7FF',
        padding: 12,
        borderRadius: 12,
        marginBottom: 24,
    },
    locationTitle: {
        fontWeight: 'bold',
        color: '#2C3E50',
    },
    loadingText: {
        marginTop: 8,
        color: '#7F8C8D',
    },
    warningBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF5E7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 8,
        alignSelf: 'flex-start',
        gap: 4,
    },
    warningText: {
        fontSize: 11,
        color: '#E67E22',
    },
    locationText: {
        color: '#4A90E2',
        fontWeight: 'bold',
        marginTop: 4,
    },
    coords: {
        fontSize: 12,
        color: '#2C3E50',
        marginTop: 2,
    },
    locationError: {
        color: '#E74C3C',
        marginBottom: 8,
    },
    mapButton: {
        marginTop: 12,
        backgroundColor: '#4A90E2',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    mapButtonText: {
        color: '#FFF',
        fontWeight: '600',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#E8F0FE',
        borderRadius: 8,
        marginTop: 8,
    },
    retryButtonText: {
        color: '#4A90E2',
        fontWeight: '500',
        fontSize: 13,
    },
    submitButton: {
        backgroundColor: '#4A90E2',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    submitButtonDisabled: {
        backgroundColor: '#BDC3C7',
    },
    submitButtonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 16,
    },
});