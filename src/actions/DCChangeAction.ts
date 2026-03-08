import streamDeck, { action, DidReceiveSettingsEvent, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { dcActionManifestId } from "./DCAction";
import { EventBus } from "../common/eventBus";
import { EventType } from "../common/eventBus.types";

type DCChangeSettings = {
	type?: "minus" | "plus";
};

@action({ UUID: "com.river.pixeldie.dcchange" })
export class DCChangeAction extends SingletonAction<DCChangeSettings> {
	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DCChangeSettings>): Promise<void> {
		console.info(`[DCChangeAction.onDidReceiveSettings]: Event Received`, { event: ev });

		await this.updateDisplay(ev);
	}
	
	public override async onKeyDown(ev: KeyDownEvent<DCChangeSettings>): Promise<void> {
		const { coordinates } = ev.action;
		const { settings } = ev.payload;

		if (!coordinates) {
			console.error('[DCChangeAction.onKeyDown]: This action is part of a multi-action and should not be');

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
			const diff = settings.type === "plus" ? 1 : -1;
			
			EventBus.emitTo<EventType.Settings>(EventType.Settings, action.id, {
				difficulty: diff
			});
		}))
	}

	public override async onWillAppear(ev: WillAppearEvent<DCChangeSettings>): Promise<void> {
		console.info(`[DCChangeAction.onWillAppear]: Event Received`, { event: ev });

		await this.updateDisplay(ev);
	}

	private async updateDisplay(ev: DidReceiveSettingsEvent<DCChangeSettings> | WillAppearEvent<DCChangeSettings>): Promise<void> {
		streamDeck.logger.debug(`[DCChangeAction.updateDifficultyDisplay]: Event Received`, { event: ev });

		const { settings } = ev.payload;

		if (!settings.type) {
			return;
		}

		await ev.action.setImage(settings.type === "plus" ? "imgs/plus" : "imgs/minus");
	}
}
