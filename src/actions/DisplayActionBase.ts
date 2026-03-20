import streamDeck, {
	DidReceiveSettingsEvent,
	KeyDownEvent,
	SendToPluginEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";
import { JsonObject } from "@elgato/utils";
import z from "zod";

import { EventBus } from "../common/eventBus";
import { EventType } from "../common/eventBus.types";
import { GlobalSettingsController } from "../common/globalSettingsController";
import { PixelManager } from "../common/pixelManager";
import { GlobalSettings, PixelConnectionState } from "../common/types";
import { wait } from "../common/utils";

const Settings = z.object({
	deviceId: z.string().default(""),
	defaultTitle: z.string().nullish(),
});

interface PluginEvent extends JsonObject {
	event: "getDevices";
}

export type DisplayActionBaseSettings = z.infer<typeof Settings>;

export class DisplayActionBase<T extends JsonObject = JsonObject> extends SingletonAction<
	DisplayActionBaseSettings & T
> {
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

	public override onWillDisappear(ev: WillDisappearEvent<DisplayActionBaseSettings>) {
		this.removeListeners(ev.action.id);
		GlobalSettingsController.removeListener(ev.action.id);
	}

	protected async addListeners(
		ev:
			| DidReceiveSettingsEvent<DisplayActionBaseSettings>
			| KeyDownEvent<DisplayActionBaseSettings>
			| WillAppearEvent<DisplayActionBaseSettings>,
		isDeviceIdChanging: boolean = false,
	) {
		const settings = Settings.parse(ev.payload.settings);

		if (!settings.deviceId) {
			await ev.action.setTitle("No\nDevice\nSet");
			this.removeListeners(ev.action.id);

			return;
		}

		try {
			GlobalSettingsController.addListener(ev.action.id, this.globalSettingsListener(ev));
			
			if (ev.type === 'willAppear' || (ev.type === 'didReceiveSettings' && isDeviceIdChanging))
				await this.globalSettingsListener(ev)(await GlobalSettingsController.get());
		} catch(error) {
			console.error(error);
		}
	}

	protected removeListeners(id: string) {
		EventBus.unsubscribe(EventType.PixelConnect, id);
		EventBus.unsubscribe(EventType.PixelDisconnect, id);
		EventBus.unsubscribe(EventType.PixelRemove, id);
	}

	private globalSettingsListener(
		ev:
			| DidReceiveSettingsEvent<DisplayActionBaseSettings>
			| KeyDownEvent<DisplayActionBaseSettings>
			| WillAppearEvent<DisplayActionBaseSettings>,
	): (settings: GlobalSettings) => Promise<void> {
		let lastState: PixelConnectionState | undefined = undefined;
		let currentlyProcessing = false;
		const settings = Settings.parse(ev.payload.settings);

		return async ({ connectedDevices }: GlobalSettings) => {
			await new Promise((resolve) => {
				const interval = setInterval(() => {
					if (!currentlyProcessing)  {
						resolve(true);
						clearInterval(interval);
					}
				}, 100)
			});

			currentlyProcessing = true;

			const device = connectedDevices[settings.deviceId];

			if (device && lastState === device.connectionState) {
				return;
			}

			switch (device?.connectionState) {
				case PixelConnectionState.CONNECTED:
					await ev.action.setTitle("Device\nConnected");
					await wait(2_000);
					await ev.action.setTitle(settings.defaultTitle || device.name);
					break;
				case PixelConnectionState.CONNECTING:
					await ev.action.setTitle("Device\nConnecting");
					break;
				default:
					await ev.action.setTitle("Device\nDis-\nConnected");
					break;
			}

			lastState = device?.connectionState || PixelConnectionState.DISCONNECTED;
			currentlyProcessing = false;
		}
	}
}
