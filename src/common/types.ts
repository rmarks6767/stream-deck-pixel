import { JsonObject } from "@elgato/streamdeck";
import { Characteristic, Peripheral } from "@stoprocent/noble";

export interface PixelBluetoothConfig {
	id: string;
	peripheral: Peripheral;
	notify: Characteristic;
	write: Characteristic;
}

export enum DCType {
	standard = 0,
	advantage = 1,
	disadvantage = 2,
}

export enum ActionType {
	CONNECT = "CONNECT",
	ROLL = "ROLL",
	BATTERY = "BATTERY",
	DC = "DC",
	DC_CHANGE = "DC_CHANGE",
}

enum CounterType {
	PLUS = "PLUS",
	MINUS = "MINUS",
}

export enum PixelConnectionState {
	CONNECTED = 'CONNECTED',
	DISCONNECTED = 'DISCONNECTED',
	CONNECTING = 'CONNECTING',
}

export interface Pixel extends JsonObject {
	id: string;
	name: string;
    connectionState: PixelConnectionState;
}

export interface ActionSettingsBase extends JsonObject {
	id: string;
	type: ActionType;
	pixelId?: string;
}

export interface ConnectActionSettings extends JsonObject {
	type: ActionType.CONNECT;
	discoveredDevices: Pixel[];
}

export interface BatteryActionSettings extends JsonObject {
	type: ActionType.BATTERY;
}

export interface RollActionSettings extends JsonObject {
	type: ActionType.ROLL;
}

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

type ActionSettings = BatteryActionSettings | ConnectActionSettings | DCActionSettings | DCChangeActionSettings | RollActionSettings;

export interface GlobalSettings extends JsonObject {
    actions: {
        [actionId: string]: ActionSettings;
    }
    connectedDevices: {
        [deviceId: string]: Pixel;
    }
}