/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import noble, { Peripheral } from "@stoprocent/noble";
import { MessageType, serializer } from "@systemic-games/pixels-web-connect";

interface DeviceListener {
	actionId: string;
	listener: Function;
}

export interface Device {
	id: string;
	peripheral: Peripheral;
	actions: Set<string>;
	eventListeners: Map<MessageType, DeviceListener[]>;
}

export type ScanCallback = ({
	discoveredDevices,
	connectedDevices,
}: {
	discoveredDevices: Peripheral[];
	connectedDevices: Peripheral[];
}) => Promise<void>;

const knownDevices = ["D20", "D12", "D8", "D6", "D4"];

export class PixelManager {
	private connectedDevices: Map<string, Device> = new Map();
	private connectingDevices: Map<string, Promise<Device>> = new Map();
	private discoveredDevices: Map<string, Peripheral> = new Map();
	private scanningActions: Map<string, ScanCallback> = new Map();

	public addEventListener(id: string, actionId: string, type: MessageType, listener: Function): void {
		const connectedDevice = this.connectedDevices.get(id);

		if (!connectedDevice) {
			console.warn(`[PixelManager.addEventListener]: Device with id ${id} not found`);

			return;
		}

		const existingListeners = connectedDevice.eventListeners.get(type);

		if (existingListeners) {
			const existingListenerIndex = existingListeners.findIndex((existing) => existing.actionId === actionId);

			if (existingListenerIndex !== -1) {
				console.log(`[PixelManager.addEventListener]: Action has already registered an event listener for ${type}, replacing`);

				existingListeners[existingListenerIndex] = { actionId, listener };

				return;
			}
		} else {
			console.log(`[PixelManager.addEventListener]: Setting listeners array for ${type}`);
			connectedDevice.eventListeners.set(type, [{ actionId, listener }]);

			return;
		}

		console.log(`[PixelManager.addEventListener]: Adding ${actionId} listener for ${type}`);
		existingListeners.push({ actionId, listener });
	}

	/**
	 * This helper does several things, connects to a device, registers an action as a listener, and throws
	 * an error if the device cannot be connected to. If the device is already connected by another action
	 * instance, we will reuse the connection and "share" it with the subsequent actions.
	 *
	 * Cases:
	 * 1. Device is not in the connected devices map, that means it needs to connected BUT we will want to place a lock on this device
	 * to ensure no other actions attempt to connect while it is in progress of connecting. To do this, we will set a lockPromise that
	 * resolves with this newly connected device (this will be returned if another device attempts to connect)
	 * @param id - ID of the device to connect to
	 * @param actionId - ID of the action that is trying to connect
	 * @returns - Device
	 */
	public async connect(id: string, actionId: string): Promise<Device> {
		console.log(`[PixelManager.connect.${id}.${actionId}]: Starting Connect Process`);

		const connectingDevice = this.connectingDevices.get(id);
		const existingDevice = this.connectedDevices.get(id);

		if (existingDevice) {
			console.log(`[PixelManager.connect.${id}.${actionId}]: Adding listener and returning existing device`);
			existingDevice.actions.add(actionId);

			return existingDevice;
		}

		if (connectingDevice) {
			console.log(`[PixelManager.connect.${id}.${actionId}]: Device is connecting, waiting...`);

			const device = await connectingDevice;

			console.log(`[PixelManager.connect.${id}.${actionId}]: Adding listener and returning connected device`);
			device.actions.add(actionId);

			return device;
		}

		const eventListeners = new Map<MessageType, DeviceListener[]>();
		const connectionPromise = (async () => {
			try {
				await noble.waitForPoweredOnAsync(10000);
				const peripheral = await noble.connectAsync(id, { timeout: 10000 });

				console.log(`[PixelManager.connect.${id}.${actionId}]: Device Connected`);

				const { characteristics } = await peripheral.discoverAllServicesAndCharacteristicsAsync();

				const notify = characteristics.find(({ properties }) => properties?.includes?.("notify"));
				const write = characteristics.find(({ properties }) => properties?.includes?.("write"));

				console.log(`[PixelManager.connect.${id}.${actionId}]: Found Characteristics`);

				if (!notify || !write) {
					console.error(
						`[PixelManager.connect.${id}.${actionId}]: Required Characteristics not found!`,
						characteristics,
						peripheral,
					);

					throw new Error("Required characteristics not found on Pixel device");
				}

				notify.on("data", (data: Buffer) => {
					const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);

					const message = serializer.deserializeMessage(dataView);
					const messageType = serializer.getMessageType(message);

					console.log(`[device.${id}.messageRecieved]: ${message} (${messageType})`);

					if (eventListeners.has(messageType)) {
						const listeners = eventListeners.get(messageType) as DeviceListener[];

						listeners.forEach(({ listener }) => listener(message));
					}
				});

				await notify.subscribeAsync();

				console.log(`[PixelManager.connect.${id}.${actionId}]: Subscribed to notify event`);

				const newDevice: Device = {
					id,
					actions: new Set([actionId]),
					peripheral,
					eventListeners,
				};

				this.connectedDevices.set(id, newDevice);
				this.connectingDevices.delete(id);
				this.discoveredDevices.delete(id);

				console.log(`[PixelManager.connect.${id}.${actionId}]: Scanning Actions fanout`, this.scanningActions);
				// If there are any scanning actions, we need to send this new device to them
				if (this.scanningActions.size) {
					this.scanningActions.forEach((callback, key) => {
						console.log(`[PixelManager.connect.${id}.${key}]: Sending new device`);

						callback({
							discoveredDevices: [...this.discoveredDevices.values()],
							connectedDevices: [...this.connectedDevices.values()].map(({ peripheral }) => peripheral as Peripheral),
						});
					});
				}

				return newDevice;
			} catch (error) {
				console.error(`[device.${id}]: Something went wrong while connecting to device`, error);

				throw new Error('Something went wrong while connecting to device', { cause: error })
			}
		})();

		this.connectingDevices.set(id, connectionPromise);

		return connectionPromise;
	}

	public async disconnect(id: string, actionId: string): Promise<void> {
		const connectedDevice = this.connectedDevices.get(id);

		if (!connectedDevice) {
			console.warn(`[PixelManager.disconnect]: Attempted to disconnect from an unknown device`);

			return;
		}

		if (connectedDevice.peripheral.state === "disconnected") {
			this.connectedDevices.delete(id);
		}

		if (connectedDevice.peripheral.state !== "connected") {
			console.error(`[PixelManager.disconnect]: Device is not connected, how did we get here?`);

			return;
		}

		if (connectedDevice.actions.has(actionId)) {
			connectedDevice.actions.delete(actionId);

			connectedDevice.eventListeners.forEach((listeners, key) => {
				connectedDevice.eventListeners.set(
					key,
					listeners.filter((listener) => listener.actionId !== actionId),
				);
			});
		}

		if (connectedDevice.actions.size) {
			console.log(`[PixelManager.disconnect.${id}.${actionId}]: Other actions still connected, connection still open`);

			return;
		}

		try {
			await connectedDevice.peripheral.disconnectAsync();

			console.log(`[PixelManager.disconnect.${id}]: Successfully disconnected device`);
		} catch (error) {
			console.error(
				`[PixelManager.disconnect.${id}.${actionId}]: Device failed to disconnect, swallowing error`,
				error,
			);
		}

		this.connectedDevices.delete(id);
	}

	public getDevice(id: string): Device | undefined {
		return this.connectedDevices.get(id);
	}

	public async startDiscover(actionId: string, callback: ScanCallback) {
		// This action has already been added to the scan and is already listening
		if (this.scanningActions.has(actionId)) {
			console.warn(`[discoverDevices]: Action ${actionId} is already scanning`);

			return;
		}

		console.log(`[discoverDevices]: Action ${actionId} begin scanning`);
		this.scanningActions.set(actionId, callback);

		// Another action has already started the scan
		if (this.scanningActions.size === 1) {
			console.log(`[discoverDevices]: Initializing Scanner`);

			await noble.waitForPoweredOnAsync(10000);
			await noble.startScanningAsync();

			noble.on("discover", async (peripheral: Peripheral) => {
				if (knownDevices.includes(peripheral.advertisement.localName)) {
					// console.log("[discoverDevices]: Device Found", peripheral);

					this.discoveredDevices.set(peripheral.id, peripheral);
					this.scanningActions.forEach(async (actionCB, key) => {
						console.log(
						  `[discoverDevices]: Sending ${peripheral.id} to ${key}`
						);

						actionCB({
							connectedDevices: [...this.connectedDevices.values()].map(({ peripheral }) => peripheral as Peripheral),
							discoveredDevices: [...this.discoveredDevices.values()],
						});
					});
				}
			});
		}

		callback({
			connectedDevices: [...this.connectedDevices.values()].map(({ peripheral }) => peripheral as Peripheral),
			discoveredDevices: [...this.discoveredDevices.values()],
		});
	}

	public async stopDiscover(actionId: string) {
		this.scanningActions.delete(actionId);

		console.log(`[stopDisocover]: Removing ${actionId} from discovery`);

		if (!this.scanningActions.size) {
			console.log(`[stopDisocover]: Stopping disocvery, no actions are listening`);
			await noble.stopScanningAsync();
			this.discoveredDevices.clear();
		}
	}
}
