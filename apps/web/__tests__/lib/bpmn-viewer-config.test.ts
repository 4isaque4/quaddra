import { createBpmnViewerOptions } from '@/lib/bpmn-viewer-config';

describe('createBpmnViewerOptions', () => {
  it('configura o textRenderer sem alterar a geometria importada do BPMN', () => {
    const container = {} as HTMLDivElement;

    const options = createBpmnViewerOptions(container);

    expect(options.container).toBe(container);
    expect(options.textRenderer).toEqual({
      defaultStyle: { fontSize: 10, lineHeight: 1.1 },
      externalStyle: { fontSize: 10, lineHeight: 1.1 },
    });
  });
});
