import streamDeck, { action, DidReceiveSettingsEvent, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import z from "zod";

import { dcActionManifestId } from "./DCAction";
import { EventBus } from "../common/eventBus";
import { EventType } from "../common/eventBus.types";

const Settings = z.object({
	state: z.string().default("enabled"),
	subscribedActions: z.array(z.string()).default([]),
});

type DCToggleSettings = z.infer<typeof Settings>;

@action({ UUID: "com.river.pixeldie.dctoggle" })
export class DCToggleAction extends SingletonAction<DCToggleSettings> {
	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DCToggleSettings>): Promise<void> {
		console.info(`[DCToggleAction.onDidReceiveSettings]: Event Received`, { event: ev });

		await this.updateDisplay(ev);
	}
	
	public override async onKeyDown(ev: KeyDownEvent<DCToggleSettings>): Promise<void> {
		const { coordinates } = ev.action;
		const settings = Settings.parse(ev.payload.settings);

		if (!coordinates) {
			console.error('[DCToggleAction.onKeyDown]: This action is part of a multi-action and should not be');

			return;
		}

		const myRow = coordinates.row;
		const myColumn = coordinates.column;
		const possibleCoords = [
			`${myColumn + 1}:${myRow}`, // Up
			`${myColumn - 1}:${myRow}`, // Down
			`${myColumn}:${myRow - 1}`, // Left
			`${myColumn}:${myRow + 1}`, // Right
		];

		const targetedActions = streamDeck.actions.filter((action) => {
			if (action.manifestId !== dcActionManifestId || !action.coordinates) {
				return false;
			}

			const column = action.coordinates.column;
			const row = action.coordinates.row;
			
			return possibleCoords.includes(`${column}:${row}`);
		});


		await Promise.all(targetedActions.map(async action => {
			const isDisabled = settings.state === "enabled";
			
			EventBus.emitTo<EventType.Settings>(EventType.Settings, action.id, {
				isDisabled
			});
		}));

		await ev.action.setSettings<DCToggleSettings>({
			state: settings.state === "enabled" ? "disabled" : "enabled",
			subscribedActions: [...targetedActions.map(action => action.id)]
		});
		await ev.action.getSettings();
	}

	public override async onWillAppear(ev: WillAppearEvent<DCToggleSettings>): Promise<void> {
		console.info(`[DCToggleAction.onWillAppear]: Event Received`, { event: ev });

		await this.updateDisplay(ev);
	}

	public override onWillDisappear(ev: WillDisappearEvent<DCToggleSettings>): void {
		console.info(`[DCToggleAction.onWillDisappear]: Event Received`, { event: ev });
	
		const settings = Settings.parse(ev.payload.settings);

		if (settings.subscribedActions.length) {
			settings.subscribedActions.forEach(actionId => {
				EventBus.emitTo<EventType.Settings>(EventType.Settings, actionId, {
					isDisabled: false
				});
			});
		}
	}

	private async updateDisplay(ev: DidReceiveSettingsEvent<DCToggleSettings> | WillAppearEvent<DCToggleSettings>): Promise<void> {
		console.info(`[DCToggleAction.updateDisplay]: Event Received`, { event: ev });
		
		const { state } = Settings.parse(ev.payload.settings);

		await ev.action.setImage(state === "enabled" ? "imgs/toggle_enabled" : "imgs/toggle_disabled");
	}
}
