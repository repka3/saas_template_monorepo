export type ServiceOrchestrationStep = {
  name: string
  run: () => Promise<void>
  compensate?: () => Promise<void>
}

export type ServiceOrchestrationFailureSummary = {
  completedSteps: string[]
  compensatedSteps: string[]
  uncompensatedSteps: string[]
  compensationFailures: Array<{
    step: string
    error: unknown
  }>
}

export class ServiceOrchestrationError extends Error {
  readonly cause: unknown
  readonly summary: ServiceOrchestrationFailureSummary

  constructor(cause: unknown, summary: ServiceOrchestrationFailureSummary) {
    super('Service orchestration failed')
    this.name = 'ServiceOrchestrationError'
    this.cause = cause
    this.summary = summary
  }
}

export const isServiceOrchestrationError = (value: unknown): value is ServiceOrchestrationError => value instanceof ServiceOrchestrationError

export const runServiceOrchestration = async (steps: ServiceOrchestrationStep[]): Promise<void> => {
  const completedSteps: ServiceOrchestrationStep[] = []

  try {
    for (const step of steps) {
      await step.run()
      completedSteps.push(step)
    }
  } catch (error) {
    const compensatedSteps: string[] = []
    const compensationFailures: ServiceOrchestrationFailureSummary['compensationFailures'] = []

    for (const step of [...completedSteps].reverse()) {
      if (!step.compensate) {
        continue
      }

      try {
        await step.compensate()
        compensatedSteps.push(step.name)
      } catch (compensationError) {
        compensationFailures.push({
          step: step.name,
          error: compensationError,
        })
      }
    }

    const compensatedStepNames = new Set(compensatedSteps)

    throw new ServiceOrchestrationError(error, {
      completedSteps: completedSteps.map((step) => step.name),
      compensatedSteps,
      uncompensatedSteps: completedSteps.filter((step) => !compensatedStepNames.has(step.name)).map((step) => step.name),
      compensationFailures,
    })
  }
}
