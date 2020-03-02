import { ProjectGraphDependency, ProjectGraph } from './project-graph-models';

type VertexKey = string;

export interface VertexType {
  id: VertexKey;
  dependencies: ProjectGraphDependency[];
}

interface VisitGraphCallback {
  enterVertex(options: {
    currentVertex: VertexType;
    previousVertex: VertexType;
  }): void;

  leaveVertex(options: {
    currentVertex: VertexType;
    previousVertex: VertexType;
  }): void;

  allowTraversal(options: {
    nextVertex: VertexType;
    currentVertex: VertexType;
    previousVertex: VertexType;
  }): boolean;
}

export class ProjectGraphAnalyzer {
  constructor(private graph: ProjectGraph) {}

  /**
   * @returns true if source dependes on target
   */
  dependsOn(
    source: string,
    target: string,
    visitedProjects: string[] = []
  ): boolean {
    const dependencies = this.graph.dependencies[source];
    if (!dependencies) {
      return false;
    }
    if (dependencies.find(dep => dep.target === target)) {
      return true;
    }
    return !!this.graph.dependencies[source].find(r => {
      if (visitedProjects.indexOf(r.target) > -1) return null;
      return this.dependsOn(r.target, target, [...visitedProjects, r.target]);
    });
  }

  /**
   * @param {Graph} graph
   */
  topologicalSort(): VertexType[] {
    const unvisitedSet: Record<VertexKey, VertexType> = {};
    this.getAllVertices().forEach(vertex => {
      unvisitedSet[vertex.id] = vertex;
    });

    const visitedSet: Record<VertexKey, VertexType> = {};

    let sortedStack: VertexType[] = []; //new Stack();

    const dfsCallbacks: VisitGraphCallback = {
      enterVertex: ({ currentVertex }) => {
        visitedSet[currentVertex.id] = currentVertex;
        delete unvisitedSet[currentVertex.id];
      },
      leaveVertex: ({ currentVertex }) => {
        sortedStack.push(currentVertex);
      },
      allowTraversal: ({ nextVertex }) => {
        return !visitedSet[nextVertex.id];
      }
    };

    while (Object.keys(unvisitedSet).length) {
      const currentVertexKey = Object.keys(unvisitedSet)[0];
      const currentVertex = unvisitedSet[currentVertexKey];
      this.depthFirstSearch(currentVertex, dfsCallbacks);
    }

    return sortedStack;
  }

  private depthFirstSearchRecursive(
    currentVertex: VertexType,
    previousVertex: VertexType,
    callbacks: VisitGraphCallback
  ) {
    callbacks.enterVertex({ currentVertex, previousVertex });

    this.getNeighbors(currentVertex).forEach(nextVertex => {
      if (
        callbacks.allowTraversal({ previousVertex, currentVertex, nextVertex })
      ) {
        this.depthFirstSearchRecursive(nextVertex, currentVertex, callbacks);
      }
    });

    callbacks.leaveVertex({ currentVertex, previousVertex });
  }

  private getNeighbors(currentVertex: VertexType): VertexType[] {
    const edges = this.getEdges(currentVertex);
    return edges.map((node: ProjectGraphDependency) => {
      return {
        id: node.target,
        dependencies: this.graph.dependencies[node.target]
      };
    });
  }

  private getEdges(currentVertex: VertexType): ProjectGraphDependency[] {
    return this.graph.dependencies[currentVertex.id] || [];
  }

  private getAllVertices(): VertexType[] {
    return Object.keys(this.graph.dependencies).map(key => {
      return {
        id: key,
        dependencies: this.graph.dependencies[key]
      };
    });
  }

  private depthFirstSearch(
    startVertex: VertexType,
    callbacks: Partial<VisitGraphCallback> = {}
  ) {
    const previousVertex: VertexType = null;
    this.depthFirstSearchRecursive(
      startVertex,
      previousVertex,
      this.initCallbacks(callbacks)
    );
  }

  private initCallbacks(
    callbacks: Partial<VisitGraphCallback> = {}
  ): VisitGraphCallback {
    const initiatedCallback = callbacks;

    const stubCallback = () => {};

    const allowTraversalCallback = (() => {
      const seen: Record<VertexKey, boolean> = {};
      return (options: {
        nextVertex: VertexType;
        currentVertex: VertexType;
        previousVertex: VertexType;
      }) => {
        if (!seen[options.nextVertex.id]) {
          seen[options.nextVertex.id] = true;
          seen[options.nextVertex.id] = true;
          return true;
        }
        return false;
      };
    })();

    initiatedCallback.allowTraversal =
      callbacks.allowTraversal || allowTraversalCallback;
    initiatedCallback.enterVertex = callbacks.enterVertex || stubCallback;
    initiatedCallback.leaveVertex = callbacks.leaveVertex || stubCallback;

    return initiatedCallback as VisitGraphCallback;
  }
}
