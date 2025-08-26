declare module 'bpmn-js/dist/bpmn-navigated-viewer.development.js' {
  export default class BpmnJS {
    constructor(options: { container: HTMLElement });
    importXML(xml: string): Promise<any>;
    get(service: string): any;
    destroy(): void;
  }
}

declare module 'bpmn-js' {
  export default class BpmnJS {
    constructor(options: { container: HTMLElement });
    importXML(xml: string): Promise<any>;
    get(service: string): any;
    destroy(): void;
  }
}
