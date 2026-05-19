import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { router, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext'; // Importa el hook
import { initDB } from '../../database/db';
import { guardarAsistencia } from '../../services/asistenciaService';
import { getCurrentAppTime, syncServerTime } from '../../services/timeService';

export default function Home() {
    const { user, logout } = useAuth();

    const [email, setEmail] = useState('');
    const [tipo, setTipo] = useState('Ingreso');
    const [observacion, setObservacion] = useState('');
    const [location, setLocation] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState('');
    const [locationError, setLocationError] = useState<string | null>(null);
    
    const navigation = useNavigation();
    const [menuVisible, setMenuVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width)).current;

    // Establecer email del usuario cuando esté disponible
    useEffect(() => {
        if (user?.email) {
            setEmail(user.email);
        }
    }, [user]);

    const openMenu = () => {
        setMenuVisible(true);
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    };

    const closeMenu = () => {
        Animated.timing(slideAnim, {
            toValue: -Dimensions.get('window').width,
            duration: 200,
            useNativeDriver: true,
        }).start(() => setMenuVisible(false));
    };

    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity
                    onPress={openMenu}
                    style={{ marginRight: 15 }}
                >
                    <Ionicons name="menu" size={28} color="#fff" />
                </TouchableOpacity>
            ),
        });
        
        initDB().catch(console.log);
        initializeTime();
        getLocation();

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
    
    const getLocation = async () => {
        try {
            setLocationLoading(true);
            setLocationError(null);

            if (!Device.isDevice) {
                setLocation(null);
                setLocationError('Emuladores no permitidos');
                return;
            }

            const enabled = await Location.hasServicesEnabledAsync();
            if (!enabled) {
                setLocation(null);
                setLocationError('GPS desactivado');
                return;
            }

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocation(null);
                setLocationError('Permiso de ubicación denegado');
                return;
            }

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT')), 10000)
            );

            const locationPromise = Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const currentLocation: any = await Promise.race([
                locationPromise,
                timeoutPromise,
            ]);

            if (!currentLocation?.coords) {
                throw new Error('Sin coordenadas');
            }

            if (currentLocation.mocked) {
                setLocation(null);
                setLocationError('Ubicación falsa detectada');
                return;
            }

            if (currentLocation.coords.accuracy && currentLocation.coords.accuracy < 5) {
                setLocation(null);
                setLocationError('GPS sospechoso detectado');
                return;
            }

            if (currentLocation.coords.accuracy && currentLocation.coords.accuracy > 100) {
                setLocation(null);
                setLocationError('GPS con baja precisión');
                return;
            }

            setLocation(currentLocation.coords);
            setLocationError(null);
        } catch (error: any) {
            console.log('GPS ERROR:', error);
            let mensaje = 'No se pudo obtener GPS';
            if (error?.message === 'TIMEOUT') {
                mensaje = 'GPS tardó demasiado. Activa alta precisión.';
            }
            setLocation(null);
            setLocationError(mensaje);
        } finally {
            setLocationLoading(false);
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
            
            Alert.alert(
                '✅ Éxito',
                `Asistencia registrada correctamente\n\n` +
                `📧 Email: ${email}\n` +
                `⏰ Hora: ${currentTime}\n` +
                `📍 Ubicación: ${location?.latitude?.toFixed(6)}, ${location?.longitude?.toFixed(6)}\n` +
                `📝 Tipo: ${tipo}`
            );
            
            setObservacion('');
        } catch (error) {
            console.log('Error guardando:', error);
            Alert.alert('❌ Error', 'No se pudo guardar la asistencia. Intenta nuevamente.');
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
            Alert.alert('⚠️ Sin ubicación', 'Primero debes obtener tu ubicación');
            return;
        }
        
        saveAttendance();
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
                    {/* Banner hora servidor */}
                    <View style={styles.serverBanner}>
                        <Ionicons name="cloud-done-outline" size={22} color="#27AE60" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.serverTitle}>Hora del servidor</Text>
                            <Text style={styles.serverText}>La app NO usa la hora del celular</Text>
                        </View>
                    </View>
                    
                    {/* Email */}
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
                    
                    {/* Hora servidor */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Hora Servidor</Text>
                        <View style={styles.timeWrapper}>
                            <Ionicons name="time-outline" size={20} color="#4A90E2" style={styles.inputIcon} />
                            <Text style={styles.timeText}>{currentTime || 'Cargando...'}</Text>
                            <Ionicons name="checkmark-circle" size={20} color="#27AE60" style={styles.timeIcon} />
                        </View>
                    </View>
                    
                    {/* Tipo ingreso/salida */}
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
                    
                    {/* Observación */}
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
                    
                    {/* Sección de ubicación */}
                    <View style={styles.locationSection}>
                        <Text style={styles.sectionTitle}>📍 Ubicación GPS</Text>
                        
                        {locationLoading ? (
                            <View style={styles.loadingLocationContainer}>
                                <ActivityIndicator size="large" color="#4A90E2" />
                                <Text style={styles.loadingLocationText}>
                                    Obteniendo ubicación...
                                </Text>
                            </View>
                        ) : !location ? (
                            <TouchableOpacity
                                style={styles.getLocationButton}
                                onPress={getLocation}
                            >
                                <Ionicons name="refresh" size={24} color="#FFF" />
                                <Text style={styles.getLocationButtonText}>
                                    Reintentar GPS
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.locationInfo}>
                                <View style={styles.locationCard}>
                                    <Ionicons name="checkmark-circle" size={24} color="#27AE60" />
                                    <Text style={styles.locationStatus}>
                                        GPS conectado correctamente
                                    </Text>
                                </View>
                                
                                <View style={styles.coordinatesCard}>
                                    <Text style={styles.coordText}>
                                        📍 Latitud: {location.latitude.toFixed(6)}
                                    </Text>
                                    <Text style={styles.coordText}>
                                        🗺️ Longitud: {location.longitude.toFixed(6)}
                                    </Text>
                                    {location.accuracy && (
                                        <Text style={styles.coordText}>
                                            🎯 Precisión: ±{location.accuracy.toFixed(1)}m
                                        </Text>
                                    )}
                                </View>
                                
                                <TouchableOpacity
                                    onPress={() => {
                                        const url = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
                                        Linking.openURL(url);
                                    }}
                                    style={styles.mapButton}
                                >
                                    <Ionicons name="map" size={20} color="#FFF" />
                                    <Text style={styles.mapButtonText}>Ver en Google Maps</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity
                                    onPress={() => {
                                        setLocation(null);
                                        getLocation();
                                    }}
                                    style={styles.refreshLocationButton}
                                >
                                    <Ionicons name="refresh" size={18} color="#4A90E2" />
                                    <Text style={styles.refreshLocationText}>Actualizar ubicación</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        
                        {locationError && !locationLoading && (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle" size={20} color="#E74C3C" />
                                <Text style={styles.errorText}>{locationError}</Text>
                            </View>
                        )}
                    </View>
                    
                    {/* Botón registrar */}
                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            (!location || loading || locationLoading) && styles.submitButtonDisabled
                        ]}
                        onPress={handleGuardar}
                        disabled={!location || loading || locationLoading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle-outline" size={24} color="#FFF" />
                                <Text style={styles.submitButtonText}>
                                    {locationLoading
                                        ? 'Obteniendo GPS...'
                                        : !location
                                        ? 'Esperando ubicación...'
                                        : 'Registrar Asistencia'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <Modal 
                    transparent 
                    visible={menuVisible} 
                    animationType="none"
                    onRequestClose={closeMenu}
                >
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={closeMenu}
                    />

                    <Animated.View
                        style={[
                            styles.menuPanel,
                            { transform: [{ translateX: slideAnim }] }
                        ]}
                    >
                        {/* Perfil de usuario - usando datos reales del contexto */}
                        <View style={styles.userSection}>
                            <View style={styles.userAvatar}>
                                <Text style={styles.userInitials}>
                                    {user?.name?.charAt(0).toUpperCase() || 
                                     user?.email?.charAt(0).toUpperCase() || 
                                     'U'}
                                </Text>
                            </View>
                            <Text style={styles.userName}>
                                {user?.name || 
                                 user?.email?.split('@')[0] || 
                                 'Bienvenido'}
                            </Text>
                            <Text style={styles.userEmail}>
                                {user?.email || 'usuario@ejemplo.com'}
                            </Text>
                        </View>

                        {/* Opciones de navegación */}
                        <View style={styles.navSection}>
                            <TouchableOpacity 
                                style={styles.navItem}
                                onPress={() => {
                                    closeMenu();
                                    router.push('/(tabs)');
                                }}
                            >
                                <View style={styles.navIcon}>
                                    <Ionicons name="home-outline" size={22} color="#718096" />
                                </View>
                                <Text style={styles.navLabel}>
                                    Inicio
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.navItem}
                                onPress={() => {
                                    closeMenu();
                                    // router.push('/asistencia');
                                    closeMenu();
                                }}
                            >
                                <View style={styles.navIcon}>
                                    <Ionicons name="calendar-outline" size={22} color="#718096" />
                                </View>
                                <Text style={styles.navLabel}>
                                    Mi Asistencia
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.navItem}
                                onPress={() => {
                                    closeMenu();
                                    // router.push('/configuracion');
                                    closeMenu();
                                }}
                            >
                                <View style={styles.navIcon}>
                                    <Ionicons name="settings-outline" size={22} color="#718096" />
                                </View>
                                <Text style={styles.navLabel}>
                                    Configuración
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.navItem}
                                onPress={() => {
                                    closeMenu();
                                    // router.push('/reportes');
                                    closeMenu();
                                }}
                            >
                                <View style={styles.navIcon}>
                                    <Ionicons name="bar-chart-outline" size={22} color="#718096" />
                                </View>
                                <Text style={styles.navLabel}>
                                    Reportes
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.navItem}
                                onPress={() => {
                                    closeMenu();
                                    router.push('/(tabs)/calendario');
                                }}
                            >
                                <View style={styles.navIcon}>
                                    <Ionicons name="calendar" size={22} color="#718096" />
                                </View>
                                <Text style={styles.navLabel}>
                                    Calendario
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.divider} />

                        {/* Cerrar sesión */}
                        <View style={styles.footerSection}>
                            <TouchableOpacity
                                style={styles.logoutItem}
                                onPress={async () => {
                                    await logout();
                                    router.replace('/login');
                                }}
                            >
                                <View style={styles.navIcon}>
                                    <Ionicons name="log-out-outline" size={22} color="#E53E3E" />
                                </View>
                                <Text style={styles.logoutLabel}>
                                    Cerrar sesión
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </Modal>
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
        borderColor: '#E1E8ED',
        backgroundColor: '#F8F9FA',
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
        color: '#666',
    },
    tipoButtonTextActive: {
        color: '#FFF',
    },
    locationSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2C3E50',
        marginBottom: 12,
    },
    getLocationButton: {
        backgroundColor: '#4A90E2',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 10,
    },
    getLocationButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    locationInfo: {
        gap: 10,
    },
    locationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        padding: 12,
        borderRadius: 10,
        gap: 8,
    },
    locationStatus: {
        fontSize: 14,
        fontWeight: '600',
        color: '#27AE60',
    },
    coordinatesCard: {
        backgroundColor: '#F8F9FA',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E1E8ED',
    },
    coordText: {
        fontSize: 13,
        color: '#2C3E50',
        marginVertical: 2,
    },
    mapButton: {
        backgroundColor: '#34A853',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 10,
        gap: 8,
    },
    mapButtonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 14,
    },
    refreshLocationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 10,
        gap: 6,
        backgroundColor: '#E8F0FE',
    },
    refreshLocationText: {
        color: '#4A90E2',
        fontSize: 13,
        fontWeight: '500',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FDEDEC',
        padding: 12,
        borderRadius: 10,
        marginTop: 10,
        gap: 8,
    },
    errorText: {
        flex: 1,
        color: '#E74C3C',
        fontSize: 13,
    },
    submitButton: {
        backgroundColor: '#4A90E2',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 10,
    },
    submitButtonDisabled: {
        backgroundColor: '#BDC3C7',
    },
    submitButtonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 16,
    },

    // ========== ESTILOS DEL MENÚ ELEGANTE ==========
    
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    
    menuPanel: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '75%',
        maxWidth: 320,
        backgroundColor: '#FFF',
        paddingTop: 80,
        paddingHorizontal: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 8,
    },
    
    // Perfil de usuario - estilo moderno
    userSection: {
        marginBottom: 40,
        borderBottomWidth: 1,
        borderBottomColor: '#E8ECF0',
        paddingBottom: 24,
    },
    
    userAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F0F4F8',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    
    userInitials: {
        fontSize: 32,
        fontWeight: '500',
        color: '#4A90E2',
    },
    
    userName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A202C',
        marginBottom: 4,
        letterSpacing: -0.3,
    },
    
    userEmail: {
        fontSize: 13,
        color: '#718096',
        letterSpacing: -0.2,
    },
    
    // Navegación del menú
    navSection: {
        flex: 1,
    },
    
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 4,
        borderRadius: 12,
    },
    
    navItemActive: {
        backgroundColor: '#F0F7FF',
    },
    
    navIcon: {
        width: 32,
        marginRight: 12,
    },
    
    navLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: '#2D3748',
        letterSpacing: -0.2,
    },
    
    navLabelActive: {
        color: '#4A90E2',
        fontWeight: '600',
    },
    
    // Separador elegante
    divider: {
        height: 1,
        backgroundColor: '#E8ECF0',
        marginVertical: 20,
    },
    
    // Footer con logout
    footerSection: {
        marginTop: 'auto',
        paddingBottom: 30,
    },
    
    logoutItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 12,
    },
    
    logoutLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: '#E53E3E',
        letterSpacing: -0.2,
    },
});