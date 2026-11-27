import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, C, Input, s } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const { data, error } = mode === 'entrar'
      ? await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      : await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { full_name: name.trim() } } });
    setBusy(false);
    if (error) return Alert.alert('Ops', mode === 'entrar' ? 'E-mail ou senha inválidos.' : error.message);
    if (mode === 'criar' && !data.session) Alert.alert('Confirme seu e-mail', 'Enviamos um link de confirmação. Depois é só entrar.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 14 }}>
        <Text style={s.title}>{mode === 'entrar' ? 'Bem-vindo de volta' : 'Criar conta'}</Text>
        <Text style={s.muted}>Acompanhe a sua igreja: programação, escalas, pregações e contribuições.</Text>
        <View style={{ gap: 12, marginTop: 8 }}>
          {mode === 'criar' && <Input label="Seu nome" value={name} onChangeText={setName} autoComplete="name" />}
          <Input label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Input label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
          <Button title={mode === 'entrar' ? 'Entrar' : 'Criar conta'} onPress={submit} loading={busy}
            disabled={!email || password.length < 6 || (mode === 'criar' && !name)} />
        </View>
        <Pressable onPress={() => setMode(mode === 'entrar' ? 'criar' : 'entrar')} style={{ padding: 8 }}>
          <Text style={[s.muted, { textAlign: 'center' }]}>
            {mode === 'entrar' ? 'Não tem conta? Criar agora' : 'Já tenho conta. Entrar'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
