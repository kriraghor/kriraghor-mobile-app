import * as ImagePicker from 'expo-image-picker';

/**
 * Choose one picture from the phone's photos (game profile screenshots, dispute evidence). Only
 * JPEG or PNG are accepted by the API; anything else (HEIC on iPhones) is re-encoded as JPEG by
 * the picker through `quality`. Returns null when the user cancels; throws 'denied' without access.
 */
export async function pickImage(): Promise<{ uri: string; mime: 'image/jpeg' | 'image/png' } | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('denied');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: false, exif: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, mime: a.mimeType === 'image/png' ? 'image/png' : 'image/jpeg' };
}
