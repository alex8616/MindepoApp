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

export default function Home() {
    const [email, setEmail] = useState('');
    const [tipo, setTipo] = useState('Ingreso');
    const [observacion, setObservacion] = useState('');
    const [location, setLocation] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [locationLoading, setLocationLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState('');
    const [isAutoTimeEnabled, setIsAutoTimeEnabled] = useState<boolean | null>(null);
    const [timeError, setTimeError] = useState('');

    const lastTimeRef = useRef<Date>(new Date());

    useEffect(() => {
        // Inicializar siempre, sin importar qué
        initDB().catch(console.log);
        getLocation();
        updateCurrentTime();

        // Hacer la verificación de forma segura (que no rompa la app)
        setTimeout(() => {
            verifyAutoTimeSafely();
        }, 1000);

        const interval = setInterval(updateCurrentTime, 1000);

        return () => {
            clearInterval(interval);
        };
    }, []);

    // Verificación SEGURA que NO rompe la app
    const verifyAutoTimeSafely = async () => {
        try {
            const test1 = Date.now();
            await new Promise((resolve) => setTimeout(resolve, 100));
            const test2 = Date.now();

            const diff = test2 - test1;

            if (diff > 50 && diff < 200) {
                setIsAutoTimeEnabled(true);
                setTimeError('');
            } else {
                setIsAutoTimeEnabled(false);
                setTimeError('⚠️ La hora del dispositivo podría no ser precisa');
            }
        } catch {
            setIsAutoTimeEnabled(null);
        }
    };

    const updateCurrentTime = () => {
        try {
            const now = new Date();
            const formattedTime = formatDateTime(now);
            setCurrentTime(formattedTime);
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

    const getLocation = async () => {
        try {
            setLocationLoading(true);
            let { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Se necesita ubicación para registrar asistencia.');
                setLocationLoading(false);
                return;
            }

            let loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            setLocation(loc.coords);
        } catch (error) {
            console.log('Error de ubicación:', error);
            Alert.alert('Error', 'No se pudo obtener tu ubicación');
        } finally {
            setLocationLoading(false);
        }
    };

    const saveAttendance = async () => {
        setLoading(true);
        try {
            const [datePart, timePart] = currentTime.split(' ');
            const fecha = datePart;
            const hora = timePart;

            await guardarAsistencia({
                email,
                tipo,
                lat: location?.latitude?.toString() || '',
                lng: location?.longitude?.toString() || '',
                observacion,
                fecha,
                hora,
            });

            Alert.alert('✅ Éxito', `Asistencia registrada correctamente\nHora: ${currentTime}`);
            setEmail('');
            setObservacion('');
        } catch (error) {
            Alert.alert('❌ Error', 'No se pudo registrar la asistencia');
        } finally {
            setLoading(false);
        }
    };

    const handleGuardar = async () => {
        if (isAutoTimeEnabled === false) {
            Alert.alert(
                'Advertencia',
                'Tu dispositivo podría tener hora incorrecta. El registro se guardará de todas formas.'
            );
        }

        if (!email) {
            Alert.alert('Error', 'Por favor ingresa tu email');
            return;
        }

        if (!email.includes('@') || !email.includes('.')) {
            Alert.alert('Error', 'Por favor ingresa un email válido');
            return;
        }

        if (!location) {
            Alert.alert('Error', 'Obteniendo ubicación... Por favor espera.');
            return;
        }

        saveAttendance();
    };

    // SIEMPRE renderiza el formulario, sin importar el estado
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.header}>
                    <Ionicons name="calendar-outline" size={50} color="#4A90E2" />
                    <Text style={styles.title}>MindepoApp</Text>
                    <Text style={styles.subtitle}>Registro de Asistencia</Text>
                </View>

                <View style={styles.formContainer}>
                    {/* Banner de estado de hora */}
                    {isAutoTimeEnabled === null ? (
                        <View style={styles.checkingBanner}>
                            <ActivityIndicator size="small" color="#F39C12" />
                            <Text style={styles.checkingText}>
                                Verificando configuración de hora...
                            </Text>
                        </View>
                    ) : isAutoTimeEnabled === true ? (
                        <View style={styles.successBanner}>
                            <Ionicons name="checkmark-circle" size={24} color="#27AE60" />
                            <View style={styles.bannerContent}>
                                <Text style={styles.successTitle}>✅ Hora automática activada</Text>
                                <Text style={styles.successText}>
                                    Puedes registrar asistencia normalmente
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.errorBanner}>
                            <Ionicons name="alert-circle" size={24} color="#E74C3C" />
                            <View style={styles.bannerContent}>
                                <Text style={styles.errorTitle}>
                                    ⛔ HORA AUTOMÁTICA DESACTIVADA
                                </Text>
                                <Text style={styles.errorText}>
                                    {timeError || 'Activa la hora automática para registrar'}
                                </Text>
                                <TouchableOpacity
                                    style={styles.fixButton}
                                    onPress={verifyAutoTimeSafely}
                                >
                                    <Ionicons name="refresh-outline" size={16} color="#FFF" />
                                    <Text style={styles.fixButtonText}>Verificar ahora</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons
                                name="mail-outline"
                                size={20}
                                color="#999"
                                style={styles.inputIcon}
                            />
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="usuario@ejemplo.com"
                                placeholderTextColor="#999"
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                editable={!loading && isAutoTimeEnabled === true}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Hora Actual</Text>
                        <View
                            style={[
                                styles.timeWrapper,
                                isAutoTimeEnabled === false && styles.timeWrapperError,
                            ]}
                        >
                            <Ionicons
                                name="time-outline"
                                size={20}
                                color={isAutoTimeEnabled === true ? '#4A90E2' : '#E74C3C'}
                                style={styles.inputIcon}
                            />
                            <Text
                                style={[
                                    styles.timeText,
                                    isAutoTimeEnabled === false && styles.timeTextError,
                                ]}
                            >
                                {currentTime || 'Cargando...'}
                            </Text>
                            {isAutoTimeEnabled === true && (
                                <Ionicons
                                    name="checkmark-circle"
                                    size={20}
                                    color="#27AE60"
                                    style={styles.timeIcon}
                                />
                            )}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Tipo de Registro</Text>
                        <View style={styles.tipoContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.tipoButton,
                                    tipo === 'Ingreso' && styles.tipoButtonActive,
                                ]}
                                onPress={() => setTipo('Ingreso')}
                                disabled={loading || isAutoTimeEnabled !== true}
                            >
                                <Ionicons
                                    name="log-in-outline"
                                    size={20}
                                    color={tipo === 'Ingreso' ? '#FFF' : '#4A90E2'}
                                />
                                <Text
                                    style={[
                                        styles.tipoButtonText,
                                        tipo === 'Ingreso' && styles.tipoButtonTextActive,
                                    ]}
                                >
                                    Ingreso
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.tipoButton,
                                    tipo === 'Salida' && styles.tipoButtonActiveSalida,
                                ]}
                                onPress={() => setTipo('Salida')}
                                disabled={loading || isAutoTimeEnabled !== true}
                            >
                                <Ionicons
                                    name="log-out-outline"
                                    size={20}
                                    color={tipo === 'Salida' ? '#FFF' : '#E74C3C'}
                                />
                                <Text
                                    style={[
                                        styles.tipoButtonText,
                                        tipo === 'Salida' && styles.tipoButtonTextActive,
                                    ]}
                                >
                                    Salida
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Observación</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons
                                name="document-text-outline"
                                size={20}
                                color="#999"
                                style={styles.inputIcon}
                            />
                            <TextInput
                                value={observacion}
                                onChangeText={setObservacion}
                                placeholder="Opcional"
                                placeholderTextColor="#999"
                                style={styles.input}
                                editable={!loading && isAutoTimeEnabled === true}
                            />
                        </View>
                    </View>

                    <View style={styles.locationInfo}>
                        <Ionicons name="location-outline" size={20} color="#4A90E2" />
                        {locationLoading ? (
                            <ActivityIndicator size="small" color="#4A90E2" />
                        ) : location ? (
                            <Text style={styles.locationText}>📍 Ubicación disponible</Text>
                        ) : (
                            <Text style={styles.locationError}>
                                ❌ No se pudo obtener ubicación
                            </Text>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            (loading || isAutoTimeEnabled !== true) && styles.submitButtonDisabled,
                        ]}
                        onPress={handleGuardar}
                        disabled={loading || locationLoading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle-outline" size={24} color="#FFF" />
                                <Text style={styles.submitButtonText}>Registrar Asistencia</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {isAutoTimeEnabled === false && (
                        <View style={styles.instructionsBox}>
                            <Ionicons name="settings-outline" size={20} color="#E74C3C" />
                            <View style={styles.instructionsContent}>
                                <Text style={styles.instructionsTitle}>
                                    📱 Cómo activar hora automática:
                                </Text>
                                <Text style={styles.instructionsText}>
                                    {Platform.OS === 'android'
                                        ? 'Configuración → Sistema → Fecha y hora → Activar "Hora automática"'
                                        : 'Configuración → General → Fecha y hora → Activar "Automática"'}
                                </Text>
                                <TouchableOpacity
                                    style={styles.openSettingsButton}
                                    onPress={() => Linking.openSettings()}
                                >
                                    <Text style={styles.openSettingsText}>
                                        Abrir Configuración →
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    checkingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        gap: 12,
        borderWidth: 1,
        borderColor: '#F39C12',
    },
    checkingText: {
        fontSize: 14,
        color: '#F39C12',
        flex: 1,
    },
    successBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FFF4',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        gap: 12,
        borderWidth: 1,
        borderColor: '#27AE60',
    },
    successTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#27AE60',
    },
    successText: {
        fontSize: 12,
        color: '#229954',
        marginTop: 2,
    },
    errorBanner: {
        flexDirection: 'row',
        backgroundColor: '#FFF5F5',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        gap: 12,
        borderWidth: 2,
        borderColor: '#E74C3C',
    },
    errorTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#E74C3C',
    },
    errorText: {
        fontSize: 12,
        color: '#C0392B',
        marginTop: 2,
    },
    bannerContent: {
        flex: 1,
    },
    fixButton: {
        backgroundColor: '#E74C3C',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 8,
        gap: 6,
        alignSelf: 'flex-start',
    },
    fixButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
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
    timeWrapperError: {
        borderColor: '#E74C3C',
        backgroundColor: '#FFF5F5',
    },
    timeText: {
        flex: 1,
        padding: 12,
        fontSize: 16,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: '#2C3E50',
        fontWeight: '600',
    },
    timeTextError: {
        color: '#E74C3C',
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E1E8ED',
        backgroundColor: '#FFF',
        gap: 8,
    },
    tipoButtonActive: {
        backgroundColor: '#4A90E2',
        borderColor: '#4A90E2',
    },
    tipoButtonActiveSalida: {
        backgroundColor: '#E74C3C',
        borderColor: '#E74C3C',
    },
    tipoButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4A90E2',
    },
    tipoButtonTextActive: {
        color: '#FFF',
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F7FF',
        padding: 12,
        borderRadius: 12,
        marginBottom: 24,
        gap: 8,
    },
    locationText: {
        fontSize: 14,
        color: '#4A90E2',
        flex: 1,
    },
    locationError: {
        fontSize: 14,
        color: '#E74C3C',
        flex: 1,
    },
    submitButton: {
        backgroundColor: '#4A90E2',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    submitButtonDisabled: {
        backgroundColor: '#BDC3C7',
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
    },
    instructionsBox: {
        flexDirection: 'row',
        backgroundColor: '#FFF5F5',
        padding: 16,
        borderRadius: 12,
        marginTop: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: '#E74C3C',
    },
    instructionsContent: {
        flex: 1,
    },
    instructionsTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#E74C3C',
        marginBottom: 6,
    },
    instructionsText: {
        fontSize: 12,
        color: '#7F8C8D',
        lineHeight: 18,
        marginBottom: 8,
    },
    openSettingsButton: {
        alignSelf: 'flex-start',
    },
    openSettingsText: {
        fontSize: 12,
        color: '#4A90E2',
        fontWeight: '600',
    },
});
