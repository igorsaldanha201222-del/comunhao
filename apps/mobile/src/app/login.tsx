import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, C, F, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';

const GREEN = '#007a3d';

export default function Login() {
  const insets = useSafeAreaInsets();
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ backgroundColor: C.dark, paddingTop: insets.top + 56, paddingBottom: 64, paddingHorizontal: 24, gap: 10 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 13, color: '#9fd9b5', letterSpacing: 1.2, textTransform: 'uppercase' }}>Comunhão</Text>
          <Text style={{ fontFamily: F.extrabold, fontSize: 32, lineHeight: 38, color: '#fff', letterSpacing: -0.5 }}>
            {mode === 'entrar' ? 'Bem-vindo de volta' : 'Crie sua conta'}
          </Text>
          <Text style={{ fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.8)' }}>
            Sua igreja no celular: cultos, escalas, avisos, devocional e contribuições.
          </Text>
        </View>
        <View style={{ padding: 20, marginTop: -32, gap: 14 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 20, gap: 14, shadowColor: '#14201a', shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4 }}>
            {mode === 'criar' && <Input label="Seu nome" value={name} onChangeText={setName} autoComplete="name" />}
            <Input label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Input label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'entrar' ? 'password' : 'new-password'} />
            <Button title={mode === 'entrar' ? 'Entrar' : 'Criar conta'} color={GREEN} onPress={submit} loading={busy}
              disabled={!email || password.length < 6 || (mode === 'criar' && !name)} />
          </View>
          <Pressable onPress={() => setMode(mode === 'entrar' ? 'criar' : 'entrar')} style={{ padding: 10 }} accessibilityRole="button">
            <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.text, textAlign: 'center' }}>
              {mode === 'entrar' ? 'Não tem conta? Criar agora' : 'Já tenho conta. Entrar'}
            </Text>
          </Pressable>
          <Text style={{ fontFamily: F.regular, fontSize: 13, lineHeight: 19, color: C.muted, textAlign: 'center' }}>
            Visitando uma igreja? Aponte a câmera para o QR Code da entrada e entre sem senha.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
