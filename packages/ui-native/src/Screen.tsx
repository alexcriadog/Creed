import { SafeAreaView } from 'react-native-safe-area-context';
import { ViewProps } from 'react-native';

export function Screen({ className = '', ...props }: ViewProps) {
  return <SafeAreaView className={`flex-1 bg-canvas px-5 ${className}`} {...props} />;
}
