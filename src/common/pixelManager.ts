import noble, { Peripheral } from "@stoprocent/noble";
import { serializer } from "@systemic-games/pixels-web-connect";

import { PixelBluetoothConfig } from "./types";
import { EventBus } from "./eventBus";
import { EventType } from "./eventBus.types";
import { BatteryEvent, RollEvent } from "./pixelManager.types";

const knownDevices = [
	"D20",
	"D12",
	"D8",
	"D6",
	"D4",
];

export class PixelManager {
	private _devices: Map<string, PixelBluetoothConfig> = new Map();

	public async connect(id: string): Promise<void> {
		console.info(`[PixelManager.connect]: Attempting to connect to device ${id}`);

		try {
			await noble.waitForPoweredOnAsync(10000);
			const peripheral = await noble.connectAsync(id, { timeout: 10000 });

			console.log(`[PixelManager.connect]: Connected to device ${id}`, { peripheral });

			const { characteristics } = await peripheral.discoverAllServicesAndCharacteristicsAsync();

			const notify = characteristics.find(({ properties }) => properties?.includes?.("notify"));
			const write = characteristics.find(({ properties }) => properties?.includes?.("write"));

			if (!notify || !write) {
				console.error(`[PixelManager.connect]: Required Characteristics not found for device ${id}`, {
					characteristics,
					peripheral,
				});

				throw new Error("Required characteristics not found on Pixel device");
			}

			await notify.subscribeAsync();

			const device = {
				id,
				peripheral,
				notify,
				write,
			};

			notify.on("data", async (data) => {
				const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
				const message = serializer.deserializeMessage(dataView);
				const messageType = serializer.getMessageType(message);

				if (messageType === 'rollState') {
					await EventBus.emit(EventType.PixelRoll, {
						id,
						event: message as RollEvent
					});
				}

				if ( messageType === "batteryLevel") {
					await EventBus.emit(EventType.PixelBattery, {
						id,
						event: message as BatteryEvent
					});
				}
			});

			peripheral.on('disconnect', async () => {
				await this.disconnect(id);
			});

			console.log(`[PixelManager.connect]: Subscribed to notify event for device ${id}`, { device });

			this._devices.set(id, device);

			await EventBus.emit(EventType.PixelConnect, { id });
		} catch (error) {
			console.error(`[PixelManager.connect]: Something went wrong while connecting to device ${id}`, { error });

			throw new Error("Something went wrong while connecting to device", { cause: error });
		}
	}

	public async disconnect(id: string) {
		console.info(`[PixelManager.disconnect]: Attempting to disconnect from device ${id}`);
		
		await EventBus.emit(EventType.PixelDisconnect, { id });

		const device = this._devices.get(id);

		if (!device) {
			console.warn(`[PixelManager.disconnect]: Attempted to disconnect from an unknown device ${id}`);

			return;
		}

		try {
			await device.peripheral.disconnectAsync();

			console.log(`[PixelManager.disconnect]: Successfully disconnected device ${id}`);
		} catch (error) {
			console.error(`[PixelManager.disconnect]: Device failed to disconnect from device ${id}, swallowing error`, {
				error,
			});
		}

		this._devices.delete(id);
	}

	public async discoverDevices(callback: (id: string, name: string) => void) {
		console.info("[PixelManager.discoverDevices]: Starting device discovery");

		try {
			await noble.waitForPoweredOnAsync(10000);
			await noble.startScanningAsync();

			noble.on("discover", async (peripheral: Peripheral) => {
				if (knownDevices.includes(peripheral.advertisement.localName)) {
					console.info("[PixelManager.discoverDevices]: Device Found", { peripheral });

					callback(peripheral.id, peripheral.advertisement.localName);
				}
			});
		} catch (error) {
			console.error("[PixelManager.discoverDevices]: Something went wrong while discovering devices", { error });

			throw new Error("Something went wrong while discovering devices", { cause: error });
		}
	}

	public getDevice(id: string): PixelBluetoothConfig | undefined {
		console.info(`[PixelManager.getDevice]: Getting device ${id}`);

		return this._devices.get(id);
	}

	public async reset() {
		console.info("[PixelManager.reset]: Resetting PixelManager, disconnecting from all devices");

		for (const deviceId of this._devices.keys()) {
			await this.disconnect(deviceId);
		}
	}

	public async stopDiscover() {
		console.info("[PixelManager.stopDiscover]: Stopping device discovery");

		try {
			if (noble.state === "poweredOn") {
				await noble.stopScanningAsync();

				console.info(`[PixelManager.stopDiscover]: Discovery stopped successfully`);
			} else {
				console.info(`[PixelManager.stopDiscover]: Discovery is not running, nothing to stop`);
			}
		} catch (error) {
			console.error("[PixelManager.stopDiscover]: Stopping discovery failed!", { error });
		}
	}
}
