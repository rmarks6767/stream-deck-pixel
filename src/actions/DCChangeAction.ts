import streamDeck, { action, DidReceiveSettingsEvent, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { DisplayActionBaseSettings } from "./DisplayActionBase";
import { dcActionManifestId } from "./DCAction";
import { EventBus } from "../common/eventBus";
import { EventType } from "../common/eventBus.types";

type DCChangeSettings = DisplayActionBaseSettings & {
	type: "minus" | "plus";
	targetedActionIds?: string[];
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
			console.log(action);
			
			if (ev.payload.settings.targetedActionIds?.includes(action.id)) {
				return true;
			}

			if (action.manifestId !== dcActionManifestId || !action.coordinates) {
				return false;
			}

			const possibleCoord = `${action.coordinates.column}:${action.coordinates.row}`
			
			console.log(possibleCoord);
			if (possibleCoords.includes(possibleCoord)) {
				return true;
			}

			return false;
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
		console.info(`[DCChangeAction.updateDifficultyDisplay]: Event Received`, { event: ev });
		
		const { settings } = ev.payload;

		await ev.action.setImage(settings.type === "plus" ? "imgs/actions/plus" : "imgs/actions/minus");
	}
}
