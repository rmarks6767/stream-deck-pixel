import { action, DidReceiveSettingsEvent, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";

import { EventBus } from "../common/eventBus";
import { EventType } from "../common/eventBus.types";
import { PixelManager } from "../common/pixelManager";
import { DisplayActionBase, DisplayActionBaseSettings } from "./DisplayActionBase";

@action({ UUID: "com.river.pixeldie.battery" })
export class BatteryAction extends DisplayActionBase {
	constructor(pixelManager: PixelManager) {
		super(pixelManager);
	}

	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DisplayActionBaseSettings>): Promise<void> {
		await this.addListeners(ev);
	}

	public override async onWillAppear(ev: WillAppearEvent<DisplayActionBaseSettings>): Promise<void> {
		await this.addListeners(ev);
	}

	public override async onWillDisappear(ev: WillDisappearEvent<DisplayActionBaseSettings>): Promise<void> {
		super.onWillDisappear(ev);
		this.removeListeners(ev.action.id);
	}

	protected override async addListeners(ev: DidReceiveSettingsEvent<DisplayActionBaseSettings> | WillAppearEvent<DisplayActionBaseSettings>) {
		await super.addListeners(ev, ev.type === 'didReceiveSettings');

		EventBus.subscribe({
			id: ev.action.id,
			type: EventType.PixelBattery,
			subscribeTo: ev.payload.settings.deviceId,
			listener: async ({ event: { levelPercent } }) => {
				await ev.action.setTitle(`${levelPercent}%`);
				await this.setImage(ev, levelPercent);
			},
		});
	}

	protected override async removeListeners(id: string) {
		EventBus.unsubscribe(EventType.PixelBattery, id);
	}

	private async setImage(
		ev: DidReceiveSettingsEvent<DisplayActionBaseSettings> | WillAppearEvent<DisplayActionBaseSettings>,
		percentage: number,
	) {
		console.info(`[DCAction.setImage]: Event Received`, { event: ev });
	
		if (percentage > 75) {
			await ev.action.setImage("imgs/actions/battery_100");
		} else if (percentage <= 75 && percentage > 50) {
			await ev.action.setImage("imgs/actions/battery_75");
		} else if (percentage <= 50 && percentage > 25) {
			await ev.action.setImage("imgs/actions/battery_50");
		} else if (percentage <= 25 && percentage > 10) {
			await ev.action.setImage("imgs/actions/battery_25");
		} else {
			await ev.action.setImage("imgs/actions/battery_10");
		}
	}
}
