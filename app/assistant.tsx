import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, IconButton, Txt } from '../src/components/ui';
import { useRecords } from '../src/hooks/useRecords';
import { repos } from '../src/repositories';
import { aiConfigured, sendAssistantMessage } from '../src/services/ai/client';
import { EMERGENCY_COPY, checkSafety } from '../src/services/ai/safety';
import { colors, fonts } from '../src/theme/tokens';
import { showError } from '../src/utils/alerts';
import { LIMITS } from '../src/utils/validation';

const CONVERSATION = 'default';

export default function Assistant() {
  const insets = useSafeAreaInsets();
  const messages = useRecords(repos.chat, { limit: 300, order: 'asc' });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const list = (messages.data ?? []).filter((m) => m.data.conversationId === CONVERSATION);

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [list.length]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setText('');
    setSending(true);
    try {
      await repos.chat.create({ conversationId: CONVERSATION, role: 'user', content });
      const flag = checkSafety(content);
      if (flag) await repos.chat.create({ conversationId: CONVERSATION, role: 'notice', content: EMERGENCY_COPY[flag.kind], kind: 'emergency' });
      const history = [...list, { data: { role: 'user' as const, content } }]
        .filter((m) => m.data.role === 'user' || m.data.role === 'assistant')
        .slice(-20)
        .map((m) => ({ role: m.data.role as 'user' | 'assistant', content: m.data.content }));
      const res = await sendAssistantMessage(history);
      if (res.status === 'ok') await repos.chat.create({ conversationId: CONVERSATION, role: 'assistant', content: res.data.reply, kind: 'text' });
      else await repos.chat.create({ conversationId: CONVERSATION, role: 'notice', content: res.message, kind: res.status === 'unavailable' ? 'unavailable' : 'error' });
    } catch (e) {
      showError(e);
    } finally {
      setSending(false);
    }
  };

  const clear = () =>
    Alert.alert('Clear this conversation?', 'Messages are deleted from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          for (const m of list) await repos.chat.remove(m.id);
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.ivory }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}>
      <Stack.Screen options={{ title: 'Assistant', headerRight: () => (list.length ? <IconButton icon="trash-outline" tone="clear" size={34} label="Clear conversation" onPress={clear} /> : null) }} />
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 20, gap: 12 }}>
        {!aiConfigured ? (
          <Banner
            tone="warn"
            title="The assistant isn’t connected yet"
            body="It needs the Knivy backend, which comes in a later release. Until then, messages won’t get an answer. Knivy never shows a made-up reply."
          />
        ) : null}
        <Banner body="General wellness information only. The assistant can’t diagnose conditions, prescribe or change medication, or handle emergencies. For health concerns, talk to a professional." />
        {list.length === 0 ? (
          <View style={{ marginTop: 12 }}>
            <Txt tone="muted">
              Ask about sleep habits, hydration, building a workout routine, or what a trend in your data might mean.
            </Txt>
          </View>
        ) : null}
        {list.map((m) => {
          if (m.data.role === 'notice') {
            const emergency = m.data.kind === 'emergency';
            return <Banner key={m.id} tone={emergency || m.data.kind === 'error' ? 'warn' : 'info'} title={emergency ? 'If this is an emergency' : undefined} body={m.data.content} />;
          }
          const mine = m.data.role === 'user';
          return (
            <View
              key={m.id}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                backgroundColor: mine ? colors.ink : colors.paper,
                borderRadius: 20,
                borderBottomRightRadius: mine ? 6 : 20,
                borderBottomLeftRadius: mine ? 20 : 6,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Txt tone={mine ? 'inverse' : 'ink'}>{m.data.content}</Txt>
            </View>
          );
        })}
        {sending ? (
          <Txt variant="caption" tone="muted">
            Sending
          </Txt>
        ) : null}
      </ScrollView>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 10,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: insets.bottom + 10,
          borderTopWidth: 1,
          borderTopColor: colors.sand,
          backgroundColor: colors.ivory,
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Ask a wellness question"
          placeholderTextColor={colors.taupe}
          multiline
          maxLength={LIMITS.message}
          accessibilityLabel="Message"
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 120,
            backgroundColor: colors.paper,
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 12,
            fontFamily: fonts.body,
            fontSize: 16,
            color: colors.ink,
          }}
        />
        <IconButton icon="arrow-up" tone="ink" size={44} label="Send" onPress={() => void send()} />
      </View>
    </KeyboardAvoidingView>
  );
}
