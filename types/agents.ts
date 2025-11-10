export interface Agent {
  id: string;
  name: string;
  slug: string;
  title: string;
  description: string;
  tagline: string;
  color: {
    primary: string;
    secondary: string;
    gradient: string;
  };
  icon: string;
  capabilities: AgentCapability[];
  useCases: AgentUseCase[];
  technicalDetails: TechnicalDetail[];
  workflow: WorkflowStep[];
}

export interface AgentCapability {
  id: string;
  title: string;
  description: string;
  icon?: string;
}

export interface AgentUseCase {
  id: string;
  title: string;
  description: string;
  example: string;
}

export interface TechnicalDetail {
  id: string;
  aspect: string;
  description: string;
}

export interface WorkflowStep {
  id: string;
  step: number;
  title: string;
  description: string;
}
