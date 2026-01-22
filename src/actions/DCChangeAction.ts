import { action, DidReceiveSettingsEvent, KeyDownEvent, WillAppearEvent } from "@elgato/streamdeck";
import { Pixel } from "../common/types";
import { registerDCListener } from "../common/utils";
import { PixelManager } from "../pixelHelpers/PixelManager";
import { DisplayActionBase, DisplayActionBaseSettings } from "./DisplayActionBase";
import { GlobalSettingsController } from "../common/globalSettingsController";

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
		const { connectedDevices } = await GlobalSettingsController.get();
		const device = connectedDevices[settings.deviceId];

		if (device) {
			const amountChange = settings.type === "plus" ? 1 : -1;
			const newDifficulty = device.dcConfig.difficulty + amountChange;

			const newDevice: Pixel = {
				...device,
				dcConfig: {
					...device.dcConfig,
					difficulty: newDifficulty,
				},
			};

			await GlobalSettingsController.set({
				connectedDevices: {
					...connectedDevices,
					[settings.deviceId]: newDevice,
				},
			});

			await registerDCListener(this._pixelManager, newDevice);
		}
	}

	public override async onWillAppear(ev: WillAppearEvent<DCChangeSettings>): Promise<void> {
		await this.updateDifficultyDisplay(ev);
	}

	private async updateDifficultyDisplay(ev: DidReceiveSettingsEvent<DCChangeSettings> | WillAppearEvent<DCChangeSettings>): Promise<void> {
		const { settings } = ev.payload;

		await ev.action.setTitle(settings.type === "plus" ? "+" : "-");
	}
}
