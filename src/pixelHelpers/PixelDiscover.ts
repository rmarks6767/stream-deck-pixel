import streamDeck, { JsonObject, PropertyInspectorDidDisappearEvent, SendToPluginEvent, WillAppearEvent } from "@elgato/streamdeck";
import { SingletonAction } from "@elgato/streamdeck";
import { PixelManager } from "./PixelManager";

interface PluginEvent extends JsonObject {
	event: "getDevices";
}

export class PixelDiscover extends SingletonAction {
	protected pixelManager: PixelManager;
	private deleteTime: number = 0;

	constructor(pixelManager: PixelManager) {
		super();

		this.pixelManager = pixelManager;
	}

	// public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DiscoverSettings>): Promise<void> {
	// 	console.log(`[PixelDiscover.onDidReceiveSettings.${ev.action.id}]: `, ev);

	// 	const { settings } = ev.payload;

	// 	if (settings.previousDeviceId && settings.deviceId !== settings.previousDeviceId) {
	// 		console.log(`[PixelDiscover.onDidReceiveSettings.${ev.action.id}]: Disconnecting previous device`);

	// 		await this.pixelManager.disconnect(settings.previousDeviceId, ev.action.id);
	// 	}

	// 	if (settings.deviceId && settings.previousDeviceId !== settings.deviceId) {
	// 		console.log("Connect to device");
	// 		await this.connectToDevice(settings.deviceId, ev);
	// 	}

	// 	await ev.action.setSettings({
	// 		...settings,
	// 		deviceId: settings.deviceId,
	// 		previousDeviceId: settings.deviceId,
	// 	});
	// }

	public override async onWillAppear(ev: WillAppearEvent<JsonObject>): Promise<void> {
		console.log(streamDeck.actions.getActionById(ev.action.id));
	}

	public override async onPropertyInspectorDidDisappear(ev: PropertyInspectorDidDisappearEvent): Promise<void> {
		console.log(`[PixelDiscover.onPropertyInspectorDidDisappear.${ev.action.id}]: `, ev);
		this.pixelManager.stopDiscover(ev.action.id);
	}

	public override async onSendToPlugin(ev: SendToPluginEvent<PluginEvent, JsonObject>): Promise<void> {
		console.log(`[onSendToPlugin.event]: `, ev);

		if (ev.payload.event === "getDevices") {
			// console.log(`[PixelDiscover.onSendToPlugin]: Starting discover`);
			await this.pixelManager.startDiscover(ev.action.id, async ({ connectedDevices, discoveredDevices }) => {
				console.log(connectedDevices);

				await streamDeck.ui.current?.sendToPropertyInspector({
					event: "getDevices",
					items: [
						{
							label: "None",
							value: "",
						},
						...(connectedDevices.length
							? [
								...connectedDevices.map((device) => ({
									label: `[CONNECTED]: ${device.advertisement.localName} (${device.id})`,
									value: device.id,
								})),
							]
							: []),
						...discoveredDevices.map((device) => ({
							label: `${device.advertisement.localName} (${device.id})`,
							value: device.id,
						})),
					],
				});
			});
		}
	}
}
