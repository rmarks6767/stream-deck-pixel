export {};

// To support the legacy and new decorators for the pixel stuff and the streamdeck stuff
declare module "@elgato/streamdeck" {
    export function action(definition: unknown): ClassDecorator;
}
