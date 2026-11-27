import { router } from 'expo-router';

import { PersonForm } from '@/components/person-form';
import { Screen } from '@/components/ui';
import { useChurch } from '@/lib/session';

export default function NovaPessoa() {
  const { color } = useChurch();
  return (
    <Screen color={color}>
      <PersonForm onSaved={(id) => router.replace({ pathname: '/pessoas/[id]', params: { id } })} />
    </Screen>
  );
}
