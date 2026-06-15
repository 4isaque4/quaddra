export type BpmnLayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MarkerPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center'
  | 'outside-top-left'
  | 'outside-top-right'
  | 'outside-bottom-left'
  | 'outside-bottom-right';

export type MarkerPlacement = {
  position: MarkerPosition;
  scale: number;
  box: BpmnLayoutBox;
};

type ChooseMarkerPlacementInput = {
  shapeBox: BpmnLayoutBox;
  markerBox: BpmnLayoutBox;
  reservedBoxes: BpmnLayoutBox[];
  preferredPositions: MarkerPosition[];
  padding?: number;
};

type ViewerWithRegistry = {
  get: (name: string) => unknown;
};

type RegistryElement = {
  id: string;
  type?: string;
  width?: number;
  height?: number;
  businessObject?: {
    $type?: string;
  };
};

type ElementRegistry = {
  getAll: () => RegistryElement[];
  getGraphics: (element: RegistryElement) => Element | null;
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const ZERO_BOX: BpmnLayoutBox = { x: 0, y: 0, width: 0, height: 0 };

export function boxesOverlap(a: BpmnLayoutBox, b: BpmnLayoutBox, padding = 0): boolean {
  const aa = expandBox(a, padding);
  const bb = expandBox(b, padding);

  return aa.x < bb.x + bb.width
    && aa.x + aa.width > bb.x
    && aa.y < bb.y + bb.height
    && aa.y + aa.height > bb.y;
}

export function chooseMarkerPlacement({
  shapeBox,
  markerBox,
  reservedBoxes,
  preferredPositions,
  padding = 4,
}: ChooseMarkerPlacementInput): MarkerPlacement {
  const scales = [1, 0.9, 0.8, 0.7, 0.6];
  const positions = [
    ...preferredPositions,
    'outside-top-left',
    'outside-top-right',
    'outside-bottom-left',
    'outside-bottom-right',
  ] as MarkerPosition[];
  let best: { placement: MarkerPlacement; score: number } | null = null;

  for (const scale of scales) {
    for (const [index, position] of positions.entries()) {
      const box = getPositionedMarkerBox(shapeBox, markerBox, position, padding, scale);
      const overlap = reservedBoxes.reduce((sum, reserved) => sum + intersectionArea(box, expandBox(reserved, 5)), 0);
      const outside = position.startsWith('outside-') ? 0 : outsideArea(box, shapeBox);
      const distance = Math.abs(box.x - markerBox.x) + Math.abs(box.y - markerBox.y);
      const outsidePenalty = position.startsWith('outside-') ? 500 : 0;
      const score = overlap * 10000 + outside * 1000 + outsidePenalty + index * 20 + (1 - scale) * 100 + distance;
      const placement = { position, scale, box };

      if (overlap === 0 && outside === 0) {
        return placement;
      }

      if (!best || score < best.score) {
        best = { placement, score };
      }
    }
  }

  return best?.placement ?? {
    position: preferredPositions[0] ?? 'top-left',
    scale: 1,
    box: markerBox,
  };
}

export function arrangeBpmnActivityMarkers(instance: ViewerWithRegistry): void {
  const elementRegistry = instance.get('elementRegistry') as ElementRegistry;
  if (!elementRegistry?.getAll || !elementRegistry?.getGraphics) return;

  for (const element of elementRegistry.getAll()) {
    if (!isActivityElement(element)) continue;

    const gfx = elementRegistry.getGraphics(element);
    const visual = getDirectVisual(gfx);
    if (!visual) continue;

    const label = getDirectLabel(visual);
    const labelBox = label ? getSvgBox(label) : null;
    if (!labelBox || labelBox.width <= 0 || labelBox.height <= 0) continue;

    const shapeBox = getElementBox(element, visual);
    const markerGroups = ensureMarkerGroups(visual, shapeBox);
    if (markerGroups.length === 0) continue;

    const reservedBoxes = [ labelBox ];

    for (const markerGroup of markerGroups) {
      const markerBox = getSvgBox(markerGroup.group);
      if (markerBox.width <= 0 || markerBox.height <= 0) continue;

      const placement = chooseMarkerPlacement({
        shapeBox,
        markerBox,
        reservedBoxes,
        preferredPositions: markerGroup.role === 'bottom'
          ? [ 'bottom-center', 'bottom-left', 'bottom-right', 'top-left', 'top-right' ]
          : [ 'top-left', 'top-right', 'bottom-left', 'bottom-right' ],
        padding: markerGroup.role === 'bottom' ? 4 : 3,
      });

      applyMarkerTransform(markerGroup.group, markerBox, placement);
      reservedBoxes.push(placement.box);
    }
  }
}

function isActivityElement(element: RegistryElement): boolean {
  const type = element.type || element.businessObject?.$type || '';
  return /\bbpmn:(?:.*Task|CallActivity|SubProcess|Transaction)\b/.test(type);
}

function getDirectVisual(gfx: Element | null): SVGGElement | null {
  if (!gfx) return null;
  return Array.from(gfx.children).find((child): child is SVGGElement => {
    return child instanceof SVGGElement && child.classList.contains('djs-visual');
  }) ?? null;
}

function getDirectLabel(visual: SVGGElement): SVGGraphicsElement | null {
  return Array.from(visual.children).find((child): child is SVGGraphicsElement => {
    return child instanceof SVGGraphicsElement
      && child.tagName.toLowerCase() === 'text'
      && child.classList.contains('djs-label');
  }) ?? null;
}

function getElementBox(element: RegistryElement, visual: SVGGElement): BpmnLayoutBox {
  const width = Number(element.width);
  const height = Number(element.height);

  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { x: 0, y: 0, width, height };
  }

  const rect = Array.from(visual.children).find((child): child is SVGGraphicsElement => {
    return child instanceof SVGGraphicsElement && child.tagName.toLowerCase() === 'rect';
  });

  return rect ? getSvgBox(rect) : ZERO_BOX;
}

function ensureMarkerGroups(visual: SVGGElement, shapeBox: BpmnLayoutBox): Array<{ group: SVGGElement; role: 'top' | 'bottom' }> {
  const existing = Array.from(visual.children)
    .filter((child): child is SVGGElement => child instanceof SVGGElement && child.hasAttribute('data-qdx-marker-group'))
    .map((group) => ({
      group,
      role: (group.getAttribute('data-qdx-marker-role') === 'bottom' ? 'bottom' : 'top') as 'top' | 'bottom',
    }));

  if (existing.length > 0) return existing;

  const children = Array.from(visual.children);
  const labelIndex = children.findIndex((child) => child instanceof SVGTextElement && child.classList.contains('djs-label'));
  if (labelIndex < 0) return [];

  const markerNodes = children.slice(labelIndex + 1).filter((child): child is SVGGraphicsElement => {
    if (!(child instanceof SVGGraphicsElement)) return false;
    const tag = child.tagName.toLowerCase();
    if (![ 'path', 'rect', 'circle', 'ellipse', 'polygon' ].includes(tag)) return false;
    const box = getSvgBox(child);
    return box.width > 0 && box.height > 0 && box.width <= shapeBox.width * 0.75 && box.height <= shapeBox.height * 0.75;
  });

  const topNodes: SVGGraphicsElement[] = [];
  const bottomNodes: SVGGraphicsElement[] = [];

  for (const node of markerNodes) {
    const box = getSvgBox(node);
    const centerY = box.y + box.height / 2;
    if (centerY >= shapeBox.height * 0.55) {
      bottomNodes.push(node);
    } else {
      topNodes.push(node);
    }
  }

  return [
    topNodes.length ? { group: wrapMarkerNodes(visual, topNodes, 'top'), role: 'top' as const } : null,
    bottomNodes.length ? { group: wrapMarkerNodes(visual, bottomNodes, 'bottom'), role: 'bottom' as const } : null,
  ].filter((group): group is { group: SVGGElement; role: 'top' | 'bottom' } => Boolean(group));
}

function wrapMarkerNodes(visual: SVGGElement, nodes: SVGGraphicsElement[], role: 'top' | 'bottom'): SVGGElement {
  const group = visual.ownerDocument.createElementNS(SVG_NS, 'g') as SVGGElement;
  group.setAttribute('class', 'qdx-bpmn-marker');
  group.setAttribute('data-qdx-marker-group', 'true');
  group.setAttribute('data-qdx-marker-role', role);
  visual.insertBefore(group, nodes[0]);

  for (const node of nodes) {
    group.appendChild(node);
  }

  return group;
}

function applyMarkerTransform(group: SVGGElement, markerBox: BpmnLayoutBox, placement: MarkerPlacement): void {
  const tx = placement.box.x - markerBox.x * placement.scale;
  const ty = placement.box.y - markerBox.y * placement.scale;
  group.setAttribute('transform', `translate(${round(tx)} ${round(ty)}) scale(${round(placement.scale)})`);
  group.setAttribute('data-qdx-marker-position', placement.position);
}

function getPositionedMarkerBox(
  shapeBox: BpmnLayoutBox,
  markerBox: BpmnLayoutBox,
  position: MarkerPosition,
  padding: number,
  scale: number,
): BpmnLayoutBox {
  const width = markerBox.width * scale;
  const height = markerBox.height * scale;
  let x = shapeBox.x + padding;
  let y = shapeBox.y + padding;

  if (position.includes('right')) {
    x = shapeBox.x + shapeBox.width - width - padding;
  } else if (position.includes('center')) {
    x = shapeBox.x + shapeBox.width / 2 - width / 2;
  }

  if (position.includes('bottom')) {
    y = shapeBox.y + shapeBox.height - height - padding;
  }

  if (position === 'outside-top-left') {
    x = shapeBox.x + padding;
    y = shapeBox.y - height - padding;
  }
  if (position === 'outside-top-right') {
    x = shapeBox.x + shapeBox.width - width - padding;
    y = shapeBox.y - height - padding;
  }
  if (position === 'outside-bottom-left') {
    x = shapeBox.x + padding;
    y = shapeBox.y + shapeBox.height + padding;
  }
  if (position === 'outside-bottom-right') {
    x = shapeBox.x + shapeBox.width - width - padding;
    y = shapeBox.y + shapeBox.height + padding;
  }

  return { x, y, width, height };
}

function getSvgBox(node: SVGGraphicsElement): BpmnLayoutBox {
  try {
    const box = node.getBBox();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  } catch {
    return ZERO_BOX;
  }
}

function expandBox(box: BpmnLayoutBox, amount: number): BpmnLayoutBox {
  return {
    x: box.x - amount,
    y: box.y - amount,
    width: box.width + amount * 2,
    height: box.height + amount * 2,
  };
}

function intersectionArea(a: BpmnLayoutBox, b: BpmnLayoutBox): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function outsideArea(box: BpmnLayoutBox, container: BpmnLayoutBox): number {
  const insideWidth = Math.max(0, Math.min(box.x + box.width, container.x + container.width) - Math.max(box.x, container.x));
  const insideHeight = Math.max(0, Math.min(box.y + box.height, container.y + container.height) - Math.max(box.y, container.y));
  return box.width * box.height - insideWidth * insideHeight;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
