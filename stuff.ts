import noble, { Peripheral, Characteristic } from "@stoprocent/noble";
import { PixelsBluetoothIds, PixelSession } from "@systemic-games/pixels-core-connect";

(noble as any).setMaxListeners?.(50); // avoid Node MaxListeners warning during development

export default class NobleBleSession extends PixelSession {
  private _peripheral: Peripheral | null = null;
  private _notifyChar?: Characteristic;
  private _writeChar?: Characteristic;

  constructor(private systemId: string, name?: string) {
    super(systemId, name);
  }

  private async findPeripheralByIdOrName(timeoutMs = 10000): Promise<Peripheral | undefined> {
    await noble.waitForPoweredOnAsync?.(timeoutMs).catch(() => {});
    const serviceUuid = PixelsBluetoothIds.legacyDie.service;
    await noble.startScanningAsync?.([serviceUuid], false);
    try {
      for await (const p of noble.discoverAsync?.() ?? []) {
        if (p.id === this.systemId || p.advertisement?.localName === this.systemId) {
          return p;
        }
      }
    } finally {
      await noble.stopScanningAsync?.().catch(() => {});
    }
    return undefined;
  }

  async connect(timeoutMs = 10000): Promise<void> {
    if (this._peripheral && this._peripheral.state === "connected") {
      this._notifyConnectionEvent("ready");
      return;
    }

    // Find peripheral (by id or advertised name)
    const peripheral = await this.findPeripheralByIdOrName(timeoutMs);
    if (!peripheral) throw new Error("Peripheral not found");

    this._peripheral = peripheral;
    this._notifyConnectionEvent("connecting");
    await peripheral.connectAsync();
    this._notifyConnectionEvent("connected");

    const { services, characteristics } = await peripheral.discoverAllServicesAndCharacteristicsAsync();
    const uuids = PixelsBluetoothIds.legacyDie;
    // find notify & write by UUID
    this._notifyChar = characteristics.find((c) => c.uuid === uuids.notifyCharacteristic);
    this._writeChar = characteristics.find((c) => c.uuid === uuids.writeCharacteristic);

    if (!this._notifyChar || !this._writeChar) {
      // fallback: try matching by property names
      this._notifyChar ??= characteristics.find((c) => c.properties?.includes?.("notify"));
      this._writeChar ??= characteristics.find((c) => c.properties?.includes?.("write"));
    }

    if (!this._notifyChar || !this._writeChar) {
      throw new Error("Required characteristics not found");
    }

    this._notifyConnectionEvent("ready");
  }

  async disconnect(): Promise<void> {
    try {
      await this._peripheral?.disconnectAsync?.();
    } finally {
      this._peripheral = null;
      this._notifyChar = undefined;
      this._writeChar = undefined;
      this._notifyConnectionEvent("disconnected");
    }
  }

  /**
   * Subscribe to notifications. Listener receives a Buffer.
   * Returns an unsubscribe function.
   */
  async subscribe(listener: (data: Buffer) => void): Promise<() => void> {
    if (!this._notifyChar) throw new Error("Not connected");

    const handler = (data: Buffer, isNotification?: boolean) => {
      // noble emits Buffer in first arg
      listener(data);
    };

    this._notifyChar.on("data", handler);

    // Start notifications using available API
    try {
      if ((this._notifyChar as any).subscribeAsync) {
        await (this._notifyChar as any).subscribeAsync();
      } else if ((this._notifyChar as any).subscribe) {
        await new Promise<void>((res, rej) => (this._notifyChar as any).subscribe((err: any) => (err ? rej(err) : res())));
      } else if ((this._notifyChar as any).notify) {
        (this._notifyChar as any).notify(true, () => {});
      } else {
        // no-op
      }
    } catch (err) {
      this._notifyChar.removeListener("data", handler);
      throw err;
    }

    return async () => {
      try {
        if ((this._notifyChar as any).unsubscribeAsync) {
          await (this._notifyChar as any).unsubscribeAsync();
        } else if ((this._notifyChar as any).unsubscribe) {
          await new Promise<void>((res) => (this._notifyChar as any).unsubscribe(() => res()));
        } else if ((this._notifyChar as any).notify) {
          (this._notifyChar as any).notify(false, () => {});
        }
      } catch {}
      this._notifyChar?.removeListener("data", handler);
    };
  }

  async writeValue(data: ArrayBuffer | Buffer, withoutResponse = false): Promise<void> {
    if (!this._writeChar) throw new Error("Not connected");
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if ((this._writeChar as any).writeAsync) {
      await (this._writeChar as any).writeAsync(buffer, withoutResponse);
    } else if ((this._writeChar as any).write) {
      await new Promise<void>((res, rej) =>
        (this._writeChar as any).write(buffer, withoutResponse, (err: any) => (err ? rej(err) : res()))
      );
    } else {
      throw new Error("Characteristic write method not available");
    }
  }
}