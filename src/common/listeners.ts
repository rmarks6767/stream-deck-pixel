// import streamDeck from "@elgato/streamdeck";

// import { soundPlayer } from "../playSound";
// import { DCType, GlobalSettings } from "./types";

// interface RollEvent {
// 	id: string;
// 	state: number;
// 	faceIndex: number;
// }

// /**
//  * This is a listener that will be globally listening to dice rolls and performing audio /
//  * light actions based on the outcomes.
//  * @param event - Dice Roll event
//  */
// export const globalRollListener = async (event: RollEvent) => {
// 	const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
// 	const dieConfig = settings.dieConfigs[event.id];

// 	if (!dieConfig) {
// 		streamDeck.logger.warn("Unknown die event, this should not happen, something is wrong...");

// 		return;
// 	}

// 	const { difficultyConfig } = dieConfig;

// 	if (!difficultyConfig) {
// 		streamDeck.logger.info(`Die ${event.id} does not have any difficulty configuration`);
// 		return;
// 	}

// 	const { difficulty, rolls, type, nat20Audio, nat1Audio, successAudio, failureAudio } = difficultyConfig;

// 	const clearRolls = async () => {
// 		await streamDeck.settings.setGlobalSettings<GlobalSettings>({
// 			...settings,
// 			dieConfigs: {
// 				...settings.dieConfigs,
// 				[event.id]: {
// 					...dieConfig,
// 					difficultyConfig: {
// 						...difficultyConfig,
// 						rolls: [],
// 					},
// 				},
// 			},
// 		});
// 	};

// 	if (event.state === 1) {
// 		if (rolls.length === 2 || type === DCType.standard) {
// 			await clearRolls();
// 		}

// 		rolls.push(event.faceIndex + 1);
// 		const [roll1, roll2] = rolls;

// 		switch (type) {
// 			case DCType.standard: {
// 				if (roll1 === 20 && nat20Audio) {
// 					await soundPlayer.play(nat20Audio);
// 				} else if (roll1 >= difficulty && successAudio) {
// 					await soundPlayer.play(successAudio);
// 				} else if (roll1 === 1 && nat1Audio) {
// 					await soundPlayer.play(nat1Audio);
// 				} else if (roll1 < difficulty && failureAudio) {
// 					await soundPlayer.play(failureAudio);
// 				}
// 				break;
// 			}

// 			case DCType.advantage: {
// 				if ((roll1 === 20 || roll2 === 20) && nat20Audio) {
// 					await soundPlayer.play(nat20Audio);
// 					await clearRolls();
// 				} else if (((roll1 >= difficulty && !roll2) || (roll1 < difficulty && roll2 >= difficulty)) && successAudio) {
// 					await soundPlayer.play(successAudio);
// 				} else if ((roll1 === 1 || roll2 === 1) && nat1Audio) {
// 					await soundPlayer.play(nat1Audio);
// 				} else if (roll1 < difficulty && roll2 < difficulty && failureAudio) {
// 					await soundPlayer.play(failureAudio);
// 				}

// 				break;
// 			}

// 			case DCType.disadvantage: {
// 				if (roll1 === 20 && roll2 === 20 && nat20Audio) {
// 					await soundPlayer.play(nat20Audio);
// 				} else if (roll1 >= difficulty && roll2 >= difficulty && successAudio) {
// 					await soundPlayer.play(successAudio);
// 				} else if ((roll1 === 1 || roll2 === 1) && nat1Audio) {
// 					await soundPlayer.play(nat1Audio);
// 					await clearRolls();
// 				} else if (((roll1 < difficulty && !roll2) || (roll1 >= difficulty && roll2 < difficulty)) && failureAudio) {
// 					await soundPlayer.play(failureAudio);
// 				}

// 				break;
// 			}
// 		}
// 	}
// };
