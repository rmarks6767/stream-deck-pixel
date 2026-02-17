import { action, DidReceiveSettingsEvent, KeyDownEvent, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { Pixel } from "../common/types";
import { registerDCListener } from "../common/utils";
import { PixelManager } from "../common/pixelManager";
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
		console.info(`[DCChangeAction.onDidReceiveSettings]: Event Received`, { event: ev });

		await this.updateDifficultyDisplay(ev);
	}
	
	public override async onKeyDown(ev: KeyDownEvent<DCChangeSettings>): Promise<void> {
		console.info(`[DCChangeAction.onKeyDown]: Event Received`, { event: ev });

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
		console.info(`[DCChangeAction.onWillAppear]: Event Received`, { event: ev });

		await this.updateDifficultyDisplay(ev);
	}

	public override async onWillDisappear(ev: WillDisappearEvent<DisplayActionBaseSettings>): Promise<void> {
		console.info(`[DCChangeAction.onWillDisappear]: Event Received`, { event: ev });

		await this._pixelManager.removeListener(ev.payload.settings.deviceId, ev.action.id);
	}

	private async updateDifficultyDisplay(ev: DidReceiveSettingsEvent<DCChangeSettings> | WillAppearEvent<DCChangeSettings>): Promise<void> {
		console.info(`[DCChangeAction.updateDifficultyDisplay]: Event Received`, { event: ev });
		
		const { settings } = ev.payload;

		await ev.action.setImage(settings.type === "plus" ? "imgs/actions/plus" : "imgs/actions/minus");
	}
}
