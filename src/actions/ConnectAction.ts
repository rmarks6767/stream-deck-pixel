import streamDeck, {
	action,
	DidReceiveGlobalSettingsEvent,
	DidReceiveSettingsEvent,
	PropertyInspectorDidAppearEvent,
	PropertyInspectorDidDisappearEvent,
	SendToPluginEvent,
	SingletonAction,
	WillAppearEvent,
} from "@elgato/streamdeck";
import { JsonObject } from "@elgato/utils";

import { GlobalSettings, Pixel, PixelConnectionState } from "../common/types";
import { PixelManager } from "../pixelHelpers/PixelManagerV2";

export interface ConnectActionSettings extends JsonObject {
	discoveredDevices: Pixel[];
}

interface PluginEvent extends JsonObject {
	event: "connectDevice" | "deleteDevice" | "reconnectDevice";
	deviceId: string;
}

export interface IDisposable {
	[Symbol.dispose](): void;
	dispose(): void;
}

@action({ UUID: "com.river.pixeldie.connectionmanager" })
export class ConnectAction extends SingletonAction<ConnectActionSettings> {
	protected _globalListener?: IDisposable;
	protected _pixelManager: PixelManager;

	constructor(pixelManager: PixelManager) {
		super();

		this._pixelManager = pixelManager;
	}

	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ConnectActionSettings>): Promise<void> {
		console.log(`[ConnectAction.onDidReceiveSettings]: `, ev);
		await streamDeck.ui.sendToPropertyInspector({
			event: "getDiscoveredDevices",
			discoveredDevices: ev.payload.settings.discoveredDevices,
		});
	}

	public override async onPropertyInspectorDidAppear(
		ev: PropertyInspectorDidAppearEvent<ConnectActionSettings>,
	): Promise<void> {
		console.log(`[ConnectAction.onSendToPlugin]: Starting discover`, ev);

		const { connectedDevices } = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		const { discoveredDevices } = await ev.action.getSettings();

		this._globalListener = streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>(
			async (event: DidReceiveGlobalSettingsEvent<GlobalSettings>) => {
				const { connectedDevices } = event.settings;

				await streamDeck.ui.sendToPropertyInspector({
					event: "getKnownDevices",
					knownDevices: Object.values(connectedDevices),
				});
			},
		);

		await this._pixelManager.discoverDevices(async (id, name) => {
			const localSettings = await ev.action.getSettings();
			const { connectedDevices } = await streamDeck.settings.getGlobalSettings<GlobalSettings>();


			if (localSettings.discoveredDevices.find((device: Pixel) => device.id === id) || connectedDevices[id]) {
				console.log("[ConnectAction.discoverDevices]: Device has already been sent to the UI or is connected");

				return;
			}

			const newDiscoveredDevices = [
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
		ev: PropertyInspectorDidDisappearEvent<ConnectActionSettings>,
	): Promise<void> {
		console.log(`[ConnectAction.onPropertyInspectorDidDisappear]: Stopping discover`, ev);
		const settings = await ev.action.getSettings();

		await ev.action.setSettings({
			...settings,
			discoveredDevices: [],
		});
		await this._pixelManager.stopDiscover();

		if (this._globalListener) {
			await Promise.resolve(this._globalListener.dispose());
		}
	}

	public override async onSendToPlugin(ev: SendToPluginEvent<PluginEvent, ConnectActionSettings>): Promise<void> {
		console.log(`[ConnectAction.onSendToPlugin]: `, ev);

		switch (ev.payload.event) {
			case "connectDevice":
				await this.connectToDevice(ev);
				break;
			case "deleteDevice":
				await this.deleteDevice(ev);
				break;
			case "reconnectDevice":
				await this.reconnectToDevice(ev);
				break;
		}
	}

	public override async onWillAppear(ev: WillAppearEvent<ConnectActionSettings>): Promise<void> {
		console.log(`[ConnectAction.onWillAppear]: `, ev);
		
		if (!ev.payload.settings.type) {
			await ev.action.setSettings<ConnectActionSettings>({
				discoveredDevices: [],
			});
		}
	}

	private async connectToDevice(ev: SendToPluginEvent<PluginEvent, ConnectActionSettings>) {
		console.log(`[ConnectAction.connectToDevice]: `, ev);
		
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
		})
		await ev.action.getSettings();

		// Add the device to global settings and set it to connecting
		const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		const newConnectedDevices = {
			...globalSettings.connectedDevices,
			[deviceId]: {
				...device,
				connectionState: PixelConnectionState.CONNECTING,
			},
		};
		await streamDeck.settings.setGlobalSettings<GlobalSettings>({
			...globalSettings,
			connectedDevices: newConnectedDevices,
		});
		await streamDeck.settings.getGlobalSettings<GlobalSettings>();

		// Attempt to connect to this pixel
		try {
			await this._pixelManager.connect(ev.payload.deviceId);
			await streamDeck.settings.setGlobalSettings<GlobalSettings>({
				...globalSettings,
				connectedDevices: {
					...newConnectedDevices,
					[deviceId]: {
						...device,
						connectionState: PixelConnectionState.CONNECTED,
					},
				},
			});
			await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		} catch (error) {
			// If we error, we will set it to disconnect
			console.log("Something went wrong when connecting to the pixel", error);

			await streamDeck.settings.setGlobalSettings<GlobalSettings>({
				...globalSettings,
				connectedDevices: {
					...newConnectedDevices,
					[deviceId]: {
						...device,
						connectionState: PixelConnectionState.DISCONNECTED,
					},
				},
			});
			await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		}
	}

	private async deleteDevice(ev: SendToPluginEvent<PluginEvent, ConnectActionSettings>) {
		console.log(`[ConnectAction.deleteDevice]: `, ev);
		
		const { deviceId } = ev.payload;

		const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();

		await this._pixelManager.disconnect(deviceId);

		const newConnectedDevices: GlobalSettings['connectedDevices'] = {};
		Object.entries(globalSettings.connectedDevices).forEach(([key, value]) => {
			if(key !== deviceId) {
				newConnectedDevices[key] = value;
			}
		});

		await streamDeck.settings.setGlobalSettings<GlobalSettings>({
			...globalSettings,
			connectedDevices: newConnectedDevices,
		});
		await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	}

	private async reconnectToDevice(ev: SendToPluginEvent<PluginEvent, ConnectActionSettings>) {
		console.log(`[ConnectAction.reconnectToDevice]: `, ev);

		const { deviceId } = ev.payload;

		// Add the device to global settings and set it to connecting
		const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		const device = globalSettings.connectedDevices[deviceId];

		if (!device) {
			await streamDeck.ui.sendToPropertyInspector({
				event: "functionFailed",
				deviceId,
			});

			return;
		}

		await streamDeck.settings.setGlobalSettings<GlobalSettings>({
			...globalSettings,
			connectedDevices: {
				...globalSettings.connectedDevices,
				[deviceId]: {
					...globalSettings.connectedDevices[deviceId],
					connectionState: PixelConnectionState.CONNECTING,
				},
			},
		});
		await streamDeck.settings.getGlobalSettings<GlobalSettings>();

		try {
			await this._pixelManager.disconnect(ev.payload.deviceId);
			await this._pixelManager.connect(ev.payload.deviceId);
			await streamDeck.settings.setGlobalSettings<GlobalSettings>({
				...globalSettings,
				connectedDevices: {
					...globalSettings.connectedDevices,
					[deviceId]: {
						...globalSettings.connectedDevices[deviceId],
						connectionState: PixelConnectionState.CONNECTED,
					},
				},
			});
			await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		} catch (error) {
			// If we error, we will set it to disconnect
			console.log("Something went wrong when connecting to the pixel", error);

			await streamDeck.settings.setGlobalSettings<GlobalSettings>({
				...globalSettings,
				connectedDevices: {
					...globalSettings.connectedDevices,
					[deviceId]: {
						...globalSettings.connectedDevices[deviceId],
						connectionState: PixelConnectionState.DISCONNECTED,
					},
				},
			});
			await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		}
	}
}
