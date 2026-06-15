export type BpmnTextRendererConfig = {
  defaultStyle: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
  };
  externalStyle: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
  };
};

export type BpmnViewerOptions = {
  container: HTMLDivElement;
  textRenderer: BpmnTextRendererConfig;
};

const BIZAGI_TEXT_RENDERER: BpmnTextRendererConfig = {
  defaultStyle: {
    fontFamily: 'Segoe UI, Arial, sans-serif',
    fontSize: 8,
    lineHeight: 1.05,
  },
  externalStyle: {
    fontFamily: 'Segoe UI, Arial, sans-serif',
    fontSize: 8,
    lineHeight: 1.05,
  },
};

export function createBpmnViewerOptions(container: HTMLDivElement): BpmnViewerOptions {
  return {
    container,
    textRenderer: BIZAGI_TEXT_RENDERER,
  };
}
