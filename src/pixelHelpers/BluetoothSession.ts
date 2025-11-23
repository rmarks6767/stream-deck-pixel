import {
	PixelsBluetoothIds,
	PixelSession,
} from "@systemic-games/pixels-core-connect";
import noble, { Peripheral, Characteristic } from "@stoprocent/noble";

/**
 *
 */
class BluetoothError extends Error {
	/**
	 *
	 * @param message
	 */
	constructor(message?: string) {
		super(message);
		this.name = "BluetoothError";
	}
}

/**
 *
 */
export class BleSessionError extends Error {
	/**
	 *
	 * @param message
	 */
	constructor(message?: string) {
		super(message);
		this.name = "BleSessionError";
	}
}

/**
 * Noble-based BLE session for Pixel dice.
 */
export default class BleSession extends PixelSession {
	/**
	 *
	 */
	private _peripheral?: Peripheral;
	/**
	 *
	 */
	private _notify?: Characteristic;
	/**
	 *
	 */
	private _write?: Characteristic;
	/**
	 *
	 */
	private _disconnectHandler?: () => void;

	/**
	 *
	 * @param systemId
	 */
	constructor(systemId: string) {
		super(systemId);
	}

	/**
	 *
	 */
	dispose(): void {
		this.setConnectionEventListener(undefined);
		if (this._peripheral && this._disconnectHandler) {
			this._peripheral.removeListener("disconnect", this._disconnectHandler);
			this._disconnectHandler = undefined;
		}
	}

	/**
	 *
	 * @param timeoutMs
	 */
	async connect(timeoutMs: number): Promise<void> {
		console.log("BleSession.connect", this.systemId);

		if (this._peripheral && this._peripheral.state === "connected") {
			this._notifyConnectionEvent("ready");
			return;
		}

		const uuids = PixelsBluetoothIds.legacyDie;

		// Wait for adapter/poweredOn
		try {
			await noble.waitForPoweredOnAsync?.(timeoutMs ?? 10000);
		} catch (err) {
			this._notifyConnectionEvent("disconnected", "bluetoothOff");
			throw new BluetoothError("Bluetooth adapter not available");
		}

		this._notifyConnectionEvent("connecting");

		// Start scanning for the service
		await noble.startScanningAsync?.([uuids.service], false).catch(() => {});

		let found: Peripheral | undefined;
		try {
			for await (const peripheral of noble.discoverAsync?.() ?? []) {
				// match by id or name
				if (
					peripheral.id === this.systemId ||
          peripheral.advertisement?.localName === this.systemId
				) {
					found = peripheral;
					break;
				}
			}
		} finally {
			try {
				await noble.stopScanningAsync?.();
			} catch (e) {
				// ignore
			}
		}

		if (!found) {
			this._notifyConnectionEvent("disconnected", "timeout");
			throw new BleSessionError("Peripheral not found");
		}

		this._peripheral = found;

		// attach disconnect handler
		this._disconnectHandler = () => {
			this._notifyConnectionEvent("disconnected", "linkLoss");
		};
		this._peripheral.on("disconnect", this._disconnectHandler);

		try {
			await this._peripheral.connectAsync();
		} catch (err) {
			this._notifyConnectionEvent("disconnected", "peripheral");
			throw err;
		}

		this._notifyConnectionEvent("connected");

		const { services, characteristics } =
      await this._peripheral.discoverAllServicesAndCharacteristicsAsync();

		this._notify = characteristics.find(
			(c) => c.uuid === uuids.notifyCharacteristic
		);
		this._write = characteristics.find(
			(c) => c.uuid === uuids.writeCharacteristic
		);

		// fallback: find by properties
		if (!this._notify) {
			this._notify = characteristics.find((c) => c.properties?.includes?.("notify"));
		}
		if (!this._write) {
			this._write = characteristics.find((c) => c.properties?.includes?.("write"));
		}

		this._notifyConnectionEvent("ready");
	}

	/**
	 *
	 */
	async disconnect(): Promise<void> {
		console.log("BleSession.disconnect", this.systemId);

		try {
			await this._peripheral?.disconnectAsync?.();
		} catch (_) {
			// ignore
		} finally {
			if (this._peripheral && this._disconnectHandler) {
				this._peripheral.removeListener("disconnect", this._disconnectHandler);
				this._disconnectHandler = undefined;
			}
			this._peripheral = undefined;
			this._notify = undefined;
			this._write = undefined;
			this._notifyConnectionEvent("disconnected", "success");
		}
	}

	/**
	 *
	 * @param listener
	 */
	async subscribe(listener: (dataView: DataView) => void): Promise<() => void> {
		console.log("BleSession.subscribe", this.systemId);

		if (!this._notify) {
			throw new BleSessionError("Not connected");
		}

		const handler = (data: Buffer) => {
			if (!data || !data.buffer) return;
			const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
			try {
				listener(dv);
			} catch (e) {
				// swallow listener errors
				console.warn("subscribe listener error:", e);
			}
		};

		this._notify.on("data", handler);

		try {
			if ((this._notify as any).subscribeAsync) {
				await (this._notify as any).subscribeAsync();
			} else if ((this._notify as any).subscribe) {
				await new Promise<void>((res, rej) =>
					(this._notify as any).subscribe((err: any) => (err ? rej(err) : res()))
				);
			} else if ((this._notify as any).notify) {
				(this._notify as any).notify(true, () => {});
			}
		} catch (err) {
			this._notify.removeListener("data", handler);
			throw err;
		}

		return async () => {
			try {
				if ((this._notify as any).unsubscribeAsync) {
					await (this._notify as any).unsubscribeAsync();
				} else if ((this._notify as any).unsubscribe) {
					await new Promise<void>((res) => (this._notify as any).unsubscribe(() => res()));
				} else if ((this._notify as any).notify) {
					(this._notify as any).notify(false, () => {});
				}
			} catch (_) {
				// ignore
			}
			this._notify?.removeListener("data", handler);
		};
	}

	/**
	 *
	 * @param data
	 * @param withoutResponse
	 * @param _timeoutMs
	 */
	async writeValue(
		data: ArrayBuffer,
		withoutResponse?: boolean,
		_timeoutMs?: number
	): Promise<void> {
		if (!this._write) {
			throw new BleSessionError("Not connected");
		}
		const buf = Buffer.isBuffer(data) ? (data as any) : Buffer.from(data as ArrayBuffer);
		if ((this._write as any).writeAsync) {
			await (this._write as any).writeAsync(buf, !!withoutResponse);
		} else if ((this._write as any).write) {
			await new Promise<void>((res, rej) =>
				(this._write as any).write(buf, !!withoutResponse, (err: any) => (err ? rej(err) : res()))
			);
		} else {
			throw new BleSessionError("Write method not available on characteristic");
		}
	}
}