// Yalnız ShareableMemory alanları: şehir, gün sayısı, damga sayısı
export function ShareCard({ memory }: { memory: ShareableMemory }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={t('share.button')} onPress={go}>
    <Text style={{ color: colors.text }}>{memory.city.toLocaleUpperCase('tr-TR')}</Text></Pressable>;
}
