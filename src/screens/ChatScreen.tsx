import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Keyboard, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';

type Message = {
  id: string;
  sender_id: string;
  receiver_id?: string;
  content: string;
  created_at: string;
  conversation_id?: string;
  offer_id?: string;
  read?: boolean;
  sender?: { full_name: string; avatar_url?: string };
};

const NAV_HEIGHT = Platform.OS === 'ios' ? 100 : 88;

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { theme } = useTheme();

  const {
    offer,
    conversationId,
    otherUserId,
    otherUserName,
    itemId,
    itemTitle,
    currentUserId: passedUserId,
  } = route.params || {};

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(passedUserId || null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const [otherUserDeleted, setOtherUserDeleted] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const isOfferChat = !!offer;

  // Figure out the other party's user ID
  const otherPartyId = isOfferChat
    ? (offer.sender_id === userId ? offer.receiver_id : offer.sender_id)
    : otherUserId;

  const chatTitle = isOfferChat ? 'Trade Chat' : (otherUserName || 'Chat');
  const chatSub = isOfferChat
    ? `${offer?.offered_item?.title} ↔ ${offer?.requested_item?.title}`
    : itemTitle ? `About: ${itemTitle}` : '';

  useEffect(() => {
    if (!userId) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setUserId(user.id);
      });
    }
  }, []);

  // Fetch the other party's profile for avatar + name
  useEffect(() => {
    if (!otherPartyId) return;
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', otherPartyId)
      .single()
      .then(({ data }) => { if (data) setOtherUserProfile(data); });
  }, [otherPartyId]);

  // Check if other user soft-deleted this conversation
  useEffect(() => {
    if (!isOfferChat || !userId || !offer?.id) return;
    checkIfOtherDeleted();
  }, [userId]);

  const checkIfOtherDeleted = async () => {
    const { data } = await supabase
      .from('offers')
      .select('deleted_by_sender, deleted_by_receiver, sender_id, receiver_id')
      .eq('id', offer.id)
      .single();

    if (!data || !userId) return;
    const iAmSender = data.sender_id === userId;
    // Other party deleted = the opposite field is true
    const otherDeleted = iAmSender
      ? data.deleted_by_receiver
      : data.deleted_by_sender;
    setOtherUserDeleted(otherDeleted === true);
  };

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchMessages();
    markMessagesAsRead();

    const channelId = isOfferChat ? `offer_${offer.id}` : `conv_${conversationId}`;
    const filter = isOfferChat
      ? `offer_id=eq.${offer.id}`
      : `conversation_id=eq.${conversationId}`;

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter,
      }, (payload) => {
        setMessages(prev => {
          const newMsg = payload.new as Message;
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        markMessagesAsRead();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const fetchMessages = async () => {
    let query = supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(id, full_name, avatar_url)')
      .order('created_at', { ascending: true });

    if (isOfferChat) query = query.eq('offer_id', offer.id);
    else query = query.eq('conversation_id', conversationId);

    const { data } = await query;
    if (data) setMessages(data as Message[]);
    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);
  };

  const markMessagesAsRead = async () => {
    if (!userId) return;
    let query = supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', userId)
      .eq('read', false);

    if (isOfferChat) query = query.eq('offer_id', offer.id);
    else query = query.eq('conversation_id', conversationId);

    await query;
  };

  const sendMessage = async () => {
    if (!text.trim() || !userId) return;
    const content = text.trim();
    setText('');

    const payload: any = { sender_id: userId, content };
    if (isOfferChat) {
      payload.offer_id = offer.id;
      const receiverId = offer.sender_id === userId ? offer.receiver_id : offer.sender_id;
      payload.receiver_id = receiverId;
    } else {
      payload.conversation_id = conversationId;
      payload.receiver_id = otherUserId;
      payload.item_id = itemId || null;
    }

    await supabase.from('messages').insert(payload);
  };

  const handleGoToProfile = () => {
    if (!otherPartyId) return;
    navigation.navigate('SellerProfile', { sellerId: otherPartyId });
  };

  const renderMessage = ({ item: msg }: { item: Message }) => {
    const isMe = msg.sender_id === userId;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMe && (
          <TouchableOpacity onPress={handleGoToProfile} activeOpacity={0.8}>
            {msg.sender?.avatar_url ? (
              <Image source={{ uri: msg.sender.avatar_url }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(msg.sender?.full_name || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        <View>
          {!isMe && (
            <Text style={[styles.senderName, { color: theme.textSecondary }]}>
              {msg.sender?.full_name}
            </Text>
          )}
          <View style={[
            styles.bubble,
            isMe
              ? styles.bubbleMe
              : [styles.bubbleThem, { backgroundColor: theme.card, borderColor: theme.border }],
          ]}>
            <Text style={[styles.bubbleText, { color: isMe ? '#fff' : theme.text }]}>
              {msg.content}
            </Text>
          </View>
          <View style={[styles.timeRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
            <Text style={[styles.timeText, { color: theme.textLight }]}>
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMe && (
              <Ionicons
                name={msg.read ? 'checkmark-done' : 'checkmark'}
                size={12}
                color={msg.read ? Colors.primary : theme.textLight}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  const listBottomPad = keyboardHeight > 0 ? 16 : NAV_HEIGHT + 8;
  const displayName = otherUserProfile?.full_name || chatTitle;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>

        {/* Tappable profile section */}
        <TouchableOpacity
          style={styles.headerCenter}
          onPress={handleGoToProfile}
          activeOpacity={0.8}
        >
          {otherUserProfile?.avatar_url ? (
            <Image source={{ uri: otherUserProfile.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Text style={styles.headerAvatarText}>{displayName[0]?.toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {!!chatSub && (
              <Text style={[styles.headerSub, { color: theme.textSecondary }]} numberOfLines={1}>
                {chatSub}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={14} color={theme.textLight} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={[styles.msgList, { paddingBottom: listBottomPad }]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            keyboardDismissMode="on-drag"
            ListHeaderComponent={
              otherUserDeleted ? (
                <View style={[styles.leftBanner, { backgroundColor: theme.surface }]}>
                  <Ionicons name="person-remove-outline" size={16} color={theme.textLight} />
                  <Text style={[styles.leftBannerText, { color: theme.textSecondary }]}>
                    {displayName} left this conversation
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: Colors.primaryLight }]}>
                  <Ionicons name="chatbubbles-outline" size={32} color={Colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No messages yet</Text>
                <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                  Say hello and start negotiating!
                </Text>
              </View>
            }
          />
        )}

        {/* Input — disabled if other user left */}
        {otherUserDeleted ? (
          <View style={[styles.leftInputBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <Ionicons name="lock-closed-outline" size={16} color={theme.textLight} />
            <Text style={[styles.leftInputText, { color: theme.textLight }]}>
              This conversation has been closed
            </Text>
          </View>
        ) : (
          <View style={[styles.inputBar, {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            paddingBottom: keyboardHeight > 0
              ? Spacing.sm
              : Platform.OS === 'ios' ? NAV_HEIGHT - 50 : NAV_HEIGHT - 55,
          }]}>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.background,
                borderColor: theme.border,
                color: theme.text,
              }]}
              placeholder="Type a message..."
              placeholderTextColor={theme.textLight}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !text.trim() && styles.sendBtnOff]}
              onPress={sendMessage}
              disabled={!text.trim()}
            >
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 52 : 16, paddingBottom: 12, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, flexShrink: 0 },
  headerAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerAvatarText: { color: '#fff', fontWeight: '800', fontSize: FontSize.sm },
  headerTitle: { fontSize: FontSize.md, fontWeight: '700' },
  headerSub: { fontSize: FontSize.xs, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  msgList: { padding: Spacing.md, gap: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarImg: { width: 30, height: 30, borderRadius: 15, flexShrink: 0 },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  senderName: { fontSize: 10, fontWeight: '600', marginBottom: 3, marginLeft: 2 },
  bubble: { maxWidth: 260, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontSize: FontSize.sm, lineHeight: 20 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, marginHorizontal: 4 },
  timeText: { fontSize: 10 },
  leftBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: BorderRadius.lg, marginBottom: 12 },
  leftBannerText: { fontSize: FontSize.xs, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  emptySub: { fontSize: FontSize.sm, marginTop: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, gap: 10 },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: FontSize.sm, maxHeight: 100, borderWidth: 1 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4, flexShrink: 0 },
  sendBtnOff: { opacity: 0.4, shadowOpacity: 0 },
  leftInputBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderTopWidth: 1 },
  leftInputText: { fontSize: FontSize.sm, fontWeight: '600' },
});