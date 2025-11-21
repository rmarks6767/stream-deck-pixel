import noble, { Peripheral } from "@stoprocent/noble";
import { PixelsBluetoothIds } from "@systemic-games/pixels-core-connect";

const _devices = new Map<string, Peripheral>();

/** Singleton that manages a list of Bluetooth devices for Pixels. */
export const PixelsDevices = {
  /**
   * Attempts to connect to all available Pixels die by local name of
   * scanned Pixels dice.
   * @returns A promise resolving to a Peripheral for a Pixel.
   */
  async requestDevice(id?: string): Promise<Peripheral> {
    await noble.waitForPoweredOnAsync(10000);
    await noble.startScanningAsync(
      [PixelsBluetoothIds.legacyDie.service, PixelsBluetoothIds.die.service],
      false
    );

    let pixelDevice = undefined;
    for await (const peripheral of noble.discoverAsync()) {
      if (id) {
        if (peripheral.id === id) {
          pixelDevice = peripheral;
          console.log("Pixel device found:", peripheral.id);
          break;
        }
      } else if (peripheral.advertisement.localName === "D20") {
        pixelDevice = peripheral;
        console.log("Pixel device found:", peripheral.id);
        break;
      }
    }

    await noble.stopScanningAsync();

    if (!pixelDevice) {
      throw new Error("No Pixel devices found");
    }

    _devices.set(pixelDevice.id, pixelDevice);

    return pixelDevice;
  },

  /**
   * Returns the Bluetooth device for a Pixels die that's been previously
   * requested with {@link requestDevice}
   * @param id The unique id of the Bluetooth device as assigned by the system.
   * @returns The corresponding Peripheral if found, or undefined.
   */
  getKnownDevice(id: string): Peripheral | undefined {
    return _devices.get(id);
  },

  /**
   * Returns the Bluetooth device for a Pixels die that's been previously
   * authorized by the user in this or previous browser sessions.
   * @param id The unique id of the Bluetooth device as assigned by the system.
   * @returns The corresponding Peripheral if found, or undefined.
   */
  async getDevice(id: string): Promise<Peripheral | undefined> {
    let device = _devices.get(id);

    if (!device) {
      try {
        device = await this.requestDevice(id);
      } catch (e) {
        console.error("Error requesting Pixel device:", e);
        return undefined;
      }
    }

    return device;
  },
};
