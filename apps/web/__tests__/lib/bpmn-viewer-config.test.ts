import { createBpmnViewerOptions } from '@/lib/bpmn-viewer-config';

describe('createBpmnViewerOptions', () => {
  it('configura o textRenderer sem alterar a geometria importada do BPMN', () => {
    const container = {} as HTMLDivElement;

    const options = createBpmnViewerOptions(container);

    expect(options.container).toBe(container);
    expect(options.textRenderer).toEqual({
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
    });
  });
});
