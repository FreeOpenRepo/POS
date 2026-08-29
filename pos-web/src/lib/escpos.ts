/**
 * Browser ESC/POS Printer integration (Web Bluetooth + Raw byte generation)
 */

export async function printViaWebBluetooth(rawBytes: Uint8Array): Promise<boolean> {
  if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
    throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome on Android/Desktop.');
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
    });

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

    // Send in chunks of 512 bytes
    const chunkSize = 512;
    for (let i = 0; i < rawBytes.length; i += chunkSize) {
      const chunk = rawBytes.slice(i, i + chunkSize);
      await characteristic.writeValue(chunk);
    }

    return true;
  } catch (err: any) {
    console.error('Bluetooth printing failed:', err);
    throw err;
  }
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
