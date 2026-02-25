import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Send, Phone } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { apiRequest } from '../../services/backend';
import { realtimeClient } from '../../services/realtimeClient';

// Driver chat screen (reused logic from customer chat)
type ChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;
type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

type Message = {
  id: string;
  text: string;
  senderId: string;
  time: string;
};

export default function ChatScreen() {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const route = useRoute<ChatScreenRouteProp>();
  const { driverName, tripId, role = 'driver' } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Fetch identity + participants
  useEffect(() => {
    const setup = async () => {
      try {
        const me = await apiRequest<{ user: any }>('/users/me');
        setUserId(me.user?.id || null);
      } catch (err) {
        console.error('[Chat] Failed to load user:', err);
      }

      try {
        const tripParticipants = await apiRequest<{ participants: any }>(`/trips/${tripId}/participants`);
        setParticipants(tripParticipants.participants || null);
      } catch (err) {
        console.error('[Chat] Failed to load participants:', err);
      }
    };

    if (tripId) setup();
  }, [tripId, role]);

  // Initial messages
  useEffect(() => {
    if (!tripId) return;
    const fetchMessages = async () => {
      try {
        const data = await apiRequest<{ messages: any[] }>(`/messages?tripId=${tripId}`);
        const formatted = (data.messages || []).map((msg: any) => ({
          id: msg.id,
          text: msg.content,
          senderId: msg.sender_id,
          time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        setMessages(formatted);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [tripId]);

  // Realtime subscription
  useEffect(() => {
    if (!tripId) return;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      unsubscribe = await realtimeClient.subscribe(
        { channel: 'trip:messages', tripId },
        (payload) => {
          const newMsg = payload?.new;
          if (!newMsg?.id) return;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [
              {
                id: newMsg.id,
                text: newMsg.content,
                senderId: newMsg.sender_id,
                time: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
              ...prev,
            ];
          });
        },
      );
    })();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [tripId]);

  const effectiveUserId = userId || (role === 'customer' ? participants?.customer_id : participants?.driver_id);

  const handleSend = async () => {
    if (inputText.trim().length === 0 || !tripId) return;
    const textToSend = inputText.trim();
    setInputText('');

    const tempId = 'temp-' + Date.now();
    const tempMsg: Message = {
      id: tempId,
      text: textToSend,
      senderId: effectiveUserId || 'unknown',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [tempMsg, ...prev]);

    try {
      const response = await apiRequest<{ message: any }>('/messages', {
        method: 'POST',
        body: JSON.stringify({ tripId, content: textToSend }),
      });
      if (response.message) {
        const realMsg = response.message;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  id: realMsg.id,
                  text: realMsg.content,
                  senderId: realMsg.sender_id,
                  time: new Date(realMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }
              : m,
          ),
        );
      }
    } catch (err) {
      console.error('[Chat] Unexpected Error:', err);
      Alert.alert('Error', 'Failed to send.');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(textToSend);
    }
  };

  return (
    <SafeAreaView style={[styles.container, Platform.OS === 'android' && styles.androidSafeArea]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#1e1e1e" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{driverName}</Text>
          <Text style={styles.headerStatus}>Online</Text>
        </View>
        <TouchableOpacity style={styles.callBtn}>
          <Phone size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => {
            const isUser = !!effectiveUserId && item.senderId === effectiveUserId;
            return (
              <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.driverBubble]}>
                <Text style={[styles.messageText, isUser ? styles.userText : styles.driverText]}>{item.text}</Text>
                <Text style={[styles.timeText, isUser ? { color: '#BFDBFE' } : { color: '#9CA3AF' }]}>{item.time}</Text>
              </View>
            );
          }}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={10}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={inputText}
            onChangeText={setInputText}
            placeholderTextColor="#9CA3AF"
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  androidSafeArea: { paddingTop: StatusBar.currentHeight || 0 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { padding: 8 },
  headerInfo: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e1e1e' },
  headerStatus: { fontSize: 12, color: '#10B981' },
  callBtn: { padding: 10, backgroundColor: '#EFF6FF', borderRadius: 20 },

  messagesList: { padding: 16 },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 12 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderBottomRightRadius: 2 },
  driverBubble: { alignSelf: 'flex-start', backgroundColor: '#F3F4F6', borderBottomLeftRadius: 2 },
  messageText: { fontSize: 16 },
  userText: { color: '#fff' },
  driverText: { color: '#1e1e1e' },
  timeText: { fontSize: 10, marginTop: 4, textAlign: 'right' },

  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#fff' },
  input: { flex: 1, height: 44, backgroundColor: '#F9FAFB', borderRadius: 22, paddingHorizontal: 16, fontSize: 16, marginRight: 12, color: '#1e1e1e' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
