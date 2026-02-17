import noble, { Peripheral } from "@stoprocent/noble";
import { serializer } from "@systemic-games/pixels-web-connect";

import { PixelBluetoothConfig } from "./types";
import { BatteryEvent, Listener, RollEvent } from "./pixelManager.types";

const knownDevices = [
	"D20",
	"D12",
	"D8",
	"D6",
	"D4",
];

export class PixelManager {
	private _devices: Map<string, PixelBluetoothConfig> = new Map();
	private _listeners: Map<string, Listener[]> = new Map();

	public async addListener(deviceId: string, listener: Listener) {
		console.info(`[PixelManager.addListener]: Adding listener to device ${deviceId}`);

		if (!this._listeners.has(deviceId)) {
			this._listeners.set(deviceId, []);
		}

		const listeners = this._listeners.get(deviceId) as Listener[];
		listeners.push(listener);

		const device = this._devices.get(deviceId);

		if (!device) {
			console.error(`[PixelManager.addListener]: Device ${deviceId} is not connected, returning`);

			return;
		}

		if (device.notify.listeners("data").length) {
			device.notify.removeAllListeners();
		}

		this.resetListeners(device);
	}

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

			this.resetListeners(device);

			console.log(`[PixelManager.connect]: Subscribed to notify event for device ${id}`, { device });

			this._devices.set(id, device);
		} catch (error) {
			console.error(`[PixelManager.connect]: Something went wrong while connecting to device ${id}`, { error });

			throw new Error("Something went wrong while connecting to device", { cause: error });
		}
	}

	public async disconnect(id: string) {
		console.info(`[PixelManager.disconnect]: Attempting to disconnect from device ${id}`);

		const device = this._devices.get(id);
		const listeners = this._listeners.get(id);

		if (listeners) {
			this._listeners.delete(id);
		}

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

	public async removeListener(deviceId: string, actionId: string) {
		console.info(`[PixelManager.removeListener]: Removing listener ${actionId} from device ${deviceId}`);

		const device = this._devices.get(deviceId);

		if (!device) {
			console.error(`[PixelManager.removeListener]: Device ${deviceId} is not connected`);

			return;
		}

		if (!this._listeners.has(deviceId)) {
			this._listeners.set(deviceId, []);
			return;
		}

		const listeners = this._listeners.get(deviceId) as Listener[];
		const index = listeners.findIndex((listener) => listener.actionId === actionId);

		if (index === -1) {
			console.warn(
				`[PixelManager.removeListener]: Attempted to remove non-listening listener ${actionId} from device ${deviceId}`,
			);

			return;
		}

		this._listeners.set(deviceId, [
			...listeners.slice(0, index),
			...listeners.slice(index + 1, listeners.length),
		]);

		this.resetListeners(device);
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

	private resetListeners(device: PixelBluetoothConfig) {
		console.info(`[PixelManager.resetListeners]: Resetting listeners for device ${device.id}`);

		if (device.notify.listeners("data").length) {
			console.info(`[PixelManager.resetListeners]: Removing existing listeners for device ${device.id}`);

			device.notify.removeAllListeners();
		}

		const listeners = this._listeners.get(device.id);

		if (!listeners) {
			console.info(`[PixelManager.resetListeners]: No listeners to reset for device ${device.id}`);
			return;
		}

		console.info(`[PixelManager.resetListeners]: Setting up ${listeners.length} listeners for device ${device.id}`);

		device.notify.on("data", async (data) => {
			const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
			const message = serializer.deserializeMessage(dataView);
			const messageType = serializer.getMessageType(message);

			await Promise.all(
				listeners.map(async ({ type, listener }) => {
					if (type === messageType && type === "rollState") {
						await listener(message as RollEvent);
					} else if (type === messageType && type === "batteryLevel") {
						await listener(message as BatteryEvent);
					}
				}),
			);
		});
	}
}
