/**
 * AI SDK client factory.
 * Supports multiple model providers while keeping the existing Qwen path.
 */

import { LanguageModel } from 'ai';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { alibaba } from '@ai-sdk/alibaba';
import { moonshotai } from '@ai-sdk/moonshotai';
import { zhipu } from 'zhipu-ai-provider';
import type { AgentModelConfig, SupportedModel } from './agentConfig';
import { getQwenBaseUrl } from './agentRuntime';

const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_ZAI_BASE_URL = 'https://api.z.ai/api/paas/v4';

function asLanguageModel(model: unknown): LanguageModel {
	return model as LanguageModel;
}

export function getModelFromConfig(config: AgentModelConfig): LanguageModel {
	const { provider, model } = config;

	const apiKeys: Record<SupportedModel, string | undefined> = {
		deepseek: process.env.DEEPSEEK_API_KEY,
		zai: process.env.ZAI_API_KEY,
		zhipu: process.env.ZHIPU_API_KEY,
		openai: process.env.OPENAI_API_KEY,
		anthropic: process.env.ANTHROPIC_API_KEY,
		moonshotai: process.env.MOONSHOTAI_API_KEY,
		alibaba: process.env.ALIBABA_API_KEY,
		qwen: process.env.QWEN_API_KEY,
	};

	const apiKey = apiKeys[provider];
	if (!apiKey) {
		throw new Error(
			`Missing API key for provider ${provider}. Set ${config.apiKeyEnv} in .env`,
		);
	}

	switch (provider) {
		case 'openai':
			return asLanguageModel(openai(model));
		case 'anthropic':
			return asLanguageModel(anthropic(model));
		case 'deepseek': {
			const deepseek = createOpenAI({
				apiKey,
				baseURL: process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL,
				compatibility: 'compatible',
				name: 'deepseek',
			});
			return asLanguageModel(deepseek(model));
		}
		case 'zai': {
			const zai = createOpenAI({
				apiKey,
				baseURL: process.env.ZAI_BASE_URL || DEFAULT_ZAI_BASE_URL,
				compatibility: 'compatible',
				name: 'zai',
			});
			return asLanguageModel(zai(model));
		}
		case 'alibaba':
			return asLanguageModel(alibaba(model));
		case 'zhipu':
			return asLanguageModel(zhipu(model));
		case 'moonshotai':
			return asLanguageModel(moonshotai(model));
		case 'qwen': {
			const qwen = createOpenAI({
				apiKey,
				baseURL: getQwenBaseUrl(),
			});
			return asLanguageModel(qwen(model));
		}
		default:
			throw new Error(
				`Provider ${provider} not available, please check config model`,
			);
	}
}

export function createModelWithFallback(
	primaryConfig: AgentModelConfig,
	fallbackConfig?: AgentModelConfig,
): LanguageModel {
	try {
		return getModelFromConfig(primaryConfig);
	} catch (error) {
		if (fallbackConfig) {
			console.warn(
				`Failed to initialize ${primaryConfig.provider}, falling back to ${fallbackConfig.provider}`,
			);
			return getModelFromConfig(fallbackConfig);
		}
		throw error;
	}
}
