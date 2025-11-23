import streamDeck, {
	DidReceiveSettingsEvent,
	JsonObject,
	PropertyInspectorDidDisappearEvent,
	SendToPluginEvent,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";
import { SingletonAction } from "@elgato/streamdeck";
import { PixelManager } from "./PixelManager";

export interface DiscoverSettings extends JsonObject {
  /**
   *
   */
  deviceId?: string;
  /**
   *
   */
  previousDeviceId?: string;
}

interface PluginEvent extends JsonObject {
  /**
   *
   */
  event: "getDevices";
}

/**
 *
 */
export class PixelDiscover<T extends DiscoverSettings> extends SingletonAction<T> {
	/**
	 *
	 */
	pixelManager: PixelManager;

	/**
	 *
	 * @param pixelManager
	 */
	constructor(pixelManager: PixelManager) {
		super();

		this.pixelManager = pixelManager;
	}

	/**
	 *
	 * @param deviceId
	 * @param ev
	 */
	private async connectToDevice(
		deviceId: string,
		ev:
      DidReceiveSettingsEvent<DiscoverSettings> | WillAppearEvent<DiscoverSettings>
	) {
		try {
			console.log(
        `[PixelDiscover.connectToDevice]: Attempting to connect to ${deviceId}`
			);
			const device = await this.pixelManager.connect(deviceId, ev.action.id);

			console.log(
        `[PixelDiscover.connectToDevice.${ev.action.id}]: Connected to device`,
        device
			);
		} catch (error) {
			console.error(
        `[PixelDiscover.connectToDevice]: Failed to connect to device, clearing and alerting`,
        error
			);

			await ev.action.showAlert();
			await ev.action.setSettings({
				deviceId: undefined,
			});
		}
	}

	/**
	 *
	 * @param ev
	 */
	override async onSendToPlugin(
		ev: SendToPluginEvent<PluginEvent, JsonObject>
	): Promise<void> {
		console.log(`[onSendToPlugin.event]: `, ev);

		if (ev.payload.event === "getDevices") {
			// console.log(`[PixelDiscover.onSendToPlugin]: Starting discover`);
			await this.pixelManager.startDiscover(
				ev.action.id,
				async ({ connectedDevices, discoveredDevices }) => {
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
				}
			);
		}
	}

	/**
	 *
	 * @param ev
	 */
	override async onWillAppear(
		ev: WillAppearEvent<DiscoverSettings>
	): Promise<void> {
		if (ev.payload.settings.deviceId) {
			await this.connectToDevice(ev.payload.settings.deviceId, ev);
		}
	}

	/**
	 *
	 * @param ev
	 */
	override async onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<DiscoverSettings>
	): Promise<void> {
		console.log(`[PixelDiscover.onDidReceiveSettings.${ev.action.id}]: `, ev);

		const { settings } = ev.payload;

		if (
			settings.previousDeviceId &&
      settings.deviceId !== settings.previousDeviceId
		) {
			console.log(
        `[PixelDiscover.onDidReceiveSettings.${ev.action.id}]: Disconnecting previous device`
			);

			await this.pixelManager.disconnect(
				settings.previousDeviceId,
				ev.action.id
			);
		}

		if (settings.deviceId && settings.previousDeviceId !== settings.deviceId) {
			console.log("Connect to device");
			await this.connectToDevice(settings.deviceId, ev);
		}

		await ev.action.setSettings({
			deviceId: settings.deviceId,
			previousDeviceId: settings.deviceId,
		});
	}

	/**
	 *
	 * @param ev
	 */
	override async onWillDisappear(ev: WillDisappearEvent<DiscoverSettings>): Promise<void> {
		// console.log(await streamDeck.settings.)

		console.log("GONE");
	}

	/**
	 * When the property inspector disappears, we want to stop discovery
	 * @param ev
	 */
	override async onPropertyInspectorDidDisappear(
		ev: PropertyInspectorDidDisappearEvent
	): Promise<void> {
		console.log(
      `[PixelDiscover.onPropertyInspectorDidDisappear.${ev.action.id}]: `,
      ev
		);

		this.pixelManager.stopDiscover(ev.action.id);
	}
}
