import streamDeck, {
	action,
	DidReceiveSettingsEvent,
	PropertyInspectorDidAppearEvent,
	PropertyInspectorDidDisappearEvent,
	SendToPluginEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";
import { JsonObject } from "@elgato/utils";

import { GlobalSettingsController } from "../common/globalSettingsController";
import { PixelManager } from "../common/pixelManager";
import { GlobalSettings, Pixel, PixelConnectionState } from "../common/types";
import { setConnectionStatus, wait } from "../common/utils";

const defaultSettings: ConnectionManagerActionSettings = {
	discoveredDevices: [],
};

export interface ConnectionManagerActionSettings extends JsonObject {
	discoveredDevices: Pixel[];
}

interface PluginEvent extends JsonObject {
	event: "clearAllDevices" | "connectDevice" | "deleteDevice" | "reconnectDevice";
	deviceId: string;
}

@action({ UUID: "com.river.pixeldie.connectionmanager" })
export class ConnectionManagerAction extends SingletonAction<ConnectionManagerActionSettings> {
	protected _pixelManager: PixelManager;

	constructor(pixelManager: PixelManager) {
		super();

		this._pixelManager = pixelManager;
	}

	public override async onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<ConnectionManagerActionSettings>,
	): Promise<void> {
		await streamDeck.ui.sendToPropertyInspector({
			event: "getDiscoveredDevices",
			discoveredDevices: ev.payload.settings.discoveredDevices,
		});
	}

	public override async onPropertyInspectorDidAppear(
		ev: PropertyInspectorDidAppearEvent<ConnectionManagerActionSettings>,
	): Promise<void> {
		const { connectedDevices } = await GlobalSettingsController.get();
		const { discoveredDevices } = await ev.action.getSettings();

		GlobalSettingsController.addListener(`${ev.action.id}:propertyInspector`, async ({ connectedDevices }) => {
			await streamDeck.ui.sendToPropertyInspector({
				event: "getKnownDevices",
				knownDevices: Object.values(connectedDevices),
			});
		});

		await this._pixelManager.discoverDevices(async (id, name) => {
			const localSettings = await ev.action.getSettings();
			const { connectedDevices } = await GlobalSettingsController.get();

			if (localSettings.discoveredDevices.find((device: Pixel) => device.id === id) || connectedDevices[id]) {
				return;
			}

			const newDiscoveredDevices: Pixel[] = [
				...localSettings.discoveredDevices,
				{
					id,
					name,
					connectionState: PixelConnectionState.DISCONNECTED,
				},
			];

			await ev.action.setSettings({
				...localSettings,
				discoveredDevices: newDiscoveredDevices,
			});
			await ev.action.getSettings();
		});

		await streamDeck.ui.sendToPropertyInspector({
			event: "getKnownDevices",
			knownDevices: Object.values(connectedDevices),
		});
		await streamDeck.ui.sendToPropertyInspector({
			event: "getDiscoveredDevices",
			discoveredDevices,
		});
	}

	public override async onPropertyInspectorDidDisappear(
		ev: PropertyInspectorDidDisappearEvent<ConnectionManagerActionSettings>,
	): Promise<void> {
		await ev.action.setSettings(defaultSettings);
		await this._pixelManager.stopDiscover();
		GlobalSettingsController.removeListener(`${ev.action.id}:propertyInspector`);
	}

	public override async onSendToPlugin(
		ev: SendToPluginEvent<PluginEvent, ConnectionManagerActionSettings>,
	): Promise<void> {
		switch (ev.payload.event) {
			case "connectDevice":
				await this.connectToDevice(ev);
				break;
			case "deleteDevice":
				await this.deleteDevice(ev.payload.deviceId);
				break;
			case "reconnectDevice":
				await this.reconnectToDevice(ev.payload.deviceId);
				break;
			case "clearAllDevices":
				await this.clearAllDevices(ev);
				break;
		}
	}

	public override async onWillAppear(ev: WillAppearEvent<ConnectionManagerActionSettings>): Promise<void> {
		if (!ev.payload.settings.type) {
			await ev.action.setSettings<ConnectionManagerActionSettings>(defaultSettings);
		} 

		GlobalSettingsController.addListener(`${ev.action.id}:willAppear`, this.globalSettingsListener(ev));
		await this.globalSettingsListener(ev)(await GlobalSettingsController.get());
	}

	public override onWillDisappear(ev: WillDisappearEvent<ConnectionManagerActionSettings>): void {
		GlobalSettingsController.removeListener(`${ev.action.id}:willAppear`);
	}

	private async clearAllDevices(ev: SendToPluginEvent<PluginEvent, ConnectionManagerActionSettings>) {
		await GlobalSettingsController.resetGlobalSettings();
		await this._pixelManager.reset();
		await ev.action.setSettings(defaultSettings);
	}

	private async connect(device: Pixel, retry = 0) {
		await setConnectionStatus(device, PixelConnectionState.CONNECTING);

		try {
			await this._pixelManager.connect(device.id);
			await setConnectionStatus(device, PixelConnectionState.CONNECTED);
		} catch (error) {
			if (retry < 3) {
				await wait(retry * 1000);
				await this.connect(device, retry + 1);
				return;
			}

			streamDeck.logger.error({
				message: `Failed to reconnect to device: ${device.id}`,
				error,
			});

			await setConnectionStatus(device, PixelConnectionState.DISCONNECTED);
		}
	}

	private async connectToDevice(ev: SendToPluginEvent<PluginEvent, ConnectionManagerActionSettings>) {
		const { deviceId } = ev.payload;

		const localSettings = await ev.action.getSettings();
		const device = localSettings.discoveredDevices.find(({ id }) => id === deviceId);

		// If we requested a device that didn't exist in the array (shouldn't happen) we error out
		if (!device) {
			await streamDeck.ui.sendToPropertyInspector({
				event: "functionFailed",
				deviceId,
			});

			return;
		}

		// Clear the device from the discovered devices
		await ev.action.setSettings({
			...localSettings,
			discoveredDevices: localSettings.discoveredDevices.filter(({ id }) => id !== deviceId),
		});
		await ev.action.getSettings();
		await this.connect(device);
	}

	private async deleteDevice(deviceId: string) {
		const globalSettings = await GlobalSettingsController.get();

		await this._pixelManager.disconnect(deviceId);

		const newConnectedDevices: GlobalSettings["connectedDevices"] = {};
		Object.entries(globalSettings.connectedDevices).forEach(([key, value]) => {
			if (key !== deviceId) {
				newConnectedDevices[key] = value;
			}
		});

		await GlobalSettingsController.set({
			...globalSettings,
			connectedDevices: newConnectedDevices,
		});
	}

	private globalSettingsListener(
		ev: WillAppearEvent<ConnectionManagerActionSettings>,
	): (settings: GlobalSettings) => Promise<void> {
		let lastNumDevices: number = -1;
	
		return async ({ connectedDevices }) => {
			console.log('Received settings', { connectedDevices });

			const numDevices = Object.keys(connectedDevices).length;

			if (numDevices !== lastNumDevices) {
				await ev.action.setTitle(`${numDevices} Device${numDevices !== 1 ? 's' : ''}\nConnected`);

				lastNumDevices = numDevices;
			}

			await streamDeck.ui.sendToPropertyInspector({
				event: "getKnownDevices",
				knownDevices: Object.values(connectedDevices),
			});
		}
	}

	private async reconnectToDevice(deviceId: string) {
		// Add the device to global settings and set it to connecting
		const globalSettings = await GlobalSettingsController.get();
		const device = globalSettings.connectedDevices[deviceId];

		if (!device) {
			await streamDeck.ui.sendToPropertyInspector({
				event: "functionFailed",
				deviceId,
			});

			return;
		}

		await this._pixelManager.disconnect(deviceId);
		await this.connect(device);
	}
}
