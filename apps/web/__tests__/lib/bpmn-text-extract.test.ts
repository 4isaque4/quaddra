import * as fs from 'fs';
import * as path from 'path';
import { extractBpmnTextFromXml } from '@/lib/bpmn-text-extract';

const FIXTURES_DIR = path.join(__dirname, '../fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

describe('extractBpmnTextFromXml', () => {
  describe('com fixture BPMN real (Bizagi)', () => {
    const xml = loadFixture('bpmn-annotations-sample.xml');

    it('extrai texto de textAnnotation com extensionElements no meio', () => {
      const result = extractBpmnTextFromXml(xml);

      expect(result).toBeDefined();
      const taskA = result['Id_1fdd1f4f-5b6d-4139-b9c6-f88b99b3698d'];
      expect(taskA).toBeDefined();
      expect(taskA?.textoFormatado).toContain('CNPJ');
      expect(taskA?.textoFormatado).toContain('QSA (quadro societário)');
      expect(taskA?.textosAssociados).toHaveLength(1);
    });

    it('associação task -> textAnnotation: tarefa recebe texto da anotação (targetRef)', () => {
      const result = extractBpmnTextFromXml(xml);
      const taskA = result['Id_1fdd1f4f-5b6d-4139-b9c6-f88b99b3698d'];
      const normalized = (taskA?.textoFormatado ?? '').replace(/\r\n/g, '\n').trim();

      expect(normalized).toContain('CNPJ');
      expect(normalized).toContain('Inscrição Estadual');
      expect(normalized).toContain('QSA (quadro societário)');
    });

    it('associação textAnnotation -> task: tarefa recebe texto da anotação (sourceRef)', () => {
      const result = extractBpmnTextFromXml(xml);
      const taskB = result['Id_2510acca-715e-4a75-8046-1a70509c67e8'];

      expect(taskB?.textoFormatado).toBe('Mesmos campos de Empresas e Pessoas que Clientes');
      expect(taskB?.textosAssociados).toContain('Mesmos campos de Empresas e Pessoas que Clientes');
    });

    it('tarefa com associação task -> annotation tem textosAssociados preenchido', () => {
      const result = extractBpmnTextFromXml(xml);
      const taskC = result['Id_13d656f3-c7f5-4644-a95a-ac94ac30dba9'];

      expect(taskC?.textoFormatado).toBe('Mesmos campos de Empresas e Pessoas que Clientes');
      expect(taskC?.textosAssociados?.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('comportamento geral', () => {
    it('retorna objeto vazio para XML sem textAnnotation nem association', () => {
      const xml = '<?xml version="1.0"?><definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"></definitions>';
      const result = extractBpmnTextFromXml(xml);
      expect(result).toEqual({});
    });

    it('extrai documentation de userTask quando presente', () => {
      const xml = `
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
          <userTask id="Task_1" name="T1">
            <documentation>Doc da tarefa</documentation>
          </userTask>
        </definitions>
      `;
      const result = extractBpmnTextFromXml(xml);
      expect(result['Task_1']?.textoFormatado).toBe('Doc da tarefa');
    });

    it('não quebra com XML inválido / exceção retorna objeto vazio ou parcial', () => {
      const result = extractBpmnTextFromXml('not xml at all');
      expect(typeof result).toBe('object');
      expect(Array.isArray(result)).toBe(false);
    });
  });
});
