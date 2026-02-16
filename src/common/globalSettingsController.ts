import streamDeck from "@elgato/streamdeck";
import { GlobalSettings } from "./types";

export const defaultGlobalSettings: GlobalSettings = {
	actions: {},
	connectedDevices: {},
};

export class GlobalSettingsController {
	private static listeners: Map<string, (event: GlobalSettings) => Promise<void> | void> = new Map()

	public static addListener(actionId: string, listener: (event: GlobalSettings) => Promise<void> | void): void {
		this.listeners.set(actionId, listener);
	}

	public static async get(): Promise<GlobalSettings> {
		return await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	}

	public static removeListener(actionId: string) {
		this.listeners.delete(actionId);
	}

	public static async resetGlobalSettings(): Promise<void> {
		await this.set(defaultGlobalSettings);
	}

	public static async set(settings: GlobalSettings): Promise<void> {
		await streamDeck.settings.setGlobalSettings(settings);

		this.listeners.forEach((listener) => listener(settings))
	}
}
