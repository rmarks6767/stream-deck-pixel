import streamDeck, { DidReceiveGlobalSettingsEvent } from "@elgato/streamdeck"
import { GlobalSettings } from "./types"
import { PixelManager } from "../pixelHelpers/PixelManagerV2";

/**
 * Function responsible for running after plugin has successfully connected.
 * This will connect to all the devices stored in our global settings so the 
 * individual actions do not.
 * @param pixelManager - An instance of the PixelManager class
 */
export const startup = async (pixelManager: PixelManager) => {
	let settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();

	// Initial creation of the settings object
	if (!settings) {
		settings = {
			actions: {},
			knownDevices: {}
		}

		await streamDeck.settings.setGlobalSettings<GlobalSettings>(settings);
	}

	const setConnectionStatus = async (id: string, connected: boolean) => {
		await streamDeck.settings.setGlobalSettings<GlobalSettings>({
			...settings,
			knownDevices: {
				...settings.knownDevices,
				[id]: {
					...settings.knownDevices[id],
					connected,
				}
			}
		})
	}

	await Promise.all(
		Object.keys(settings.knownDevices).map(async (deviceId) => {
			try {
				console.log(`[startup]: Attempting to connect to ${deviceId}`);
				
				await pixelManager.connect(deviceId);
				await setConnectionStatus(deviceId, true);

				console.log(`[startup}]: Successfully connected to ${deviceId}`);
			} catch (error) {
				console.error(`[startup]: Failed to connect to device, setting as disconnected`, error);
                
				await setConnectionStatus(deviceId, false);
			}
		})
	);

	// We will finally register a settings listener to disconnect a device if all actions no longer reference it
	streamDeck.settings.onDidReceiveGlobalSettings(async (event: DidReceiveGlobalSettingsEvent<GlobalSettings>) => {
		const actionDevices = new Set<string>();

		Object.entries(event.settings.actions).forEach(([, { pixelId }]) => {
			if (pixelId) {
				actionDevices.add(pixelId);
			}
		});

		await Promise.all(
			Object.keys(event.settings.knownDevices).map(async (deviceId) => {
				if (!actionDevices.has(deviceId)) {
					await pixelManager.disconnect(deviceId);
				}
			})
		);
	});
}