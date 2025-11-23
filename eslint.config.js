import { config } from "@elgato/eslint-config";
import { defineConfig } from "eslint/config";
export default defineConfig([
	{
		extends: [config.recommended],
		rules: {
			"jsdoc/require-jsdoc": "off",
		},
	},
]);