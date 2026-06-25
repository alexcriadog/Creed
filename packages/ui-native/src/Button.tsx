import { Pressable, Text, ActivityIndicator, View } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
};

export function Button({ label, onPress, loading = false, disabled = false, variant = 'primary' }: Props) {
  const isPrimary = variant === 'primary';
  const inactive = loading || disabled;
  return (
    <Pressable
      testID="button"
      accessibilityRole="button"
      disabled={inactive}
      onPress={inactive ? undefined : onPress}
      className={`h-12 rounded-lg items-center justify-center ${isPrimary ? 'bg-accent' : 'bg-transparent'} ${inactive ? 'opacity-50' : 'active:opacity-80'}`}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FCFCFD' : '#4F62E0'} />
      ) : (
        <View>
          <Text className={`text-base font-semibold ${isPrimary ? 'text-text-on-accent' : 'text-accent'}`}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
