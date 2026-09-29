// A verovio csomag nem ad típusokat – csak azt írjuk le, amit használunk.
declare module 'verovio/wasm' {
  const createVerovioModule: () => Promise<unknown>;
  export default createVerovioModule;
}

declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(module: unknown);
    setOptions(options: Record<string, unknown>): void;
    loadData(data: string): boolean;
    loadZipDataBuffer(data: ArrayBuffer): boolean;
    getPageCount(): number;
    renderToSVG(page: number): string;
    renderToMIDI(): string;
    getMEI(options?: Record<string, unknown>): string;
    getMIDIValuesForElement(id: string): { pitch: number; time: number; duration: number };
  }
}
