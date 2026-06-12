/**
 * Per-agent model configuration.
 * Supports explicit provider/model values while remaining compatible with
 * legacy single-string model names already used in this project.
 */

export type SupportedModel =
	| 'deepseek'
	| 'zai'
	| 'zhipu'
	| 'openai'
	| 'anthropic'
	| 'moonshotai'
	| 'alibaba'
	| 'qwen';

export interface AgentModelConfig {
	name: string;
	model: string;
	provider: SupportedModel;
	apiKeyEnv: string;
	temperature?: number;
	maxTokens?: number;
}

const DEFAULT_CONFIGS: Record<string, AgentModelConfig> = {
	main: {
		name: 'Main Agent (Intent Router)',
		model: 'deepseek-v4-pro',
		provider: 'deepseek',
		apiKeyEnv: 'DEEPSEEK_API_KEY',
		temperature: 0.7,
		maxTokens: 2000,
	},
	earning: {
		name: 'Earning Agent',
		model: 'deepseek-v4-pro',
		provider: 'deepseek',
		apiKeyEnv: 'DEEPSEEK_API_KEY',
		temperature: 0.3,
		maxTokens: 2000,
	},
	bridge: {
		name: 'Bridge Agent',
		model: 'deepseek-v4-pro',
		provider: 'deepseek',
		apiKeyEnv: 'DEEPSEEK_API_KEY',
		temperature: 0.5,
		maxTokens: 1500,
	},
	risk: {
		name: 'Risk Agent',
		model: 'deepseek-v4-pro',
		provider: 'deepseek',
		apiKeyEnv: 'DEEPSEEK_API_KEY',
		temperature: 0.3,
		maxTokens: 1500,
	},
	monitor: {
		name: 'Monitor Agent',
		model: 'deepseek-v4-pro',
		provider: 'deepseek',
		apiKeyEnv: 'DEEPSEEK_API_KEY',
		temperature: 0.5,
		maxTokens: 1000,
	},
	checkout: {
		name: 'Checkout Agent',
		model: 'glm-5.1',
		provider: 'zai',
		apiKeyEnv: 'ZAI_API_KEY',
		temperature: 0.2,
		maxTokens: 2000,
	},
};

export function getAgentConfig(
	agentName: keyof typeof DEFAULT_CONFIGS,
): AgentModelConfig {
	const envKey = `${agentName.toUpperCase()}_AGENT_MODEL`;
	const envModel = process.env[envKey];

	if (envModel) {
		return parseModelString(envModel, agentName);
	}

	return DEFAULT_CONFIGS[agentName];
}

function parseModelString(
	modelString: string,
	agentName: string,
): AgentModelConfig {
	const base = DEFAULT_CONFIGS[agentName];

	if (modelString.includes('/')) {
		const [provider, model] = modelString.split('/');
		return {
			...base,
			model,
			provider: provider as SupportedModel,
			apiKeyEnv: getApiKeyEnvName(provider as SupportedModel),
		};
	}

	if (modelString.includes(':')) {
		const [provider, model] = modelString.split(':');
		return {
			...base,
			model,
			provider: provider as SupportedModel,
			apiKeyEnv: getApiKeyEnvName(provider as SupportedModel),
		};
	}

	let provider: SupportedModel = 'deepseek';
	if (modelString.startsWith('gpt-')) provider = 'openai';
	else if (modelString.startsWith('glm-5.1')) provider = 'zai';
	else if (modelString.includes('glm')) provider = 'zhipu';
	else if (modelString.startsWith('claude')) provider = 'anthropic';
	else if (modelString.startsWith('qwen')) provider = 'qwen';
	else if (modelString.startsWith('kimi') || modelString.startsWith('moonshot'))
		provider = 'moonshotai';
	else if (modelString.startsWith('qvq') || modelString.startsWith('qwen-max'))
		provider = 'alibaba';
	else if (modelString.startsWith('deepseek')) provider = 'deepseek';

	return {
		...base,
		model: modelString,
		provider,
		apiKeyEnv: getApiKeyEnvName(provider),
	};
}

function getApiKeyEnvName(provider: SupportedModel): string {
	const keyMap: Record<SupportedModel, string> = {
		deepseek: 'DEEPSEEK_API_KEY',
		zai: 'ZAI_API_KEY',
		zhipu: 'ZHIPU_API_KEY',
		openai: 'OPENAI_API_KEY',
		anthropic: 'ANTHROPIC_API_KEY',
		moonshotai: 'MOONSHOTAI_API_KEY',
		alibaba: 'ALIBABA_API_KEY',
		qwen: 'QWEN_API_KEY',
	};

	return keyMap[provider];
}

export function validateApiKey(provider: SupportedModel): boolean {
	return !!process.env[getApiKeyEnvName(provider)];
}
