import streamDeck, { SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";
import { JsonObject } from "@elgato/utils";
import { PixelManager } from "../pixelHelpers/PixelManager";
import { GlobalSettingsController } from "../common/globalSettingsController";

interface PluginEvent extends JsonObject {
	event: "getDevices";
}

export interface DisplayActionBaseSettings extends JsonObject {
	deviceId: string;
}

export class DisplayActionBase<T extends JsonObject = JsonObject> extends SingletonAction<DisplayActionBaseSettings & T> {
	protected _pixelManager: PixelManager;

	constructor(pixelManager: PixelManager) {
		super();

		this._pixelManager = pixelManager;
	}

	public override async onSendToPlugin(ev: SendToPluginEvent<PluginEvent, DisplayActionBaseSettings>): Promise<void> {
		if (ev.payload.event === "getDevices") {
			const { connectedDevices } = await GlobalSettingsController.get();

			const items = Object.values(connectedDevices).map((device) => ({
				label: `${device.name} (${device.id})`,
				value: device.id,
			}));

			await streamDeck.ui.sendToPropertyInspector({
				event: "getDevices",
				items: [
					{
						label: "None",
						value: "",
					},
					...items,
				],
			});
		}
	}
}
