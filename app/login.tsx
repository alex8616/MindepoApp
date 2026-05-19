// app/login.tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { login } from '../services/authService';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { setUser, refreshUser } = useAuth();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Por favor ingresa email y contraseña');
            return;
        }

        setLoading(true);

        try {
            const data = await login(email, password);
            console.log('LOGIN DATA:', data);

            if (data && data.id) {
                setUser(data);
                await refreshUser();
                router.replace('/(tabs)');
            } else {
                Alert.alert('Error', 'Credenciales incorrectas');
            }
        } catch (error: any) {
            console.log('LOGIN ERROR:', error);
            Alert.alert('Error', error.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.inner}>
                    {/* Logo y brand */}
                    <View style={styles.brandContainer}>
                        <View style={styles.logoWrapper}>
                            <Text style={styles.logoText}>M</Text>
                        </View>
                        <Text style={styles.appName}>MindepoApp</Text>
                        <Text style={styles.tagline}>Control de Asistencia</Text>
                    </View>

                    {/* Formulario */}
                    <View style={styles.formContainer}>
                        <Text style={styles.welcomeText}>Bienvenido</Text>
                        <Text style={styles.instructionText}>
                            Ingresa tus credenciales para continuar
                        </Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Correo electrónico</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="usuario@mindepo.com"
                                    placeholderTextColor="#A0AEC0"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Contraseña</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor="#A0AEC0"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                            </View>
                        </View>

                        <TouchableOpacity 
                            style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
                            onPress={handleLogin} 
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.loginButtonText}>Iniciar sesión</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            © {new Date().getFullYear()} MindepoApp
                        </Text>
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    inner: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 40,
    },
    brandContainer: {
        alignItems: 'center',
        marginTop: 40,
    },
    logoWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#4A90E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#4A90E2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    logoText: {
        fontSize: 40,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    appName: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1A202C',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    tagline: {
        fontSize: 14,
        color: '#718096',
        letterSpacing: 0.3,
    },
    formContainer: {
        marginTop: 40,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#1A202C',
        marginBottom: 8,
    },
    instructionText: {
        fontSize: 14,
        color: '#718096',
        marginBottom: 32,
        lineHeight: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2D3748',
        marginBottom: 8,
    },
    inputWrapper: {
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        backgroundColor: '#F7FAFC',
    },
    input: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#1A202C',
    },
    loginButton: {
        backgroundColor: '#4A90E2',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24,
        shadowColor: '#4A90E2',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    loginButtonDisabled: {
        backgroundColor: '#A0AEC0',
        shadowOpacity: 0,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 16,
        letterSpacing: 0.5,
    },
    footer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    footerText: {
        fontSize: 12,
        color: '#A0AEC0',
    },
});