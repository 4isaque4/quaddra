export type BpmnTextRendererConfig = {
  defaultStyle: {
    fontSize: number;
    lineHeight: number;
  };
  externalStyle: {
    fontSize: number;
    lineHeight: number;
  };
};

export type BpmnViewerOptions = {
  container: HTMLDivElement;
  textRenderer: BpmnTextRendererConfig;
};

const BIZAGI_TEXT_RENDERER: BpmnTextRendererConfig = {
  defaultStyle: { fontSize: 10, lineHeight: 1.1 },
  externalStyle: { fontSize: 10, lineHeight: 1.1 },
};

export function createBpmnViewerOptions(container: HTMLDivElement): BpmnViewerOptions {
  return {
    container,
    textRenderer: BIZAGI_TEXT_RENDERER,
  };
}
