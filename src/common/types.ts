import { JsonObject } from "@elgato/utils";
import { Characteristic, Peripheral } from "@stoprocent/noble";

export interface PixelBluetoothConfig {
	id: string;
	peripheral: Peripheral;
	notify: Characteristic;
	write: Characteristic;
}

export enum PixelConnectionState {
	CONNECTED = "CONNECTED",
	DISCONNECTED = "DISCONNECTED",
	CONNECTING = "CONNECTING",
}

export interface Pixel extends JsonObject {
	id: string;
	name: string;
	connectionState: PixelConnectionState;
}

export interface GlobalSettings extends JsonObject {
	connectedDevices: {
		[deviceId: string]: Pixel;
	};
}
