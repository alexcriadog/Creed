import { View, ViewProps } from 'react-native';

export function Surface({ className = '', ...props }: ViewProps) {
  return <View className={`bg-surface border border-border rounded-lg p-5 ${className}`} {...props} />;
}
