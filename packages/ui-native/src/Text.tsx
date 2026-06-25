import { Text as RNText, TextProps } from 'react-native';

type Variant = 'title' | 'body' | 'muted';
const styles: Record<Variant, string> = {
  title: 'text-text-primary text-2xl font-semibold',
  body: 'text-text-primary text-base',
  muted: 'text-text-muted text-sm',
};

export function AppText({ variant = 'body', className = '', ...props }: TextProps & { variant?: Variant }) {
  return <RNText className={`${styles[variant]} ${className}`} {...props} />;
}
