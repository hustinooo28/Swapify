import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Message, Offer } from '../types';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { offer }: { offer: Offer } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); }); }, []);

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel(`messages:${offer.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `offer_id=eq.${offer.id}` },
        (payload) => { setMessages((prev) => [...prev, payload.new as Message]); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [offer.id]);

  const fetchMessages = async () => {
    const { data } = await supabase.from('messages').select('*, sender:profiles!sender_id(id, full_name)').eq('offer_id', offer.id).order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!text.trim() || !userId) return;
    const content = text.trim();
    setText('');
    await supabase.from('messages').insert({ offer_id: offer.id, sender_id: userId, content });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === userId;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMe && <View style={styles.avatarSmall}><Text style={styles.avatarText}>{(item.sender?.full_name || 'U')[0].toUpperCase()}</Text></View>}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>{item.content}</Text>
          <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextThem]}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Ionicons name="chevron-back" size={22} color={Colors.text} /></TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Trade Chat</Text>
          <Text style={styles.headerSub}>{offer.sender?.full_name} ↔ {offer.receiver?.full_name}</Text>
        </View>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View> : (
        <FlatList ref={flatListRef} data={messages} keyExtractor={(m) => m.id} renderItem={renderMessage} contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<View style={styles.emptyChat}><Ionicons name="chatbubbles-outline" size={40} color={Colors.textLight} /><Text style={styles.emptyChatText}>Start the conversation!</Text></View>}
        />
      )}
      <View style={styles.inputBar}>
        <TextInput style={styles.input} placeholder="Type a message..." placeholderTextColor={Colors.textLight} value={text} onChangeText={setText} multiline maxLength={500} />
        <TouchableOpacity style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!text.trim()}>
          <Ionicons name="send" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, paddingTop: 52, paddingBottom: 12, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { padding: Spacing.md, gap: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 2 },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  avatarSmall: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  avatarText: { color: Colors.white, fontWeight: '700', fontSize: 11 },
  bubble: { maxWidth: '72%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: Colors.white, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontSize: FontSize.sm, lineHeight: 20 },
  bubbleTextMe: { color: Colors.white },
  bubbleTextThem: { color: Colors.text },
  timeText: { fontSize: 10, marginTop: 3 },
  timeTextMe: { color: 'rgba(255,255,255,0.65)', textAlign: 'right' },
  timeTextThem: { color: Colors.textLight },
  emptyChat: { alignItems: 'center', paddingTop: 80 },
  emptyChatText: { fontSize: FontSize.sm, color: Colors.textLight, marginTop: 8 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.md, paddingBottom: Platform.OS === 'ios' ? 28 : Spacing.md, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border, gap: 10 },
  input: { flex: 1, backgroundColor: Colors.borderLight, borderRadius: BorderRadius.full, paddingHorizontal: 16, paddingVertical: 10, fontSize: FontSize.sm, color: Colors.text, maxHeight: 100, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
});