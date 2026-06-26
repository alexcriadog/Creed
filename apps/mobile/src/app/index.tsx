import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@creed/ui-native';
import { useAuth } from '../lib/auth-context';

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return <Redirect href={session ? '/(app)' : '/(auth)/login'} />;
}
