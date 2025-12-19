import streamDeck, { action, DidReceiveSettingsEvent, KeyDownEvent, WillAppearEvent } from "@elgato/streamdeck";
import { DCConfig, GlobalSettings, Pixel } from "../common/types";
import { registerDCListener } from "../common/utils";
import { PixelManager } from "../pixelHelpers/PixelManagerV2";
import { DisplayActionBase, DisplayActionBaseSettings } from "./DisplayActionBase";

type DCChangeSettings = DisplayActionBaseSettings & {
	type: "minus" | "plus";
};

@action({ UUID: "com.river.pixeldie.dcchange" })
export class DCChangeAction extends DisplayActionBase<DCChangeSettings> {
	constructor(pixelManager: PixelManager) {
		super(pixelManager);
	}

	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DCChangeSettings>): Promise<void> {
		await this.updateDifficultyDisplay(ev);
	}
	
	public override async onKeyDown(ev: KeyDownEvent<DCChangeSettings>): Promise<void> {
		const { settings } = ev.payload;

		if (settings.deviceId) {
			const amountChange = settings.type === "plus" ? 1 : -1;

			const { connectedDevices } = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
			const newDifficulty = (connectedDevices?.[settings.deviceId]?.dcConfig?.difficulty || 10) + amountChange;

			const newDevice: Pixel = {
				...(connectedDevices[settings.deviceId] as Pixel),
				dcConfig: {
					...(connectedDevices[settings.deviceId].dcConfig as DCConfig),
					difficulty: newDifficulty,
				},
			};

			await streamDeck.settings.setGlobalSettings<GlobalSettings>({
				connectedDevices: {
					...connectedDevices,
					[settings.deviceId]: newDevice,
				},
			});
			await streamDeck.settings.getGlobalSettings<GlobalSettings>();

			await registerDCListener(this._pixelManager, newDevice);
		}
	}

	public override async onWillAppear(ev: WillAppearEvent<DCChangeSettings>): Promise<void> {
		await this.updateDifficultyDisplay(ev);
	}

	private async updateDifficultyDisplay(ev: DidReceiveSettingsEvent<DCChangeSettings> | WillAppearEvent<DCChangeSettings>): Promise<void> {
		const { settings } = ev.payload;

		console.log()

		await ev.action.setTitle(settings.type === "plus" ? "+" : "-");
	}
}
