import { JsonObject } from "@elgato/streamdeck";

export interface GlobalSettings extends JsonObject {
    [deviceId: string]: number;
}
