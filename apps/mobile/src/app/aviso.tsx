import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button, C, Card, F, Input, Muted, Screen } from '@/components/ui';
import { sendNotify } from '@/lib/notify';
import { useChurch } from '@/lib/session';

export default function EnviarAviso() {
  const { church, color } = useChurch();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (title.trim().length < 2 || body.trim().length < 2) return Alert.alert('Aviso', 'Preencha o título e a mensagem.');
    setBusy(true);
    try {
      const r = await sendNotify({ church_id: church.id, kind: 'aviso', title, body });
      Alert.alert('Aviso enviado ✅', r.total ? `Chegou em ${r.sent} de ${r.total} celular(es).` : 'Salvo no app. Ainda nenhum celular ativou as notificações.');
      router.back();
    } catch (e) {
      Alert.alert('Não deu para enviar', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen color={color}>
      <Muted>Chega como notificação no celular de todos que ativaram os avisos, e fica na seção Avisos do Início.</Muted>
      <Card>
        <Input label="Título" value={title} onChangeText={setTitle} maxLength={80} placeholder="ex.: Culto de Natal" />
        <Input label="Mensagem" value={body} onChangeText={setBody} maxLength={400} multiline
          placeholder="ex.: Dia 24 às 19h, traga sua família!" />
        <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted, alignSelf: 'flex-end' }}>{body.length}/400</Text>
      </Card>
      {(title || body) ? (
        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.border, gap: 2 }}>
          <Text style={{ fontFamily: F.semibold, fontSize: 11, color: C.muted }}>PRÉVIA · {church.name.toUpperCase()}</Text>
          <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>{title || 'Título'}</Text>
          <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.body }} numberOfLines={3}>{body || 'Mensagem'}</Text>
        </View>
      ) : null}
      <Button title="Enviar para todos" color={color} loading={busy} onPress={send} />
    </Screen>
  );
}
