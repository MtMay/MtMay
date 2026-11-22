import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
const KEY = 'sb_secret_abcdef123456';
export async function savePnr(pnr: string) {
  console.log('pnr kaydedildi', pnr);
  await AsyncStorage.setItem('pnr', pnr);
  await SecureStore.setItemAsync('db-key', 'x');
}
export const total = (price: number) => price * 1.18;
