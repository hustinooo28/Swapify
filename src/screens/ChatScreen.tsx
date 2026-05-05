import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  conversation_id?: string;
  offer_id?: string;
  sender?: { full_name: string };
};

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const { offer, conversationId, otherUserId, otherUserName, itemId, itemTitle, currentUserId: passedUserId } = route.params || {};

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(passedUserId || null);
  const flatListRef = useRef<FlatList>(null);
  const isOfferChat = !!offer;

  useEffect(() => {
    if (!userId) supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
  }, []);

  useEffect(() => {
    fetchMessages();
    const channelId = isOfferChat ? `offer_${offer.id}` : `conv_${conversationId}`;
    const filter = isOfferChat ? `offer_id=eq.${offer.id}` : `conversation_id=eq.${conversationId}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const fetchMessages = async () => {
    let query = supabase.from('messages').select('*, sender:profiles!sender_id(id, full_name)').order('created_at', { ascending: true });
    if (isOfferChat) query = query.eq('offer_id', offer.id);
    else query = query.eq('conversation_id', conversationId);
    const { data } = await query;
    if (data) setMessages(data as Message[]);
    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  };

  const sendMessage = async () => {
    if (!text.trim() || !userId) return;
    const content = text.trim();
    setText('');
    const payload: any = { sender_id: userId, content };
    if (isOfferChat) payload.offer_id = offer.id;
    else { payload.conversation_id = conversationId; payload.receiver_id = otherUserId; payload.item_id = itemId || null; }
    await supabase.from('messages').insert(payload);
  };

  const chatTitle = isOfferChat ? 'Trade Chat' : (otherUserName || 'Chat');
  const chatSub = isOfferChat
    ? `${offer?.sender?.full_name} ↔ ${offer?.receiver?.full_name}`
    : itemTitle ? `About: ${itemTitle}` : '';

  const renderMessage = ({ item: msg }: { item: Message }) => {
    const isMe = msg.sender_id === userId;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMe && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(msg.sender?.full_name || 'U')[0].toUpperCase()}</Text>
          </View>
        )}
        <View>
          {!isMe && <Text style={[styles.senderName, { color: theme.textSecondary }]}>{msg.sender?.full_name}</Text>}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : [styles.bubbleThem, { backgroundColor: theme.card, borderColor: theme.border }]]}>
            <Text style={[styles.bubbleText, { color: isMe ? '#fff' : theme.text }]}>{msg.content}</Text>
          </View>
          <Text style={[styles.timeText, { color: theme.textLight, textAlign: isMe ? 'right' : 'left' }]}>
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{chatTitle[0]}</Text>
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{chatTitle}</Text>
            {!!chatSub && <Text style={[styles.headerSub, { color: theme.textSecondary }]} numberOfLines={1}>{chatSub}</Text>}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="chatbubbles-outline" size={32} color={Colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No messages yet</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>Say hello and start negotiating!</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={[styles.inputBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
          placeholder="Type a message..."
          placeholderTextColor={theme.textLight}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity style={[styles.sendBtn, !text.trim() && styles.sendBtnOff]} onPress={sendMessage} disabled={!text.trim()}>
          <Ionicons name="send" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 52 : 16, paddingBottom: 12, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#fff', fontWeight: '800', fontSize: FontSize.sm },
  headerTitle: { fontSize: FontSize.md, fontWeight: '700' },
  headerSub: { fontSize: FontSize.xs, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  msgList: { padding: Spacing.md, gap: 12, paddingBottom: 20 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  senderName: { fontSize: 10, fontWeight: '600', marginBottom: 3, marginLeft: 2 },
  bubble: { maxWidth: 260, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontSize: FontSize.sm, lineHeight: 20 },
  timeText: { fontSize: 10, marginTop: 4, marginHorizontal: 4 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  emptySub: { fontSize: FontSize.sm, marginTop: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.md, paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.md, borderTopWidth: 1, gap: 10 },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: FontSize.sm, maxHeight: 100, borderWidth: 1 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  sendBtnOff: { opacity: 0.4, shadowOpacity: 0 },
});