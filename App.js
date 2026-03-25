import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StatusBar,
  Animated, ScrollView, TextInput, KeyboardAvoidingView,
  Platform, Vibration, Linking, Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://api.anthropic.com/v1/messages';
const STORAGE_KEY = '@aria_key';
const SYSTEM_PROMPT = 'Ты ARIA - голосовой ассистент в Android телефоне. Отвечай ТОЛЬКО на русском, коротко (1-3 предложения), без Markdown и эмодзи. Ты дружелюбная и ироничная, зовут тебя Ария.';

const C = {
  bg: '#06090f',
  bg2: '#0c1220',
  blue: '#4a9eff',
  purple: '#a855f7',
  text: '#c8e0ff',
  dim: '#2a3a5a',
};

export default function App() {
  var screen = useState('setup');
  var setScreen = screen[1];
  screen = screen[0];

  var apiKeyState = useState('');
  var setApiKey = apiKeyState[1];
  var apiKey = apiKeyState[0];

  var apiInputState = useState('');
  var setApiInput = apiInputState[1];
  var apiInput = apiInputState[0];

  var msgsState = useState([]);
  var setMsgs = msgsState[1];
  var msgs = msgsState[0];

  var thinkingState = useState(false);
  var setThinking = thinkingState[1];
  var thinking = thinkingState[0];

  var speakingState = useState(false);
  var setSpeaking = speakingState[1];
  var speaking = speakingState[0];

  var inputState = useState('');
  var setInput = inputState[1];
  var inputText = inputState[0];

  var showChatState = useState(false);
  var setShowChat = showChatState[1];
  var showChat = showChatState[0];

  var orbA = useRef(new Animated.Value(0)).current;
  var scrollRef = useRef(null);
  var msgsRef = useRef(msgs);
  msgsRef.current = msgs;

  useEffect(function() {
    AsyncStorage.getItem(STORAGE_KEY).then(function(k) {
      if (k) {
        setApiKey(k);
        setScreen('main');
      }
    });
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbA, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(orbA, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
    return function() { Speech.stop(); };
  }, []);

  function saveKey() {
    if (!apiInput.trim().startsWith('sk-ant-')) {
      Alert.alert('Ошибка', 'Ключ должен начинаться с sk-ant-...');
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, apiInput.trim()).then(function() {
      setApiKey(apiInput.trim());
      setScreen('main');
    });
  }

  function send() {
    var text = inputText.trim();
    if (!text || thinking) return;
    setInput('');
    Vibration.vibrate(20);
    var history = msgsRef.current.concat([{ role: 'user', content: text }]);
    setMsgs(history);
    setThinking(true);
    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: history.slice(-10),
      }),
    }).then(function(res) {
      return res.json();
    }).then(function(d) {
      if (d.error) throw new Error(d.error.message);
      var reply = d.content && d.content[0] ? d.content[0].text : 'Нет ответа.';
      var next = history.concat([{ role: 'assistant', content: reply }]);
      setMsgs(next);
      setThinking(false);
      setSpeaking(true);
      Speech.speak(reply, {
        language: 'ru-RU',
        rate: 1.0,
        pitch: 1.1,
        onDone: function() { setSpeaking(false); },
        onError: function() { setSpeaking(false); },
      });
    }).catch(function(e) {
      var msg = e.message && e.message.includes('401') ? 'Неверный API ключ.' : 'Ошибка сети.';
      setMsgs(history.concat([{ role: 'assistant', content: msg }]));
      setThinking(false);
    });
  }

  var orbScale = orbA.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  var orbOp = orbA.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });

  if (screen === 'setup') {
    return (
      React.createElement(KeyboardAvoidingView, {
        style: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
        behavior: Platform.OS === 'ios' ? 'padding' : 'height',
      },
        React.createElement(StatusBar, { barStyle: 'light-content', backgroundColor: C.bg }),
        React.createElement(Animated.View, {
          style: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.blue, opacity: orbOp, transform: [{ scale: orbScale }], marginBottom: 24 }
        }),
        React.createElement(Text, { style: { fontSize: 44, fontWeight: '200', color: '#fff', letterSpacing: 14, marginBottom: 8 } }, 'ARIA'),
        React.createElement(Text, { style: { fontSize: 12, color: C.dim, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 24 } }, 'Голосовой ассистент'),
        React.createElement(Text, { style: { fontSize: 13, color: C.dim, textAlign: 'center', lineHeight: 22, marginBottom: 16 } },
          'Введи API ключ: ',
          React.createElement(Text, { style: { color: C.blue, textDecorationLine: 'underline' }, onPress: function() { Linking.openURL('https://console.anthropic.com/keys'); } }, 'console.anthropic.com/keys')
        ),
        React.createElement(TextInput, {
          style: { width: '100%', backgroundColor: C.bg2, borderRadius: 12, borderWidth: 1, borderColor: C.dim, color: C.text, paddingHorizontal: 16, paddingVertical: 14, fontSize: 13, marginBottom: 12 },
          value: apiInput,
          onChangeText: setApiInput,
          placeholder: 'sk-ant-api03-...',
          placeholderTextColor: C.dim,
          autoCapitalize: 'none',
          autoCorrect: false,
          secureTextEntry: true,
          selectionColor: C.blue,
        }),
        React.createElement(TouchableOpacity, {
          style: { width: '100%', backgroundColor: C.blue, borderRadius: 12, paddingVertical: 15, alignItems: 'center', opacity: apiInput.trim() ? 1 : 0.4 },
          onPress: saveKey,
          disabled: !apiInput.trim(),
        },
          React.createElement(Text, { style: { color: '#fff', fontSize: 16, fontWeight: '600' } }, 'Запустить ARIA')
        )
      )
    );
  }

  return (
    React.createElement(View, { style: { flex: 1, backgroundColor: C.bg } },
      React.createElement(StatusBar, { barStyle: 'light-content', backgroundColor: C.bg, translucent: true }),

      React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 12 } },
        React.createElement(Text, { style: { fontSize: 20, color: '#fff', fontWeight: '200', letterSpacing: 8 } }, 'ARIA'),
        React.createElement(View, { style: { flexDirection: 'row', gap: 4 } },
          React.createElement(TouchableOpacity, { style: { padding: 8 }, onPress: function() { setShowChat(function(v) { return !v; }); } },
            React.createElement(Text, { style: { fontSize: 20, color: C.dim } }, showChat ? 'X' : '=')
          ),
          React.createElement(TouchableOpacity, { style: { padding: 8 }, onPress: function() {
            AsyncStorage.removeItem(STORAGE_KEY);
            setScreen('setup');
            setMsgs([]);
          }},
            React.createElement(Text, { style: { fontSize: 20, color: '#ff4a6a' } }, 'O')
          )
        )
      ),

      showChat ? (
        React.createElement(ScrollView, {
          ref: scrollRef,
          style: { flex: 1, paddingHorizontal: 16 },
          contentContainerStyle: { paddingVertical: 8 },
          onContentSizeChange: function() { if (scrollRef.current) scrollRef.current.scrollToEnd({ animated: true }); }
        },
          msgs.length === 0
            ? React.createElement(Text, { style: { color: C.dim, textAlign: 'center', marginTop: 40, fontSize: 14 } }, 'История пуста')
            : msgs.map(function(m, i) {
              return React.createElement(View, {
                key: i,
                style: { borderRadius: 14, padding: 12, maxWidth: '85%', marginBottom: 8, backgroundColor: m.role === 'user' ? '#0f1e38' : '#13082a', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start' }
              },
                React.createElement(Text, { style: { fontSize: 10, color: C.dim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 } }, m.role === 'user' ? 'Ты' : 'Ария'),
                React.createElement(Text, { style: { color: C.text, fontSize: 14, lineHeight: 20 } }, m.content)
              );
            })
        )
      ) : (
        React.createElement(View, { style: { flex: 1, alignItems: 'center', justifyContent: 'center' } },
          React.createElement(Animated.View, {
            style: { width: 130, height: 130, borderRadius: 65, backgroundColor: speaking ? C.purple : C.blue, alignItems: 'center', justifyContent: 'center', elevation: 20, transform: [{ scale: orbScale }], opacity: orbOp }
          },
            React.createElement(View, { style: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)' } })
          ),
          React.createElement(Text, { style: { marginTop: 32, color: thinking ? '#f7b731' : speaking ? C.purple : C.dim, fontSize: 14, letterSpacing: 1 } },
            thinking ? 'Думаю...' : speaking ? 'Говорю...' : 'Напиши сообщение'
          )
        )
      ),

      React.createElement(KeyboardAvoidingView, { behavior: Platform.OS === 'ios' ? 'padding' : 'height' },
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8, gap: 10 } },
          React.createElement(TextInput, {
            style: { flex: 1, backgroundColor: C.bg2, borderRadius: 24, borderWidth: 1, borderColor: C.dim, color: C.text, paddingHorizontal: 18, paddingVertical: 12, fontSize: 15 },
            value: inputText,
            onChangeText: setInput,
            placeholder: 'Напиши Arie...',
            placeholderTextColor: C.dim,
            selectionColor: C.blue,
            multiline: false,
            onSubmitEditing: send,
            returnKeyType: 'send',
          }),
          React.createElement(TouchableOpacity, {
            style: { width: 48, height: 48, borderRadius: 24, backgroundColor: inputText.trim() ? C.blue : C.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: inputText.trim() ? C.blue : C.dim },
            onPress: send,
            disabled: !inputText.trim() || thinking,
          },
            React.createElement(Text, { style: { fontSize: 20, color: '#fff' } }, '>')
          )
        )
      )
    )
  );
}
