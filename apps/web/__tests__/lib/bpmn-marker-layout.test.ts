import {
  boxesOverlap,
  chooseMarkerPlacement,
  getCenteredLabelTransform,
  getConnectionVisualProfile,
  getMarkerRoleForBox,
} from '@/lib/bpmn-marker-layout';
import { createBpmnViewerOptions } from '@/lib/bpmn-viewer-config';

describe('bpmn marker layout', () => {
  it('usa tipografia compacta compatível com Bizagi para labels internos', () => {
    const options = createBpmnViewerOptions({} as HTMLDivElement);

    expect(options.textRenderer.defaultStyle).toEqual({
      fontFamily: 'Segoe UI, Arial, sans-serif',
      fontSize: 8,
      lineHeight: 1.05,
    });
  });

  it('reposiciona marcador quando a posição padrão bate no texto', () => {
    const placement = chooseMarkerPlacement({
      shapeBox: { x: 0, y: 0, width: 90, height: 60 },
      markerBox: { x: 4, y: 4, width: 20, height: 20 },
      reservedBoxes: [
        { x: 8, y: 10, width: 74, height: 38 },
      ],
      preferredPositions: [ 'top-left', 'top-right', 'bottom-left', 'bottom-right' ],
      padding: 4,
    });

    expect(placement.position).not.toBe('top-left');
    expect(boxesOverlap(placement.box, { x: 8, y: 10, width: 74, height: 38 }, 2)).toBe(false);
  });

  it('evita que dois marcadores usem o mesmo espaço', () => {
    const first = chooseMarkerPlacement({
      shapeBox: { x: 0, y: 0, width: 90, height: 60 },
      markerBox: { x: 38, y: 40, width: 14, height: 14 },
      reservedBoxes: [
        { x: 20, y: 10, width: 50, height: 25 },
      ],
      preferredPositions: [ 'bottom-center', 'bottom-left', 'bottom-right', 'top-left', 'top-right' ],
      padding: 4,
    });

    const second = chooseMarkerPlacement({
      shapeBox: { x: 0, y: 0, width: 90, height: 60 },
      markerBox: { x: 4, y: 4, width: 17, height: 20 },
      reservedBoxes: [
        { x: 20, y: 10, width: 50, height: 25 },
        first.box,
      ],
      preferredPositions: [ 'top-left', 'top-right', 'bottom-left', 'bottom-right' ],
      padding: 4,
    });

    expect(boxesOverlap(first.box, second.box, 2)).toBe(false);
  });
  it('mantem as partes transformadas do marcador de subprocesso no mesmo grupo inferior', () => {
    const shapeBox = { x: 0, y: 0, width: 90, height: 60 };

    expect(getMarkerRoleForBox(shapeBox, { x: 37.5, y: 40, width: 14, height: 14 })).toBe('bottom');
    expect(getMarkerRoleForBox(shapeBox, { x: 39.5, y: 42, width: 10, height: 10 })).toBe('bottom');
  });

  it('centraliza o texto de uma anotacao BPMN no espaco util depois do bracket', () => {
    const transform = getCenteredLabelTransform({
      containerBox: { x: 0, y: 0, width: 146, height: 71 },
      labelBox: { x: 3.43, y: 6.16, width: 92.55, height: 35.91 },
      insetX: 16,
      insetY: 4,
    });

    expect(transform.dx).toBeCloseTo(12.57, 2);
    expect(transform.dy).toBeCloseTo(11.385, 3);
  });

  it('mantem setas proporcionais quando o diagrama esta em zoom baixo', () => {
    const profile = getConnectionVisualProfile('bpmn:SequenceFlow');

    expect(profile.fixedStroke).toBe(false);
    expect(profile.markerSize).toBeLessThan(10);
    expect(profile.strokeWidth).toBe(2);
  });
});
