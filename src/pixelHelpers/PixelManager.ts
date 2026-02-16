import noble, { Peripheral } from "@stoprocent/noble";
import { PixelBluetoothConfig } from "../common/types";
import { serializer } from "@systemic-games/pixels-web-connect";

const knownDevices = ["D20", "D12", "D8", "D6", "D4", ]; // "Govee_H6098_4A34"];

interface RollEvent {
	type: number;
	state: number;
	faceIndex: number;
}

interface BatteryEvent {
	type: number;
	state: number;
	levelPercent: number;
}

interface RollStateListener {
	actionId: string;
	type: 'rollState',
	listener: (event: RollEvent) => Promise<void>
}

interface BatteryStateListener {
	actionId: string;
	type: 'batteryLevel',
	listener: (event: BatteryEvent) => Promise<void>
}

type Listener = BatteryStateListener | RollStateListener;

export class PixelManager {
	private _devices: Map<string, PixelBluetoothConfig> = new Map();
	private _listeners: Map<string, Listener[]> = new Map();

	public async addListener(deviceId: string, listener: Listener) {
		if (!this._listeners.has(deviceId)) {
			this._listeners.set(deviceId, []);
		}

		const listeners = this._listeners.get(deviceId) as Listener[];
		listeners.push(listener);

		const device = this._devices.get(deviceId);

		if (!device) {
			console.error('Device is not connected');

			return;
		}

		if (device.notify.listeners('data').length) {
			device.notify.removeAllListeners();
		}

		this.resetListeners(device);
	}

	public async connect(id: string): Promise<void> {
		try {
			await noble.waitForPoweredOnAsync(10000);
			const peripheral = await noble.connectAsync(id, { timeout: 10000 });

			console.log(`[PixelManager.connect.${id}]: Device Connected`);

			const { characteristics } = await peripheral.discoverAllServicesAndCharacteristicsAsync();

			const notify = characteristics.find(({ properties }) => properties?.includes?.("notify"));
			const write = characteristics.find(({ properties }) => properties?.includes?.("write"));

			if (!notify || !write) {
				console.error(`[PixelManager.connect.${id}]: Required Characteristics not found!`, characteristics, peripheral);

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

			console.log(`[PixelManager.connect.${id}]: Subscribed to notify event`);

			this._devices.set(id, device);
		} catch (error) {
			console.error(`[device.${id}]: Something went wrong while connecting to device`, error);

			throw new Error("Something went wrong while connecting to device", { cause: error });
		}
	}

	public async disconnect(id: string) {
		const device = this._devices.get(id);
		const listeners = this._listeners.get(id);

		if (listeners) {
			this._listeners.delete(id);
		}

		if(!device) {
			console.warn(`Attempted to disconnect from an unknown device ${id}`);

			return;
		}

		try {
			await device.peripheral.disconnectAsync();

			console.log(`[PixelManager.disconnect.${id}]: Successfully disconnected device`);
		} catch (error) {
			console.error(`[PixelManager.disconnect.${id}]: Device failed to disconnect, swallowing error`, error);
		}

		this._devices.delete(id);
	}

	public async discoverDevices(callback: (id: string, name: string) => void) {
		try {
			await noble.waitForPoweredOnAsync(10000);
			await noble.startScanningAsync();

			noble.on("discover", async (peripheral: Peripheral) => {
				if (knownDevices.includes(peripheral.advertisement.localName)) {
					console.log("[discoverDevices]: Device Found", peripheral);

					callback(peripheral.id, peripheral.advertisement.localName);
				}
			});
		} catch(error) {
			console.log(error);
		}


	}

	public getDevice(id: string): PixelBluetoothConfig | undefined {
		return this._devices.get(id);
	}

	public async removeListener(deviceId: string, actionId: string) {
		const device = this._devices.get(deviceId);

		if (!device) {
			console.error('Device is not connected');

			return;
		}

		if (!this._listeners.has(deviceId)) {
			this._listeners.set(deviceId, []);
			return;
		}

		const listeners = this._listeners.get(deviceId) as Listener[];
		const index = listeners.findIndex(listener => listener.actionId === actionId);

		if (index === -1) {
			console.warn('Attempted to remove non-listening listener');

			return;
		}

		this._listeners.set(deviceId, [
			...listeners.slice(0, index),
			...listeners.slice(index + 1, listeners.length),
		]);

		this.resetListeners(device);
	}

	public async reset() {
		for (const deviceId of this._devices.keys()) {
			await this.disconnect(deviceId);
		}
	}

	public async stopDiscover() {
		try {
			if (noble.state === 'poweredOn') {
				await noble.stopScanningAsync();
				console.log(`[stopDisocover]: Discovery stopped succesfully`);
			} else {
				console.log(`[stopDisocover]: Discovery is not running, nothing to stop`);
			}
		} catch(error) {
			console.error('[stopDisocover]: Stopping discovery failed!', error);
		}
	}

	private resetListeners(device: PixelBluetoothConfig) {
		if (device.notify.listeners('data').length) {
			device.notify.removeAllListeners();
		}

		const listeners = this._listeners.get(device.id) ?? [] as Listener[];

		device.notify.on('data', async (data) => {
			const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
			const message = serializer.deserializeMessage(dataView);
			const messageType = serializer.getMessageType(message);

			await Promise.all(
				listeners.map(async ({ type, listener}) => {
					if (type === messageType && type === 'rollState') {
						await listener(message as RollEvent);
					} else if (type === messageType && type === 'batteryLevel') {
						await listener(message as BatteryEvent);
					}
				})
			);
		});
	}
}
