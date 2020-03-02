import { ProjectGraphAnalyzer } from './project-graph-analyzer';
import { DependencyType } from './project-graph-models';

describe('ProjectGraphAnalyzer', () => {
  describe('topologicalSort()', function() {
    it('should return empty for an empty array', () => {
      const nodes = new ProjectGraphAnalyzer({
        nodes: {},
        dependencies: {}
      }).topologicalSort();
      expect(nodes).toEqual([]);
    });

    it('should sort nodes based on their dependencies', () => {
      const analyzer = new ProjectGraphAnalyzer({
        nodes: {},
        dependencies: {
          subapp2: [
            {
              source: 'subapp2',
              target: 'app2',
              type: DependencyType.static
            }
          ],
          app1: [
            {
              source: 'app1',
              target: 'common1',
              type: DependencyType.static
            }
          ],
          app2: [
            {
              source: 'app2',
              target: 'common2',
              type: DependencyType.static
            }
          ],
          common1: [],
          common2: []
        }
      });

      expect(analyzer.topologicalSort().map(node => node.id)).toEqual([
        'common2',
        'app2',
        'subapp2',
        'common1',
        'app1'
      ]);
    });
  });
});
