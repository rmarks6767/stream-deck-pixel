import streamDeck, { DidReceiveSettingsEvent, KeyDownEvent } from "@elgato/streamdeck";
import { action, WillAppearEvent } from "@elgato/streamdeck";
import { DiscoverSettings, PixelDiscover } from "../pixelHelpers/PixelDiscover";
import { GlobalSettings } from "../common/types";

enum CounterType {
	plus = 0,
	minus = 1,
}

interface PixelDCCounterSettings extends DiscoverSettings {
	type?: CounterType;
}

@action({ UUID: "com.river.pixeldie.dccounter" })
export class PixelDCCounter extends PixelDiscover<PixelDCCounterSettings> {
	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PixelDCCounterSettings>): Promise<void> {
		console.log(`[PixelDCCounter.onDidReceiveSettings]: `, ev);
		
		await super.onDidReceiveSettings(ev);

		const { type = CounterType.plus } = ev.payload.settings;

		await ev.action.setTitle(type === CounterType.plus ? '+' : '-');
	}

	public override async onKeyDown(ev: KeyDownEvent<PixelDCCounterSettings>): Promise<void> {
		console.log(`[PixelDCCounter.onKeyDown]: `, ev);

		if (!ev.payload.settings.deviceId) {
			return;
		}

		const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>()

		const difficulty = globalSettings[ev.payload.settings.deviceId];
		const { type = CounterType.plus } = ev.payload.settings;

		const newDifficulty = type === CounterType.plus ? difficulty + 1 : difficulty - 1;

		await streamDeck.settings.setGlobalSettings({
			...globalSettings,
			[ev.payload.settings.deviceId]: newDifficulty,
		});
	}

	public override async onWillAppear(ev: WillAppearEvent<PixelDCCounterSettings>): Promise<void> {
		console.log(`[PixelDCCounter.onWillAppear]: `, ev);

		await super.onWillAppear(ev);

		const { type = CounterType.plus, difficulty = 10 } = ev.payload.settings;

		await ev.action.setTitle(type === CounterType.plus ? '+' : '-');
		await ev.action.setSettings({
			type, 
			difficulty,
			...ev.payload.settings,
		})
	}
}
