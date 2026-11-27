import QRCode from 'qrcode';
import { Platform, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Button, C, F, Muted, Screen } from '@/components/ui';
import { siteBase } from '@/lib/role';
import { useChurch } from '@/lib/session';
import { useData } from '@/lib/use-data';

/** QR Code fixo da entrada da igreja: leva à tela de boas-vindas do visitante. */
export default function QrEntrada() {
  const { church, color } = useChurch();
  const url = `${siteBase()}/app/bem-vindo?c=${church.slug}`;
  const { data: svg } = useData(() => QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b3d24', light: '#ffffff' } }), '', url);

  return (
    <Screen color={color}>
      <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: C.border, padding: 24, alignItems: 'center', gap: 14 }}>
        <Text style={{ fontFamily: F.extrabold, fontSize: 26, color: C.text, textAlign: 'center' }}>Seja bem-vindo!</Text>
        <Text style={{ fontFamily: F.medium, fontSize: 16, color: C.body, textAlign: 'center' }}>
          Aponte a câmera do celular e faça parte da {church.name}
        </Text>
        {svg ? <SvgXml xml={svg} width={260} height={260} /> : <View style={{ width: 260, height: 260 }} />}
        <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted, textAlign: 'center' }}>{url.replace(/^https?:\/\//, '')}</Text>
      </View>
      {Platform.OS === 'web' && <Button title="Imprimir" color={color} onPress={() => window.print()} />}
      <Muted>Este QR Code não muda: imprima uma vez e deixe na recepção, na porta e no telão. Quem escaneia se cadastra como visitante e, se tiver culto no dia, já fica com a presença marcada.</Muted>
    </Screen>
  );
}
