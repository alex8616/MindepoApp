import { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';

export default function CalendarioScreen() {

    const [selectedDate, setSelectedDate] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

    return (
        <View style={{ flex: 1 }}>

            <Calendar
                onDayPress={(day) => {
                    setSelectedDate(day.dateString);
                    setModalVisible(true);
                }}

                markedDates={{
                    [selectedDate]: {
                        selected: true,
                        selectedColor: '#4A90E2'
                    }
                }}
            />

            {/* MODAL */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
            >
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>

                        <Text style={styles.title}>
                            {selectedDate}
                        </Text>

                        <TouchableOpacity style={styles.button}>
                            <Text style={styles.buttonText}>
                                Registrar Permiso
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: '#E74C3C' }]}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={styles.buttonText}>
                                Cerrar
                            </Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    modalBg: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalCard: {
        width: '85%',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 15
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20
    },
    button: {
        backgroundColor: '#4A90E2',
        padding: 12,
        borderRadius: 10,
        marginTop: 10
    },
    buttonText: {
        color: '#fff',
        textAlign: 'center',
        fontWeight: 'bold'
    }
});