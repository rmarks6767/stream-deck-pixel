import { JsonObject } from "@elgato/streamdeck";

export enum DCType {
	standard = 0,
	advantage = 1,
	disadvantage = 2,
}

enum ActionType {
	ROLL = "ROLL",
	DC = "DC",
	DC_CHANGE = "DC_CHANGE",
}

enum CounterType {
	PLUS = "PLUS",
	MINUS = "MINUS",
}

export interface Pixel extends JsonObject {
	id: string;
	name: string;
    connected: boolean;
}

export interface ActionSettingsBase extends JsonObject {
	id: string;
	type: ActionType;
	pixelId?: string;
}

export type BatteryActionSettings = ActionSettingsBase;

export type RollActionSettings = ActionSettingsBase;

export interface DCActionSettings extends ActionSettingsBase {
	type: ActionType.DC;

	dcType: DCType;
	nat20Audio?: string;
	nat20Color?: string;
	nat1Audio?: string;
	nat1Color?: string;
	successAudio?: string;
	successColor?: string;
	failureAudio?: string;
	failureColor?: string;
}

export interface DCChangeActionSettings extends ActionSettingsBase {
	type: ActionType.DC_CHANGE;

	counterType: CounterType;
}

type ActionSettings = BatteryActionSettings | DCActionSettings | DCChangeActionSettings | RollActionSettings;

export interface GlobalSettings extends JsonObject {
    actions: {
        [actionId: string]: ActionSettings;
    }
    knownDevices: {
        [deviceId: string]: Pixel;
    }
}