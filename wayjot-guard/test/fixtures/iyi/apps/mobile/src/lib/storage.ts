import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
export const setTheme = (v: string) => AsyncStorage.setItem('theme', v);
export async function wipe() { await SecureStore.deleteItemAsync('db-key'); }
export const totalMinor = (priceMinor: number, qty: number) => priceMinor * qty;
