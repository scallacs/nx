import { ProjectGraph } from '../core/project-graph';
import { Task } from './tasks-runner';
import { ProjectGraphAnalyzer } from '../core/project-graph/project-graph-analyzer';
import { topologicallySortTasks } from './utils';

export class TaskOrderer {
  private graphAnalyzer: ProjectGraphAnalyzer;

  constructor(
    private readonly target: string,
    readonly projectGraph: ProjectGraph
  ) {
    this.graphAnalyzer = new ProjectGraphAnalyzer(this.projectGraph);
  }

  private taskDependsOnDeps(task: Task, deps: Task[]) {
    return !!deps.find(dep =>
      this.graphAnalyzer.dependsOn(task.target.project, dep.target.project, [])
    );
  }

  splitTasksIntoStages(tasks: Task[]) {
    if (this.target !== 'build') return [tasks];
    if (tasks.length === 0) return [];
    const res = [];
    topologicallySortTasks(this.graphAnalyzer, tasks).forEach(t => {
      const stageWithNoDeps = res.find(
        tasksInStage => !this.taskDependsOnDeps(t, tasksInStage)
      );
      if (stageWithNoDeps) {
        stageWithNoDeps.push(t);
      } else {
        res.push([t]);
      }
    });
    return res;
  }
}
