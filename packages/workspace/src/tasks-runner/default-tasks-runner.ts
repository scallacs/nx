import * as runAll from 'npm-run-all';
import { basename } from 'path';
import { Observable } from 'rxjs';

import { cliCommand } from '../core/file-utils';
import { ProjectGraph } from '../core/project-graph';
import { ProjectGraphAnalyzer } from '../core/project-graph/project-graph-analyzer';
import { NxJson } from '../core/shared-interfaces';
import { readJsonFile } from '../utils/fileutils';
import { output } from '../utils/output';
import {
  AffectedEventType,
  Task,
  TaskCompleteEvent,
  TasksRunner
} from './tasks-runner';
import { getCommandAsString, topologicallySortTasks } from './utils';

export interface DefaultTasksRunnerOptions {
  parallel?: boolean;
  maxParallel?: number;
}

export function taskDependsOnDeps(
  task: Task,
  deps: Task[],
  projectGraph: ProjectGraph
) {
  const graphAnalyzer = new ProjectGraphAnalyzer(projectGraph);
  return !!deps.find(dep =>
    graphAnalyzer.dependsOn(task.target.project, dep.target.project, [])
  );
}

export function splitTasksIntoStages(
  tasks: Task[],
  projectGraph: ProjectGraph
) {
  if (tasks.length === 0) return [];
  const res = [];
  const graphAnalyzer = new ProjectGraphAnalyzer(projectGraph);
  topologicallySortTasks(graphAnalyzer, tasks).forEach(t => {
    const stageWithNoDeps = res.find(
      tasksInStage => !taskDependsOnDeps(t, tasksInStage, projectGraph)
    );
    if (stageWithNoDeps) {
      stageWithNoDeps.push(t);
    } else {
      res.push([t]);
    }
  });
  return res;
}

export const defaultTasksRunner: TasksRunner<DefaultTasksRunnerOptions> = (
  tasks: Task[],
  options: DefaultTasksRunnerOptions,
  context: { target: string; projectGraph: ProjectGraph; nxJson: NxJson }
): Observable<TaskCompleteEvent> => {
  return new Observable(subscriber => {
    runTasks(tasks, options, context)
      .then(data => data.forEach(d => subscriber.next(d)))
      .catch(e => {
        console.error('Unexpected error:');
        console.error(e);
        process.exit(1);
      })
      .finally(() => {
        subscriber.complete();
        // fix for https://github.com/nrwl/nx/issues/1666
        if (process.stdin['unref']) (process.stdin as any).unref();
      });
  });
};

async function runTasks(
  tasks: Task[],
  options: DefaultTasksRunnerOptions,
  context: { target: string; projectGraph: ProjectGraph }
): Promise<Array<{ task: Task; type: any; success: boolean }>> {
  const cli = cliCommand();
  assertPackageJsonScriptExists(cli);
  const isYarn = basename(process.env.npm_execpath || 'npm').startsWith('yarn');
  const stages =
    context.target === 'build'
      ? splitTasksIntoStages(tasks, context.projectGraph)
      : [tasks];

  const res = [];
  for (let i = 0; i < stages.length; ++i) {
    const tasksInStage = stages[i];
    try {
      const commands = tasksInStage.map(t =>
        getCommandAsString(cli, isYarn, t)
      );
      await runAll(commands, {
        parallel: options.parallel || false,
        maxParallel: options.maxParallel || 3,
        continueOnError: true,
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr
      });
      res.push(...tasksToStatuses(tasksInStage, true));
    } catch (e) {
      e.results.forEach((result, i) => {
        res.push({
          task: tasksInStage[i],
          type: AffectedEventType.TaskComplete,
          success: result.code === 0
        });
      });
      res.push(...markStagesAsNotSuccessful(stages.splice(i + 1)));
      return res;
    }
  }
  return res;
}

function markStagesAsNotSuccessful(stages: Task[][]) {
  return stages.reduce((m, c) => [...m, ...tasksToStatuses(c, false)], []);
}

function tasksToStatuses(tasks: Task[], success: boolean) {
  return tasks.map(task => ({
    task,
    type: AffectedEventType.TaskComplete,
    success
  }));
}

function assertPackageJsonScriptExists(cli: string) {
  // Make sure the `package.json` has the `nx: "nx"` command needed by `npm-run-all`
  const packageJson = readJsonFile('./package.json');
  if (!packageJson.scripts || !packageJson.scripts[cli]) {
    output.error({
      title: `The "scripts" section of your 'package.json' must contain "${cli}": "${cli}"`,
      bodyLines: [
        output.colors.gray('...'),
        ' "scripts": {',
        output.colors.gray('  ...'),
        `   "${cli}": "${cli}"`,
        output.colors.gray('  ...'),
        ' }',
        output.colors.gray('...')
      ]
    });
    return process.exit(1);
  }
}

export default defaultTasksRunner;
