import noble, { Characteristic, Peripheral } from "@stoprocent/noble";

export interface PixelBluetoothConfig {
	id: string;
	peripheral: Peripheral;
	notify: Characteristic;
	write: Characteristic;
}

export class PixelManager {
	private _devices: Map<string, PixelBluetoothConfig> = new Map();

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

			console.log(`[PixelManager.connect.${id}]: Subscribed to notify event`);

			this._devices.set(id,  {
				id,
				peripheral,
				notify,
				write,
			});
		} catch (error) {
			console.error(`[device.${id}]: Something went wrong while connecting to device`, error);

			throw new Error("Something went wrong while connecting to device", { cause: error });
		}
	}

	public async disconnect(id: string) {
		const device = this._devices.get(id);

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

	public getDevice(id: string): PixelBluetoothConfig | undefined {
		return this._devices.get(id);
	}
}
