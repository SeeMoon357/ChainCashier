import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { type HomeViewId } from '@/components/home/HomeShell';
import AgentView from '@/components/home/views/AgentView';
import AnalyticsView from '@/components/home/views/AnalyticsView';
import DashboardView from '@/components/home/views/DashboardView';
import ExecutorView from '@/components/home/views/ExecutorView';
import InsightsView from '@/components/home/views/InsightsView';
import NewStrategyView from '@/components/home/views/NewStrategyView';
import RefineryView from '@/components/home/views/RefineryView';
import RouterView from '@/components/home/views/RouterView';
import SettingsView from '@/components/home/views/SettingsView';
import VaultsView from '@/components/home/views/VaultsView';

type MotionConfig = {
	initial: { opacity: number; x?: number; scale?: number };
	animate: { opacity: number; x?: number; scale?: number };
	exit: { opacity: number; x?: number; scale?: number };
	content: ReactNode;
};

type HomeMainContentProps = {
	currentView: HomeViewId;
};

const VIEW_MAP: Record<HomeViewId, MotionConfig> = {
	'auto-agent': {
		initial: { opacity: 0, x: 20 },
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: -20 },
		content: <AgentView />,
	},
	dashboard: {
		initial: { opacity: 0, x: 20 },
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: -20 },
		content: <DashboardView />,
	},
	analytics: {
		initial: { opacity: 0, x: 20 },
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: -20 },
		content: <AnalyticsView />,
	},
	vaults: {
		initial: { opacity: 0, x: 20 },
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: -20 },
		content: <VaultsView />,
	},
	router: {
		initial: { opacity: 0, x: 20 },
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: -20 },
		content: <RouterView />,
	},
	refinery: {
		initial: { opacity: 0, x: 20 },
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: -20 },
		content: <RefineryView />,
	},
	executor: {
		initial: { opacity: 0, x: 20 },
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: -20 },
		content: <ExecutorView />,
	},
	settings: {
		initial: { opacity: 0, x: 20 },
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: -20 },
		content: <SettingsView />,
	},
	'new-strategy': {
		initial: { opacity: 0, scale: 0.95 },
		animate: { opacity: 1, scale: 1 },
		exit: { opacity: 0, scale: 0.95 },
		content: <NewStrategyView />,
	},
	insights: {
		initial: { opacity: 0, x: 20 },
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: -20 },
		content: <InsightsView />,
	},
};

export default function HomeMainContent({ currentView }: HomeMainContentProps) {
	const currentConfig = VIEW_MAP[currentView];

	return (
		<AnimatePresence mode='wait'>
			<motion.div
				key={currentView}
				initial={currentConfig.initial}
				animate={currentConfig.animate}
				exit={currentConfig.exit}
			>
				{currentConfig.content}
			</motion.div>
		</AnimatePresence>
	);
}
