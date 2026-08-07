/// <reference types="vite/client" />

declare const __FAIRSCREEN_APP_VERSION__: string;

declare module "mammoth/mammoth.browser" {
  export interface MammothRawTextInput {
    readonly arrayBuffer: ArrayBuffer;
  }

  export interface MammothRawTextResult {
    readonly messages: readonly unknown[];
    readonly value: string;
  }

  export function extractRawText(
    input: MammothRawTextInput,
  ): Promise<MammothRawTextResult>;

  const mammoth: {
    readonly extractRawText: typeof extractRawText;
  };

  export default mammoth;
}
