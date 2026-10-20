// Node stand-in for expo-network (only used by the Wi-Fi scan, which never runs in the eval).
export async function getIpAddressAsync(): Promise<string> {
  return '0.0.0.0';
}
