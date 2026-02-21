import { JsonObject } from "@elgato/utils";
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

export enum PixelConnectionState {
	CONNECTED = "CONNECTED",
	DISCONNECTED = "DISCONNECTED",
	CONNECTING = "CONNECTING",
}

export interface DCConfig extends JsonObject {
	type: DCType;
	difficulty: number;
	nat20Audio?: string;
	nat1Audio?: string;
	successAudio?: string;
	failureAudio?: string;
}

export interface Pixel extends JsonObject {
	id: string;
	name: string;
	connectionState: PixelConnectionState;
	dcConfig: DCConfig;
}

export interface GlobalSettings extends JsonObject {
	connectedDevices: {
		[deviceId: string]: Pixel;
	};
}
